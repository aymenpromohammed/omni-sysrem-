import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAuth(req: any, res: any): any {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return null; }
  return user;
}

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || !user.active) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

router.get("/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { startDate, endDate, search } = req.query as any;
  let sql = `
    SELECT r.*, 
           u.name as cashier_name, 
           c.name as customer_name,
           orig_u.name as original_cashier_name
    FROM returns r
    LEFT JOIN users u ON u.id=r.user_id
    LEFT JOIN customers c ON c.id=r.customer_id
    LEFT JOIN orders o ON o.id=r.order_id
    LEFT JOIN users orig_u ON orig_u.id=o.user_id
    WHERE 1=1
  `;
  const params: any[] = [];
  if (startDate) { sql += " AND DATE(r.created_at)>=?"; params.push(startDate); }
  if (endDate) { sql += " AND DATE(r.created_at)<=?"; params.push(endDate); }
  if (search) { sql += " AND (r.return_number LIKE ? OR r.invoice_number LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
  sql += " ORDER BY r.created_at DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  const result = rows.map(r => {
    const items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(r.id);
    return { ...r, items };
  });
  res.json(result);
});

router.get("/returns/:id", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const row = db.prepare(`
    SELECT r.*, 
           u.name as cashier_name, 
           c.name as customer_name,
           orig_u.name as original_cashier_name
    FROM returns r
    LEFT JOIN users u ON u.id=r.user_id
    LEFT JOIN customers c ON c.id=r.customer_id
    LEFT JOIN orders o ON o.id=r.order_id
    LEFT JOIN users orig_u ON orig_u.id=o.user_id
    WHERE r.id=? OR r.return_number=?
  `).get(req.params.id, req.params.id) as any;
  if (!row) { res.status(404).json({ error: "المرتجع غير موجود" }); return; }
  row.items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(row.id);
  res.json(row);
});

