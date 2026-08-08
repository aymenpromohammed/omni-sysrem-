import { Router } from "express";
import { db } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user || (user.role !== "admin" && user.role !== "developer")) {
    res.status(403).json({ error: "غير مصرح" });
    return false;
  }
  return true;
}

/* ─── Safes & Treasuries API (الصناديق والخزائن المالية) ─── */
router.get("/safes", (req, res) => {
  const user = getAuthUser(req);
  if (!user) { res.status(401).json({ error: "غير مصرح" }); return; }
  try {
    const safes = db.prepare("SELECT * FROM safes ORDER BY id ASC").all();
    res.json(safes);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/safes", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, balance, currency, notes, active } = req.body;
  if (!name) { res.status(400).json({ error: "اسم الصندوق مطلوب" }); return; }
  try {
    const r = db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?, ?, ?, ?, ?)")
      .run(name, Number(balance) || 0, currency || "ريال", notes || "", active !== false ? 1 : 0);
    const created = db.prepare("SELECT * FROM safes WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/safes/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, balance, currency, notes, active } = req.body;
  try {
    db.prepare("UPDATE safes SET name=?, balance=?, currency=?, notes=?, active=? WHERE id=?")
      .run(name, Number(balance) || 0, currency || "ريال", notes || "", active !== false ? 1 : 0, req.params.id);
    const updated = db.prepare("SELECT * FROM safes WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/safes/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    db.prepare("DELETE FROM safes WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Currencies API (العملات) ─── */
router.get("/currencies", (req, res) => {
  try {
    const currencies = db.prepare("SELECT * FROM currencies ORDER BY is_default DESC, id ASC").all();
    res.json(currencies);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

/* ─── Vouchers API (سندات الصرف والقبض) ─── */
router.get("/accounting/vouchers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { type, party_type, party_id, search } = req.query as any;

  let sql = "SELECT * FROM vouchers WHERE 1=1";
  const params: any[] = [];

  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (party_type) {
    sql += " AND party_type = ?";
    params.push(party_type);
  }
  if (party_id) {
    sql += " AND party_id = ?";
    params.push(party_id);
  }
  if (search) {
    sql += " AND (voucher_number LIKE ? OR party_name LIKE ? OR received_from LIKE ? OR payment_against LIKE ?)";
    params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  }

  sql += " ORDER BY id DESC";
  try {
    const rows = db.prepare(sql).all(...params);
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const row = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
    if (!row) {
      res.status(404).json({ error: "السند غير موجود" });
      return;
    }
    res.json(row);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/vouchers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    type,
    party_type,
    party_id,
    party_name,
    amount,
    currency,
    safe_id,
    received_from,
    payment_against,
    payment_method,
    amount_text,
    notes,
    header_title,
    header_subtitle,
    logo_url,
    accent_color,
    bottom_text,
  } = req.body;

  if (!type || !party_type || !party_id || !party_name || amount === undefined) {
    res.status(400).json({ error: "جميع الحقول الأساسية مطلوبة (النوع، الفئة، الطرف، المبلغ)" });
    return;
  }

  try {
    let finalCurrency = currency;
    if (safe_id) {
      const safeObj = db.prepare("SELECT * FROM safes WHERE id = ?").get(safe_id) as any;
      if (safeObj && (!finalCurrency || finalCurrency.trim() === "")) {
        finalCurrency = safeObj.currency;
      }
    }
    if (!finalCurrency) finalCurrency = "ريال";

    // Generate next sequential voucher number
    const countRow = db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as { c: number };
    const nextNum = String(countRow.c + 1);

    const r = db.prepare(`
      INSERT INTO vouchers (
        voucher_number, type, party_type, party_id, party_name, amount, currency, safe_id,
        received_from, payment_against, payment_method, amount_text, notes,
        header_title, header_subtitle, logo_url, accent_color, bottom_text
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextNum,
      type,
      party_type,
      party_id,
      party_name,
      amount,
      finalCurrency,
      safe_id ? Number(safe_id) : null,
      received_from ?? "",
      payment_against ?? "",
      payment_method ?? "cash",
      amount_text ?? "",
      notes ?? "",
      header_title ?? "مخابز الشام للخبز العربي",
      header_subtitle ?? "Maamil Al Sham",
      logo_url ?? "/omnisystem-logo.png",
      accent_color ?? "#ef4444",
      bottom_text ?? "جودة الخبز ... سر ثقة عملائنا"
    );

    // Update safe balance if safe_id provided
    if (safe_id) {
      const numAmount = Number(amount) || 0;
      if (type === "receipt") {
        db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(numAmount, safe_id);
      } else if (type === "payment") {
        db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(numAmount, safe_id);
      }
    }

    const created = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    voucher_number,
    type,
    party_type,
    party_id,
    party_name,
    amount,
    currency,
    safe_id,
    received_from,
    payment_against,
    payment_method,
    amount_text,
    notes,
    header_title,
    header_subtitle,
    logo_url,
    accent_color,
    bottom_text,
    created_at,
  } = req.body;

  try {
    db.prepare(`
      UPDATE vouchers
      SET voucher_number = ?, type = ?, party_type = ?, party_id = ?, party_name = ?, amount = ?, currency = ?,
          safe_id = ?, received_from = ?, payment_against = ?, payment_method = ?, amount_text = ?, notes = ?,
          header_title = ?, header_subtitle = ?, logo_url = ?, accent_color = ?, bottom_text = ?, created_at = ?
      WHERE id = ?
    `).run(
      voucher_number,
      type,
      party_type,
      party_id,
      party_name,
      amount,
      currency ?? "دينار",
      safe_id ? Number(safe_id) : null,
      received_from ?? "",
      payment_against ?? "",
      payment_method ?? "cash",
      amount_text ?? "",
      notes ?? "",
      header_title ?? "مخابز الشام للخبز العربي",
      header_subtitle ?? "Maamil Al Sham",
      logo_url ?? "/omnisystem-logo.png",
      accent_color ?? "#ef4444",
      bottom_text ?? "جودة الخبز ... سر ثقة عملائنا",
      created_at ?? new Date().toISOString(),
      req.params.id
    );

    const updated = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const v = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(req.params.id) as any;
    if (v && v.safe_id && v.amount) {
      if (v.type === "receipt") {
        db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(v.amount, v.safe_id);
      } else if (v.type === "payment") {
        db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(v.amount, v.safe_id);
      }
    }
    db.prepare("DELETE FROM vouchers WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── Manual Ledger Entries (تعديلات الحساب والقيود اليدوية) ─── */
router.post("/accounting/manual-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { party_type, party_id, entry_date, description, debit, credit, notes } = req.body;

  if (!party_type || !party_id || !entry_date || !description) {
    res.status(400).json({ error: "جميع حقول القيد اليدوي مطلوبة (الطرف، التاريخ، البيان)" });
    return;
  }

  try {
    const r = db.prepare(`
      INSERT INTO manual_ledger_entries (party_type, party_id, entry_date, description, debit, credit, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      party_type,
      party_id,
      entry_date,
      description,
      debit ?? 0,
      credit ?? 0,
      notes ?? ""
    );

    const created = db.prepare("SELECT * FROM manual_ledger_entries WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete("/accounting/manual-entries/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    db.prepare("DELETE FROM manual_ledger_entries WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── dynamic account statement (كشف حساب ديناميكي متكامل ومحسّن) ─── */
router.get("/accounting/statement/:party_type/:party_id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { party_type, party_id } = req.params;
  const { start_date, end_date } = req.query as any;

  try {
    // 1. Fetch info about employee or customer
    let partyInfo: any = null;
    if (party_type === "employee") {
      partyInfo = db.prepare(`
        SELECT e.*, d.name as department_name 
        FROM hr_employees e 
        LEFT JOIN hr_departments d ON d.id = e.department_id 
        WHERE e.id = ?
      `).get(party_id);
    } else {
      partyInfo = db.prepare("SELECT * FROM customers WHERE id = ?").get(party_id);
    }

    if (!partyInfo) {
      res.status(404).json({ error: "الطرف المحدد غير موجود" });
      return;
    }

    const transactions: any[] = [];

    // Aggregating standard sources based on party_type
    if (party_type === "customer") {
      // Source A: Orders (Invoices are Debit to Customer account)
      const orders = db.prepare(`
        SELECT id, invoice_number, total, created_at, note
        FROM orders
        WHERE customer_id = ?
      `).all(party_id) as any[];

      orders.forEach(o => {
        const cleanInvNum = o.invoice_number.replace(/^INV-0*/, "") || "0";
        transactions.push({
          date: o.created_at.slice(0, 10),
          datetime: o.created_at,
          description: `فاتورة مبيعات رقم ${cleanInvNum}`,
          debit: o.total, // Client owes us
          credit: 0,
          source: "order",
          source_id: o.id,
          notes: o.note ?? "",
        });
      });

      // Source B: Returns (Refunds are Credit to Customer account)
      const returns = db.prepare(`
        SELECT id, return_number, total_refund, created_at, notes
        FROM returns
        WHERE customer_id = ?
      `).all(party_id) as any[];

      returns.forEach(r => {
        const cleanRetNum = r.return_number;
        transactions.push({
          date: r.created_at.slice(0, 10),
          datetime: r.created_at,
          description: `مرتجع مبيعات رقم ${cleanRetNum}`,
          debit: 0,
          credit: r.total_refund, // Reduces what client owes
          source: "return",
          source_id: r.id,
          notes: r.notes ?? "",
        });
      });

    } else if (party_type === "employee") {
      // Source A: Salaries (Salaries earned are Credit to Employee account)
      const salaries = db.prepare(`
        SELECT id, month, basic_salary, bonuses, deductions, net_salary, notes, created_at
        FROM hr_salaries
        WHERE employee_id = ?
      `).all(party_id) as any[];

      salaries.forEach(s => {
        // Credit the earned part
        transactions.push({
          date: s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0,10),
          datetime: s.created_at ?? new Date().toISOString(),
          description: `راتب شهر ${s.month} (مستحق)`,
          debit: 0,
          credit: s.basic_salary + s.bonuses, // Business owes employee
          source: "salary_earned",
          source_id: s.id,
          notes: s.notes ?? "",
        });

        // Debit the deduction part (if any)
        if (s.deductions > 0) {
          transactions.push({
            date: s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0,10),
            datetime: s.created_at ?? new Date().toISOString(),
            description: `استقطاعات من راتب شهر ${s.month}`,
            debit: s.deductions, // Reduces what business owes
            credit: 0,
            source: "salary_deduction",
            source_id: s.id,
            notes: s.notes ?? "",
          });
        }
      });

      // Source B: Meal Deductions (Meals are Debit to Employee account)
      const mealDeductions = db.prepare(`
        SELECT id, amount, notes, created_at, invoice_number
        FROM meal_deductions
        WHERE employee_id = ?
      `).all(party_id) as any[];

      mealDeductions.forEach(m => {
        const cleanInv = m.invoice_number ? m.invoice_number.replace(/^INV-0*/, "") : "";
        transactions.push({
          date: m.created_at.slice(0, 10),
          datetime: m.created_at,
          description: `خصم وجبات كاشير — فاتورة ${cleanInv}`,
          debit: m.amount, // Deducted from employee
          credit: 0,
          source: "meal_deduction",
          source_id: m.id,
          notes: m.notes ?? "",
        });
      });
    }

    // Source C: Vouchers (Payments & Receipts)
    const vouchers = db.prepare(`
      SELECT id, voucher_number, type, amount, created_at, payment_against, notes, currency
      FROM vouchers
      WHERE party_type = ? AND party_id = ?
    `).all(party_type, party_id) as any[];

    vouchers.forEach(v => {
      let debit = 0;
      let credit = 0;
      let desc = "";

      if (v.type === "receipt") {
        // Receipt voucher: we received money
        credit = v.amount;
        desc = `سند قبض رقم ${v.voucher_number}${v.payment_against ? ` - ${v.payment_against}` : ""}`;
      } else {
        // Payment voucher: we paid money
        debit = v.amount;
        desc = `سند صرف رقم ${v.voucher_number}${v.payment_against ? ` - ${v.payment_against}` : ""}`;
      }

      transactions.push({
        date: v.created_at.slice(0, 10),
        datetime: v.created_at,
        description: desc,
        debit,
        credit,
        source: "voucher",
        source_id: v.id,
        notes: v.notes ?? "",
      });
    });

    // Source D: Manual Ledger Entries
    const manualEntries = db.prepare(`
      SELECT id, entry_date, description, debit, credit, notes, created_at
      FROM manual_ledger_entries
      WHERE party_type = ? AND party_id = ?
    `).all(party_type, party_id) as any[];

    manualEntries.forEach(me => {
      transactions.push({
        date: me.entry_date,
        datetime: me.created_at,
        description: me.description,
        debit: me.debit,
        credit: me.credit,
        source: "manual",
        source_id: me.id,
        notes: me.notes ?? "",
      });
    });

    // Sort all transactions chronologically
    transactions.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return a.datetime.localeCompare(b.datetime);
    });

    // Compute Running Balance and Filter by Date range
    let previousBalance = 0;
    let runningBalance = 0;

    const filteredTransactions: any[] = [];
    let totalDebitInPeriod = 0;
    let totalCreditInPeriod = 0;

    transactions.forEach(t => {
      // Balance formula: Balance = Balance + (Credit - Debit) or (Debit - Credit) depending on party_type
      // For CUSTOMER: Debit (Orders) increases their debt (what they owe us). Credit (Receipts, returns) decreases it.
      // So Customer Balance = PreviousBalance + Debit - Credit (representing Net Debt to us)
      // For EMPLOYEE: Credit (Salary) increases what we owe them. Debit (Payments, meal deductions) decreases it.
      // So Employee Balance = PreviousBalance + Credit - Debit (representing Net Salary we owe them)
      
      const change = party_type === "customer" 
        ? (t.debit - t.credit) 
        : (t.credit - t.debit);

      if (start_date && t.date < start_date) {
        // Before start date, aggregate to previous balance
        previousBalance += change;
      } else if (end_date && t.date > end_date) {
        // Beyond end date: do nothing for period, but keep calculating running for reference
        runningBalance += change; // Not added to list
      } else {
        // Inside active period
        if (filteredTransactions.length === 0) {
          runningBalance = previousBalance + change;
        } else {
          runningBalance += change;
        }
        
        totalDebitInPeriod += t.debit;
        totalCreditInPeriod += t.credit;

        filteredTransactions.push({
          ...t,
          running_balance: runningBalance,
        });
      }
    });

    // If there were no transactions inside the period but we want the running balance to be correct:
    if (filteredTransactions.length === 0) {
      runningBalance = previousBalance;
    }

    res.json({
      party: partyInfo,
      previousBalance,
      currentBalance: runningBalance,
      totalDebit: totalDebitInPeriod,
      totalCredit: totalCreditInPeriod,
      netChange: party_type === "customer" ? (totalDebitInPeriod - totalCreditInPeriod) : (totalCreditInPeriod - totalDebitInPeriod),
      transactions: filteredTransactions,
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