router.post("/returns", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { invoice_number, order_id, reason, payment_method, customer_id, notes, items, approved_by, manager_pin } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "المنتجات المرتجعة مطلوبة" });
    return;
  }

  // Find order if available
  let order = null;
  if (order_id) {
    order = db.prepare("SELECT * FROM orders WHERE id=?").get(order_id) as any;
  }
  if (!order && invoice_number) {
    order = db.prepare("SELECT * FROM orders WHERE invoice_number=?").get(invoice_number) as any;
  }

  const tx = db.transaction(() => {
    let orderItems: any[] = [];
    if (order) {
      orderItems = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(order.id) as any[];
    }

    let calculatedTotalRefund = 0;
    const itemsToInsert: any[] = [];

    for (const item of items) {
      const returnQty = Number(item.quantity);
      if (returnQty <= 0) continue;

      let origItem = null;
      if (item.order_item_id) {
        origItem = orderItems.find(oi => oi.id === item.order_item_id);
      }
      if (!origItem && item.product_id) {
        origItem = orderItems.find(oi => oi.product_id === item.product_id);
      }

      if (origItem) {
        const alreadyReturned = Number(origItem.returned_quantity ?? 0);
        const maxReturnable = Math.max(0, origItem.quantity - alreadyReturned);
        if (returnQty > maxReturnable) {
          throw new Error(`الكمية المرتجعة للمنتج (${item.product_name ?? origItem.product_name}) تتجاوز المتبقي المتاح للإرجاع (${maxReturnable})`);
        }
      }

      const unitPrice = Number(item.unit_price ?? origItem?.unit_price ?? 0);
      const itemTotal = unitPrice * returnQty;
      calculatedTotalRefund += itemTotal;

      itemsToInsert.push({
        product_id: item.product_id ?? origItem?.product_id ?? null,
        product_name: item.product_name ?? origItem?.product_name ?? "منتج مرتجع",
        quantity: returnQty,
        unit_price: unitPrice,
        total: itemTotal,
        order_item_id: origItem?.id ?? null,
      });
    }

    if (itemsToInsert.length === 0) {
      throw new Error("لا توجد كميات صالحة للإرجاع");
    }

    // Generate sequential Return Number: RET-0001-...
    const countRow = db.prepare("SELECT COUNT(*) as c FROM returns").get() as { c: number };
    const returnNum = `RET-${String(countRow.c + 1).padStart(4, "0")}-${Date.now().toString().slice(-4)}`;

    const effectiveCustomerId = customer_id ?? order?.customer_id ?? null;
    const effectiveInvoiceNum = invoice_number ?? order?.invoice_number ?? "INV-UNKNOWN";
    const effectiveOrderId = order?.id ?? order_id ?? null;

    const effectiveApprovedBy = approved_by || (user.name ?? "مدير النظام");

    // 1. Insert into returns table
    const r = db.prepare(`
      INSERT INTO returns (return_number, invoice_number, order_id, reason, total_refund, payment_method, customer_id, user_id, notes, approved_by, status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      returnNum,
      effectiveInvoiceNum,
      effectiveOrderId,
      reason ?? "مرتجع مبيعات",
      calculatedTotalRefund,
      payment_method ?? "cash",
      effectiveCustomerId,
      user.id,
      notes ?? null,
      effectiveApprovedBy,
      "approved"
    );
    const returnId = r.lastInsertRowid;

    // 2. Insert return_items & update order_items & product stock
    const insertReturnItem = db.prepare(`
      INSERT INTO return_items (return_id, product_id, product_name, quantity, unit_price, total, order_item_id)
      VALUES (?,?,?,?,?,?,?)
    `);

    for (const item of itemsToInsert) {
      insertReturnItem.run(
        returnId,
        item.product_id,
        item.product_name,
        item.quantity,
        item.unit_price,
        item.total,
        item.order_item_id
      );

      // Update order_items returned_quantity
      if (item.order_item_id) {
        db.prepare("UPDATE order_items SET returned_quantity = COALESCE(returned_quantity, 0) + ? WHERE id=?")
          .run(item.quantity, item.order_item_id);
      } else if (effectiveOrderId && item.product_id) {
        db.prepare("UPDATE order_items SET returned_quantity = COALESCE(returned_quantity, 0) + ? WHERE order_id=? AND product_id=?")
          .run(item.quantity, effectiveOrderId, item.product_id);
      }

      // Restock product stock
      if (item.product_id) {
        db.prepare("UPDATE products SET stock = COALESCE(stock, 0) + ? WHERE id=?")
          .run(item.quantity, item.product_id);

        // Restock ingredient recipes if applicable
        try {
          const recipes = db.prepare("SELECT * FROM product_recipes WHERE product_id=?").all(item.product_id) as any[];
          for (const recipe of recipes) {
            db.prepare("UPDATE inventory_items SET current_stock = COALESCE(current_stock, 0) + ? WHERE name = ? OR name_ar = ?")
              .run(recipe.quantity * item.quantity, recipe.ingredient_name, recipe.ingredient_name);
          }
        } catch {}
      }
    }

    // 3. Update order refund status & total_refunded
    if (order) {
      const allOrderItems = db.prepare("SELECT quantity, COALESCE(returned_quantity, 0) as ret_qty FROM order_items WHERE order_id=?").all(order.id) as any[];
      const remainingTotalQty = allOrderItems.reduce((s, i) => s + Math.max(0, i.quantity - i.ret_qty), 0);
      const refundStatus = remainingTotalQty <= 0 ? "full" : "partial";

      db.prepare("UPDATE orders SET total_refunded = COALESCE(total_refunded, 0) + ?, refund_status = ? WHERE id=?")
        .run(calculatedTotalRefund, refundStatus, order.id);
    }

    // 4. Record accounting voucher
    try {
      const vCount = (db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as any)?.c ?? 0;
      const vNum = `VOUT-${String(vCount + 1).padStart(4, "0")}`;
      let partyName = "مرتجع مبيعات";
      if (effectiveCustomerId) {
        const cust = db.prepare("SELECT name FROM customers WHERE id=?").get(effectiveCustomerId) as any;
        if (cust) partyName = cust.name;
      }

      db.prepare(`
        INSERT INTO vouchers (voucher_number, type, party_type, party_id, party_name, amount, payment_method, payment_against, notes)
        VALUES (?, 'spend', 'customer', ?, ?, ?, ?, ?, ?)
      `).run(
        vNum,
        effectiveCustomerId ?? 0,
        partyName,
        calculatedTotalRefund,
        payment_method ?? "cash",
        `مردود مبيعات فاتورة ${effectiveInvoiceNum} (${reason ?? "إرجاع أصناف"})`,
        notes ?? null
      );
    } catch (ve) {
      // Vouchers table structure fallback
    }

    const created = db.prepare(`
      SELECT r.*, u.name as cashier_name, c.name as customer_name, o.user_id as original_cashier_id
      FROM returns r
      LEFT JOIN users u ON u.id=r.user_id
      LEFT JOIN customers c ON c.id=r.customer_id
      LEFT JOIN orders o ON o.id=r.order_id
      WHERE r.id=?
    `).get(returnId) as any;

    if (created && created.original_cashier_id) {
      const origCashier = db.prepare("SELECT name FROM users WHERE id=?").get(created.original_cashier_id) as any;
      created.original_cashier_name = origCashier?.name ?? "غير معروف";
    }

    created.items = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(returnId);
    return created;
  });

  try {
    const result = tx();
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message || "فشل في تسجيل المرتجع" });
  }
});

router.delete("/returns/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const row = db.prepare("SELECT * FROM returns WHERE id=?").get(req.params.id) as any;
  if (!row) { res.status(404).json({ error: "غير موجود" }); return; }
  const returnItems = db.prepare("SELECT * FROM return_items WHERE return_id=?").all(row.id) as any[];
  for (const item of returnItems) {
    if (item.product_id) {
      db.prepare("UPDATE products SET stock = MAX(0, COALESCE(stock, 0) - ?) WHERE id=?").run(item.quantity, item.product_id);
    }
  }
  db.prepare("DELETE FROM returns WHERE id=?").run(req.params.id);
  res.status(204).send();
});

router.get("/returns-summary", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7) + "-01";
  const todayStats = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_refund),0) as total FROM returns WHERE DATE(created_at)=?").get(today) as any;
  const monthStats = db.prepare("SELECT COUNT(*) as count, COALESCE(SUM(total_refund),0) as total FROM returns WHERE DATE(created_at)>=?").get(monthStart) as any;
  const totalCount = (db.prepare("SELECT COUNT(*) as c FROM returns").get() as any).c;
  res.json({
    todayCount: todayStats.count,
    todayTotal: todayStats.total,
    monthCount: monthStats.count,
    monthTotal: monthStats.total,
    totalCount,
  });
});

/* ── البحث عن طلب بواسطة رقم الفاتورة أو ID مع تفاصيل الكميات المتبقية ── */
router.get("/orders/lookup", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { q } = req.query as any;
  if (!q) { res.status(400).json({ error: "مطلوب معيار البحث" }); return; }

  const searchRaw = String(q).trim();
  const digitsOnly = searchRaw.replace(/\D/g, "");
  const numVal = digitsOnly ? parseInt(digitsOnly, 10) : null;
  const padded4 = numVal !== null ? String(numVal).padStart(4, "0") : "";

  let orderRow = db.prepare(`
    SELECT o.*, u.name as user_name, u.username as cashier_username, c.name as customer_name, c.phone as customer_phone
    FROM orders o
    LEFT JOIN users u ON u.id=o.user_id
    LEFT JOIN customers c ON c.id=o.customer_id
    WHERE o.invoice_number = ?
       OR o.invoice_number = ?
       OR o.invoice_number = ?
       OR (o.id = ?)
       OR (o.invoice_number LIKE ?)
    ORDER BY o.id DESC LIMIT 1
  `).get(
    searchRaw,
    `INV-${padded4}`,
    padded4,
    numVal ?? -1,
    `%${digitsOnly || searchRaw}%`
  ) as any;

  if (!orderRow) { res.status(404).json({ error: `لم يتم العثور على الفاتورة رقم (${searchRaw})` }); return; }
  const items = db.prepare("SELECT * FROM order_items WHERE order_id=?").all(orderRow.id) as any[];

  // Retrieve previous returns for this order
  const previousReturns = db.prepare(`
    SELECT r.id, r.return_number, r.total_refund, r.created_at, r.reason, u.name as processed_by
    FROM returns r
    LEFT JOIN users u ON u.id=r.user_id
    WHERE r.order_id=? OR r.invoice_number=?
    ORDER BY r.created_at DESC
  `).all(orderRow.id, orderRow.invoice_number) as any[];

  // Map returned quantities per item
  const itemReturnsMap = new Map<number, number>();
  const returnItemsRows = db.prepare(`
    SELECT ri.product_id, ri.order_item_id, SUM(ri.quantity) as total_returned
    FROM return_items ri
    JOIN returns r ON r.id = ri.return_id
    WHERE r.order_id = ? OR r.invoice_number = ?
    GROUP BY ri.product_id, ri.order_item_id
  `).all(orderRow.id, orderRow.invoice_number) as any[];

  for (const ri of returnItemsRows) {
    if (ri.order_item_id) {
      itemReturnsMap.set(ri.order_item_id, ri.total_returned);
    } else if (ri.product_id) {
      itemReturnsMap.set(ri.product_id, ri.total_returned);
    }
  }

  const itemsWithReturnStatus = items.map(i => {
    const returnedQty = itemReturnsMap.get(i.id) ?? (i.product_id ? itemReturnsMap.get(i.product_id) : 0) ?? Number(i.returned_quantity ?? 0);
    const remainingQty = Math.max(0, i.quantity - returnedQty);
    return {
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      quantity: i.quantity,
      unitPrice: i.unit_price,
      total: i.total,
      categoryId: i.category_id,
      categoryName: i.category_name,
      returnedQuantity: returnedQty,
      remainingQuantity: remainingQty,
    };
  });

  const totalRemainingQty = itemsWithReturnStatus.reduce((s, i) => s + i.remainingQuantity, 0);
  const totalReturnedQty = itemsWithReturnStatus.reduce((s, i) => s + i.returnedQuantity, 0);

  const fullyReturned = totalRemainingQty === 0;
  const partiallyReturned = totalReturnedQty > 0 && totalRemainingQty > 0;

  res.json({
    id: orderRow.id,
    invoiceNumber: orderRow.invoice_number,
    total: orderRow.total,
    subtotal: orderRow.subtotal,
    discount: orderRow.discount,
    tax: orderRow.tax,
    paymentMethod: orderRow.payment_method,
    orderType: orderRow.order_type,
    tableNumber: orderRow.table_number,
    note: orderRow.note,
    createdAt: orderRow.created_at,
    cashierName: orderRow.user_name,
    userId: orderRow.user_id,
    customerName: orderRow.customer_name,
    customerPhone: orderRow.customer_phone,
    refundStatus: fullyReturned ? "full" : partiallyReturned ? "partial" : "none",
    alreadyReturned: fullyReturned,
    fullyReturned,
    partiallyReturned,
    previousReturns,
    items: itemsWithReturnStatus,
  });
});

/* ── ملخص صناديق الكاشيرين والورديات ── */
router.get("/cashier-boxes", (req, res) => {
  const user = requireAuth(req, res);
  if (!user) return;
  const { date } = req.query as any;
  const filterDate = date ?? new Date().toISOString().slice(0, 10);

  const cashiers = db.prepare(`
    SELECT u.id, u.name,
      COALESCE(SUM(o.total),0) as orders_total,
      COUNT(o.id) as orders_count
    FROM users u
    LEFT JOIN orders o ON o.user_id=u.id AND DATE(o.created_at)=?
    WHERE u.active=1
    GROUP BY u.id, u.name
    ORDER BY u.name
  `).all(filterDate) as any[];

  const returns_ = db.prepare(`
    SELECT o.user_id,
      COALESCE(SUM(r.total_refund),0) as returns_total,
      COUNT(r.id) as returns_count
    FROM returns r
    LEFT JOIN orders o ON o.id=r.order_id
    WHERE DATE(r.created_at)=?
    GROUP BY o.user_id
  `).all(filterDate) as any[];

  const returnsMap = new Map(returns_.map(r => [r.user_id, r]));

  const mainTotal = cashiers.reduce((s, c) => s + c.orders_total, 0);
  const mainReturns = returns_.reduce((s, r) => s + r.returns_total, 0);

  res.json({
    date: filterDate,
    mainBox: { total: mainTotal, returnsTotal: mainReturns, net: mainTotal - mainReturns },
    cashiers: cashiers.map(c => {
      const ret = returnsMap.get(c.id);
      return {
        userId: c.id,
        name: c.name,
        ordersTotal: c.orders_total,
        ordersCount: c.orders_count,
        returnsTotal: ret?.returns_total ?? 0,
        returnsCount: ret?.returns_count ?? 0,
        net: c.orders_total - (ret?.returns_total ?? 0),
      };
    }),
  });
});

export default router;
