import { Router } from "express";
import { db, createDoubleEntryJournal } from "../lib/sqlite";
import { getAuthUser } from "./auth";

const router = Router();

function requireAdmin(req: any, res: any): boolean {
  const user = getAuthUser(req);
  if (!user) {
    res.status(401).json({ error: "غير مسجل الدخول" });
    return false;
  }
  return true;
}

/* ─── 1. Financial Dashboard Stats (لوحة التحكم المالية) ─── */
router.get("/accounting/dashboard-stats", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const today = new Date().toISOString().slice(0, 10);

    // Sales Today
    const todaySalesRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM orders 
      WHERE DATE(created_at) = ? AND (status IS NULL OR status != 'cancelled')
    `).get(today) as { total: number };

    // Purchases Today
    const todayPurchasesRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total 
      FROM purchase_invoices 
      WHERE DATE(invoice_date) = ?
    `).get(today) as { total: number };

    // Total Expenses All Time / Month
    const totalExpensesRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM expenses
    `).get() as { total: number };

    // Receipts Total (Vouchers)
    const totalReceiptsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM vouchers WHERE type = 'receipt'
    `).get() as { total: number };

    // Payments Total (Vouchers)
    const totalPaymentsRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total FROM vouchers WHERE type = 'payment'
    `).get() as { total: number };

    // Cash Drawers Balances (Safes)
    const safesBalanceRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM safes WHERE active = 1
    `).get() as { total: number };

    // Bank Accounts Balances
    const bankBalanceRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM bank_accounts WHERE active = 1
    `).get() as { total: number };

    // Supplier Payables (AP)
    const supplierPayablesRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM suppliers
    `).get() as { total: number };

    // Customer Receivables (AR)
    const customerReceivablesRow = db.prepare(`
      SELECT COALESCE(SUM(balance), 0) as total FROM customers
    `).get() as { total: number };

    // Total Revenue (Sales + Receipts)
    const totalRevenueRow = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status IS NULL OR status != 'cancelled'
    `).get() as { total: number };

    // Total COGS from Order Items
    const totalCogsRow = db.prepare(`
      SELECT COALESCE(SUM(i.quantity * COALESCE(p.cost, i.unit_price * 0.5)), 0) as total
      FROM order_items i
      LEFT JOIN products p ON p.id = i.product_id
      JOIN orders o ON o.id = i.order_id
      WHERE o.status IS NULL OR o.status != 'cancelled'
    `).get() as { total: number };

    const grossProfit = totalRevenueRow.total - totalCogsRow.total;
    const netProfit = grossProfit - totalExpensesRow.total;

    // Monthly Expense Breakdown
    const expenseBreakdown = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as amount
      FROM expenses
      GROUP BY category
      ORDER BY amount DESC
      LIMIT 6
    `).all();

    // Top Unpaid Purchase Invoices / Bills
    const overdueBills = db.prepare(`
      SELECT id, invoice_number, supplier_name, remaining_amount, due_date
      FROM purchase_invoices
      WHERE payment_status != 'paid' AND remaining_amount > 0
      ORDER BY due_date ASC
      LIMIT 5
    `).all();

    res.json({
      todaySales: todaySalesRow.total,
      todayPurchases: todayPurchasesRow.total,
      totalExpenses: totalExpensesRow.total,
      totalReceipts: totalReceiptsRow.total,
      totalPayments: totalPaymentsRow.total,
      safesBalance: safesBalanceRow.total,
      bankBalance: bankBalanceRow.total,
      supplierPayables: supplierPayablesRow.total,
      customerReceivables: customerReceivablesRow.total,
      totalRevenue: totalRevenueRow.total,
      totalCogs: totalCogsRow.total,
      grossProfit,
      netProfit,
      expenseBreakdown,
      overdueBills
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 2. Chart of Accounts (دليل الحسابات) ─── */
router.get("/accounting/accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const accounts = db.prepare("SELECT * FROM accounts ORDER BY code ASC").all();
    res.json(accounts);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { code, name, type, parent_code, cost_center_id } = req.body;
  if (!code || !name || !type) {
    res.status(400).json({ error: "الرمز والاسم ونوع الحساب حقول إجبارية" });
    return;
  }
  try {
    const existing = db.prepare("SELECT id FROM accounts WHERE code = ?").get(code);
    if (existing) {
      res.status(400).json({ error: "رمز الحساب مسجل مسبقاً! الرجاء استخدام رمز فريد." });
      return;
    }
    const r = db.prepare(`
      INSERT INTO accounts (code, name, type, parent_code, balance, active)
      VALUES (?, ?, ?, ?, 0.0, 1)
    `).run(code, name, type, parent_code ?? null);
    
    res.status(201).json({
      id: r.lastInsertRowid,
      code,
      name,
      type,
      parent_code,
      balance: 0.0,
      active: 1
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, active, parent_code } = req.body;
  try {
    db.prepare(`
      UPDATE accounts SET name = ?, active = ?, parent_code = ? WHERE id = ?
    `).run(name, active ?? 1, parent_code ?? null, req.params.id);
    const updated = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/accounts/:id/ledger", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const account = db.prepare("SELECT * FROM accounts WHERE id = ?").get(req.params.id) as any;
    if (!account) {
      res.status(404).json({ error: "الحساب غير موجود" });
      return;
    }

    const lines = db.prepare(`
      SELECT l.*, j.entry_number, j.entry_date, j.description as journal_desc, j.source_type
      FROM journal_entry_lines l
      JOIN journal_entries j ON j.id = l.journal_entry_id
      WHERE l.account_id = ?
      ORDER BY j.entry_date ASC, j.id ASC
    `).all(req.params.id) as any[];

    let runningBalance = 0;
    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(account.type);

    const ledger = lines.map(line => {
      const change = isDebitNormal ? (line.debit - line.credit) : (line.credit - line.debit);
      runningBalance += change;
      return {
        ...line,
        running_balance: runningBalance
      };
    });

    res.json({
      account,
      ledger
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 3. Journal Entries & Double-Entry (القيود اليومية) ─── */
router.get("/accounting/journal-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const entries = db.prepare("SELECT * FROM journal_entries ORDER BY id DESC").all() as any[];
    for (const entry of entries) {
      entry.lines = db.prepare(`
        SELECT l.*, a.code as account_code, a.name as account_name, a.type as account_type
        FROM journal_entry_lines l
        JOIN accounts a ON a.id = l.account_id
        WHERE l.journal_entry_id = ?
      `).all(entry.id);
    }
    res.json(entries);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/journal-entries", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { entry_date, description, lines } = req.body;
  if (!description || !Array.isArray(lines) || lines.length < 2) {
    res.status(400).json({ error: "يجب إدخال بيان القيد وبندين محاسبيين على الأقل (مدين ودائن)" });
    return;
  }

  try {
    const entryId = createDoubleEntryJournal(
      entry_date || new Date().toISOString().slice(0, 10),
      description,
      "manual",
      0,
      lines
    );
    const created = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(entryId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

router.post("/accounting/journal-entries/:id/reverse", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    const originalEntry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(req.params.id) as any;
    if (!originalEntry) {
      res.status(404).json({ error: "القيد غير موجود" });
      return;
    }
    if (originalEntry.is_reversed) {
      res.status(400).json({ error: "هذا القيد معكوس ومصحح مسبقاً!" });
      return;
    }

    const originalLines = db.prepare(`
      SELECT l.*, a.code as account_code
      FROM journal_entry_lines l
      JOIN accounts a ON a.id = l.account_id
      WHERE l.journal_entry_id = ?
    `).all(req.params.id) as any[];

    // Swapping debits and credits to create reversing entry
    const reversedLines = originalLines.map(l => ({
      account_code: l.account_code,
      debit: l.credit,
      credit: l.debit,
      description: `عكس قيد: ${l.description || originalEntry.description}`
    }));

    const reversalId = createDoubleEntryJournal(
      new Date().toISOString().slice(0, 10),
      `قيد عكس وتصحيح للقيد رقم ${originalEntry.entry_number} بواسطة ${user?.name || "الموافق"}`,
      "reversal",
      originalEntry.id,
      reversedLines
    );

    db.prepare("UPDATE journal_entries SET is_reversed = 1 WHERE id = ?").run(originalEntry.id);
    db.prepare("UPDATE journal_entries SET reversal_of_id = ? WHERE id = ?").run(originalEntry.id, reversalId);

    res.json({ message: "تم عكس القيد بنجاح وإنشاء قيد تسوية عكسي", reversalId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/trial-balance", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const accounts = db.prepare("SELECT * FROM accounts ORDER BY code ASC").all() as any[];
    let totalDebit = 0;
    let totalCredit = 0;
    
    const balanceSheet = accounts.map(acc => {
      const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
      let debit = 0;
      let credit = 0;
      
      if (acc.balance >= 0) {
        if (isDebitNormal) {
          debit = acc.balance;
        } else {
          credit = acc.balance;
        }
      } else {
        if (isDebitNormal) {
          credit = Math.abs(acc.balance);
        } else {
          debit = Math.abs(acc.balance);
        }
      }
      
      totalDebit += debit;
      totalCredit += credit;
      
      return {
        ...acc,
        debit,
        credit
      };
    });
    
    res.json({
      accounts: balanceSheet,
      totalDebit,
      totalCredit
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 3.1 System Users for Vouchers & Statements ─── */
router.get("/accounting/system-users", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const user = getAuthUser(req);
    const isDev = user && (user.role === "developer" || user.username === "developer");
    let sql = `
      SELECT id, username, name, role, active 
      FROM users 
      WHERE active = 1 
    `;
    if (!isDev) {
      sql += ` AND role != 'developer' AND username != 'developer' AND name NOT LIKE '%مطور%' `;
    }
    sql += ` ORDER BY CASE WHEN role='admin' THEN 1 WHEN role='manager' THEN 2 WHEN role='accountant' THEN 3 ELSE 4 END, name`;
    const users = db.prepare(sql).all();
    res.json(users);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 4. Receipt & Payment Vouchers (سندات القبض والصرف) ─── */
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
    party_type = "general",
    party_id = 0,
    party_name,
    amount,
    currency,
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
    safe_id,
    bank_account_id,
    cost_center_id,
  } = req.body;

  let finalPartyName = party_name || received_from;
  const numericPartyId = Number(party_id) || 0;

  if (!finalPartyName && numericPartyId > 0) {
    if (party_type === "employee") {
      const emp = db.prepare("SELECT name FROM hr_employees WHERE id = ?").get(numericPartyId) as any;
      if (emp) finalPartyName = emp.name;
    } else if (party_type === "customer") {
      const cust = db.prepare("SELECT name FROM customers WHERE id = ?").get(numericPartyId) as any;
      if (cust) finalPartyName = cust.name;
    } else if (party_type === "supplier") {
      const supp = db.prepare("SELECT name FROM suppliers WHERE id = ?").get(numericPartyId) as any;
      if (supp) finalPartyName = supp.name;
    } else if (party_type === "user" || party_type === "system_user") {
      const sysUser = db.prepare("SELECT id, name, username, role FROM users WHERE id = ?").get(numericPartyId) as any;
      if (sysUser) {
        const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
        finalPartyName = `${sysUser.name} (${roleLabel})`;
      }
    }
  }

  if ((party_type === "user" || party_type === "system_user") && numericPartyId > 0) {
    const sysUser = db.prepare("SELECT id, name, username, role FROM users WHERE id = ?").get(numericPartyId) as any;
    if (sysUser) {
      const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
      finalPartyName = `${sysUser.name} (${roleLabel})`;
    }
  }

  if (!finalPartyName && numericPartyId > 0) {
    finalPartyName = `طرف #${numericPartyId}`;
  }

  const numericAmount = Number(amount);

  if (!type || amount === undefined || amount === null || String(amount).trim() === "" || isNaN(numericAmount)) {
    res.status(400).json({ error: "الرجاء تحديد نوع السند وإدخال مبلغ مالي صحيح" });
    return;
  }

  if (!finalPartyName || !String(finalPartyName).trim()) {
    res.status(400).json({ error: "يرجى اختيار الطرف المستهدف أو كتابة اسم المستلم / المدفوع له" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as { c: number };
    const nextNum = String(countRow.c + 1);

    let finalSafeId = safe_id ? Number(safe_id) : null;
    let finalBankId = bank_account_id ? Number(bank_account_id) : null;

    if (!finalSafeId && !finalBankId) {
      const defaultSafe = db.prepare("SELECT id FROM safes WHERE name = 'الصندوق الرئيسي' LIMIT 1").get() as any;
      if (defaultSafe) finalSafeId = defaultSafe.id;
    }

    const docSettings = db.prepare("SELECT * FROM document_print_settings WHERE id = 1").get() as any;

    const r = db.prepare(`
      INSERT INTO vouchers (
        voucher_number, type, party_type, party_id, party_name, amount, currency,
        received_from, payment_against, payment_method, amount_text, notes,
        header_title, header_subtitle, logo_url, accent_color, bottom_text, safe_id, bank_account_id, cost_center_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      nextNum,
      type,
      party_type || "general",
      numericPartyId,
      finalPartyName,
      numericAmount,
      currency ?? "ريال",
      received_from ?? finalPartyName ?? "",
      payment_against ?? "",
      payment_method ?? "cash",
      amount_text ?? "",
      notes ?? "",
      header_title ?? docSettings?.company_name ?? "مخابز الشام للخبز العربي",
      header_subtitle ?? docSettings?.company_subtitle ?? "Maamil Al Sham",
      logo_url ?? docSettings?.logo_url ?? "/omnisystem-logo.png",
      accent_color ?? docSettings?.accent_color ?? "#ef4444",
      bottom_text ?? docSettings?.voucher_footer_text ?? "جودة الخبز ... سر ثقة عملائنا",
      finalSafeId,
      finalBankId,
      cost_center_id ? Number(cost_center_id) : null
    );

    const voucherId = r.lastInsertRowid;

    // Balance Updates
    if (finalSafeId) {
      if (type === "receipt") {
        db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(numericAmount, finalSafeId);
      } else if (type === "payment") {
        db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(numericAmount, finalSafeId);
      }
    } else if (finalBankId) {
      if (type === "receipt") {
        db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(numericAmount, finalBankId);
      } else if (type === "payment") {
        db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(numericAmount, finalBankId);
      }
    }

    // Party Balance update for Customer or Supplier
    if (party_type === "customer" && numericPartyId > 0) {
      if (type === "receipt") {
        db.prepare("UPDATE customers SET balance = balance - ? WHERE id = ?").run(numericAmount, numericPartyId);
      } else {
        db.prepare("UPDATE customers SET balance = balance + ? WHERE id = ?").run(numericAmount, numericPartyId);
      }
    } else if (party_type === "supplier" && numericPartyId > 0) {
      if (type === "payment") {
        db.prepare("UPDATE suppliers SET balance = balance - ? WHERE id = ?").run(numericAmount, numericPartyId);
      } else {
        db.prepare("UPDATE suppliers SET balance = balance + ? WHERE id = ?").run(numericAmount, numericPartyId);
      }
    }

    // Automated Double-Entry Journal
    try {
      const assetAccountCode = finalBankId ? "11100" : "11100"; // Cash / Bank Account
      const partyAccountCode = party_type === "customer" 
        ? "11200" 
        : (party_type === "supplier" 
            ? "21100" 
            : (party_type === "user" || party_type === "system_user" ? "11300" : "61000"));

      const lines = [];
      if (type === "receipt") {
        lines.push({ account_code: assetAccountCode, debit: numericAmount, credit: 0, description: `استلام دفعة من ${finalPartyName}` });
        lines.push({ account_code: partyAccountCode, debit: 0, credit: numericAmount, description: `سداد حساب من ${finalPartyName}` });
      } else {
        lines.push({ account_code: partyAccountCode, debit: numericAmount, credit: 0, description: `سداد مصروف / دفعة إلى ${finalPartyName}` });
        lines.push({ account_code: assetAccountCode, debit: 0, credit: numericAmount, description: `صرف نقدي/بنكي إلى ${finalPartyName}` });
      }

      createDoubleEntryJournal(
        new Date().toISOString().slice(0, 10),
        `سند ${type === "receipt" ? "قبض" : "صرف"} رقم ${nextNum} - ${finalPartyName}`,
        "voucher",
        voucherId,
        lines
      );
    } catch (journalErr: any) {
      console.error("Failed to generate double entry for voucher:", journalErr.message);
    }

    const created = db.prepare("SELECT * FROM vouchers WHERE id = ?").get(voucherId);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/vouchers/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const {
    voucher_number, type, party_type, party_id, party_name, amount, currency,
    received_from, payment_against, payment_method, amount_text, notes,
    header_title, header_subtitle, logo_url, accent_color, bottom_text, created_at
  } = req.body;

  try {
    db.prepare(`
      UPDATE vouchers
      SET voucher_number = ?, type = ?, party_type = ?, party_id = ?, party_name = ?, amount = ?, currency = ?,
          received_from = ?, payment_against = ?, payment_method = ?, amount_text = ?, notes = ?,
          header_title = ?, header_subtitle = ?, logo_url = ?, accent_color = ?, bottom_text = ?, created_at = ?
      WHERE id = ?
    `).run(
      voucher_number, type, party_type, party_id, party_name, amount, currency ?? "ريال",
      received_from ?? "", payment_against ?? "", payment_method ?? "cash", amount_text ?? "", notes ?? "",
      header_title ?? "مخابز الشام للخبز العربي", header_subtitle ?? "Maamil Al Sham",
      logo_url ?? "/omnisystem-logo.png", accent_color ?? "#ef4444", bottom_text ?? "جودة الخبز ... سر ثقة عملائنا",
      created_at ?? new Date().toISOString(), req.params.id
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
    const voucher = db.prepare("SELECT type, amount, safe_id, bank_account_id FROM vouchers WHERE id = ?").get(req.params.id) as any;
    if (voucher) {
      if (voucher.safe_id) {
        if (voucher.type === "receipt") {
          db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(voucher.amount, voucher.safe_id);
        } else if (voucher.type === "payment") {
          db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(voucher.amount, voucher.safe_id);
        }
      } else if (voucher.bank_account_id) {
        if (voucher.type === "receipt") {
          db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(voucher.amount, voucher.bank_account_id);
        } else if (voucher.type === "payment") {
          db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(voucher.amount, voucher.bank_account_id);
        }
      }
    }

    db.prepare("DELETE FROM vouchers WHERE id = ?").run(req.params.id);
    res.status(204).send();
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 5. Manual Ledger Entries (تعديلات الحساب والقيود اليدوية) ─── */
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
      party_type, party_id, entry_date, description, debit ?? 0, credit ?? 0, notes ?? ""
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


/* ─── 6. Dynamic Account Statements (كشف حساب للعملاء والموظفين والموردين) ─── */
router.get("/accounting/statement/:party_type/:party_id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { party_type, party_id } = req.params;
  const { start_date, end_date } = req.query as any;

  try {
    let partyInfo: any = null;
    if (party_type === "employee") {
      partyInfo = db.prepare(`
        SELECT e.*, d.name as department_name 
        FROM hr_employees e 
        LEFT JOIN hr_departments d ON d.id = e.department_id 
        WHERE e.id = ?
      `).get(party_id);
    } else if (party_type === "supplier") {
      partyInfo = db.prepare("SELECT * FROM suppliers WHERE id = ?").get(party_id);
    } else if (party_type === "user" || party_type === "system_user") {
      const user = getAuthUser(req);
      const isDev = user && (user.role === "developer" || user.username === "developer");
      const sysUser = db.prepare("SELECT id, name, username, role, phone FROM users WHERE id = ?").get(party_id) as any;
      if (sysUser && (isDev || (sysUser.role !== "developer" && sysUser.username !== "developer" && !String(sysUser.name || "").includes("مطور")))) {
        const roleLabel = sysUser.role === 'admin' ? 'مدير نظام' : sysUser.role === 'accountant' ? 'محاسب' : sysUser.role === 'manager' ? 'مدير فرع' : 'كاشير';
        partyInfo = {
          id: sysUser.id,
          name: `${sysUser.name} (${roleLabel})`,
          username: sysUser.username,
          role: sysUser.role,
          phone: sysUser.phone || "مستخدم نظام",
          address: `الدور الوظيفي: ${roleLabel}`
        };
      }
    } else {
      partyInfo = db.prepare("SELECT * FROM customers WHERE id = ?").get(party_id);
    }

    if (!partyInfo) {
      res.status(404).json({ error: "الطرف المحدد غير موجود" });
      return;
    }

    const transactions: any[] = [];

    if (party_type === "customer") {
      const orders = db.prepare(`
        SELECT id, invoice_number, total, created_at, note
        FROM orders
        WHERE customer_id = ?
      `).all(party_id) as any[];

      orders.forEach(o => {
        transactions.push({
          date: o.created_at.slice(0, 10),
          datetime: o.created_at,
          description: `فاتورة مبيعات رقم ${o.invoice_number}`,
          debit: o.total,
          credit: 0,
          source: "order",
          source_id: o.id,
          notes: o.note ?? "",
        });
      });

      const returns = db.prepare(`
        SELECT id, return_number, total_refund, created_at, notes
        FROM returns
        WHERE customer_id = ?
      `).all(party_id) as any[];

      returns.forEach(r => {
        transactions.push({
          date: r.created_at.slice(0, 10),
          datetime: r.created_at,
          description: `مرتجع مبيعات رقم ${r.return_number}`,
          debit: 0,
          credit: r.total_refund,
          source: "return",
          source_id: r.id,
          notes: r.notes ?? "",
        });
      });

    } else if (party_type === "supplier") {
      const purchases = db.prepare(`
        SELECT id, invoice_number, total, invoice_date, notes
        FROM purchase_invoices
        WHERE supplier_id = ?
      `).all(party_id) as any[];

      purchases.forEach(p => {
        transactions.push({
          date: p.invoice_date,
          datetime: p.invoice_date,
          description: `فاتورة شراء رقم ${p.invoice_number}`,
          debit: 0,
          credit: p.total, // Supplier credit = we owe them
          source: "purchase_invoice",
          source_id: p.id,
          notes: p.notes ?? "",
        });
      });

    } else if (party_type === "employee") {
      const salaries = db.prepare(`
        SELECT id, month, basic_salary, bonuses, deductions, net_salary, notes, created_at
        FROM hr_salaries
        WHERE employee_id = ?
      `).all(party_id) as any[];

      salaries.forEach(s => {
        transactions.push({
          date: s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0,10),
          datetime: s.created_at ?? new Date().toISOString(),
          description: `راتب شهر ${s.month} (مستحق)`,
          debit: 0,
          credit: s.basic_salary + s.bonuses,
          source: "salary_earned",
          source_id: s.id,
          notes: s.notes ?? "",
        });

        if (s.deductions > 0) {
          transactions.push({
            date: s.created_at ? s.created_at.slice(0, 10) : new Date().toISOString().slice(0,10),
            datetime: s.created_at ?? new Date().toISOString(),
            description: `استقطاعات من راتب شهر ${s.month}`,
            debit: s.deductions,
            credit: 0,
            source: "salary_deduction",
            source_id: s.id,
            notes: s.notes ?? "",
          });
        }
      });
    }

    // Source Vouchers (Receipts & Payments)
    const vouchers = db.prepare(`
      SELECT id, voucher_number, type, amount, created_at, payment_against, notes, currency
      FROM vouchers
      WHERE (party_type = ? OR (party_type IN ('user', 'system_user') AND ? IN ('user', 'system_user'))) AND party_id = ?
    `).all(party_type, party_type, party_id) as any[];

    vouchers.forEach(v => {
      let debit = 0;
      let credit = 0;
      if (v.type === "receipt") {
        credit = v.amount;
      } else {
        debit = v.amount;
      }

      transactions.push({
        date: v.created_at.slice(0, 10),
        datetime: v.created_at,
        description: `سند ${v.type === "receipt" ? "قبض" : "صرف"} رقم ${v.voucher_number}`,
        debit,
        credit,
        source: "voucher",
        source_id: v.id,
        notes: v.notes ?? "",
      });
    });

    // Manual Ledger Entries
    const manualEntries = db.prepare(`
      SELECT id, entry_date, description, debit, credit, notes, created_at
      FROM manual_ledger_entries
      WHERE (party_type = ? OR (party_type IN ('user', 'system_user') AND ? IN ('user', 'system_user'))) AND party_id = ?
    `).all(party_type, party_type, party_id) as any[];

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

    transactions.sort((a, b) => a.date.localeCompare(b.date));

    let previousBalance = 0;
    let runningBalance = 0;
    const filteredTransactions: any[] = [];

    transactions.forEach(t => {
      const change = (party_type === "customer")
        ? (t.debit - t.credit)
        : (t.credit - t.debit);

      if (start_date && t.date < start_date) {
        previousBalance += change;
      } else if (end_date && t.date > end_date) {
        // Excluded from range
      } else {
        runningBalance = (filteredTransactions.length === 0 ? previousBalance : runningBalance) + change;
        filteredTransactions.push({
          ...t,
          running_balance: runningBalance,
        });
      }
    });

    res.json({
      party: partyInfo,
      previousBalance,
      currentBalance: runningBalance || previousBalance,
      transactions: filteredTransactions,
    });

  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 7. Bank Accounts Management (إدارة الحسابات البنكية) ─── */
router.get("/accounting/bank-accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM bank_accounts ORDER BY id ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/bank-accounts", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { bank_name, account_number, iban, swift, balance, currency, notes } = req.body;
  if (!bank_name || !account_number) {
    res.status(400).json({ error: "اسم البنك ورقم الحساب حقول إجبارية" });
    return;
  }
  try {
    const r = db.prepare(`
      INSERT INTO bank_accounts (bank_name, account_number, iban, swift, balance, currency, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(bank_name, account_number, iban ?? "", swift ?? "", balance ?? 0.0, currency ?? "ريال", notes ?? "");

    const created = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.put("/accounting/bank-accounts/:id", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { bank_name, account_number, iban, swift, currency, notes, active } = req.body;
  try {
    db.prepare(`
      UPDATE bank_accounts
      SET bank_name = ?, account_number = ?, iban = ?, swift = ?, currency = ?, notes = ?, active = ?
      WHERE id = ?
    `).run(bank_name, account_number, iban, swift, currency, notes, active ?? 1, req.params.id);

    const updated = db.prepare("SELECT * FROM bank_accounts WHERE id = ?").get(req.params.id);
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 8. Inter-Account Transfers (التحويل بين الصناديق والبنوك) ─── */
router.get("/accounting/transfers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM inter_account_transfers ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/transfers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  const { transfer_date, from_type, from_id, to_type, to_id, amount, notes } = req.body;

  const numAmount = Number(amount);
  if (!from_type || !from_id || !to_type || !to_id || !numAmount || numAmount <= 0) {
    res.status(400).json({ error: "يرجى تحديد جهة المصدر والوجهة والمبلغ المحول بشكل صحيح" });
    return;
  }

  if (from_type === to_type && Number(from_id) === Number(to_id)) {
    res.status(400).json({ error: "لا يمكن التحويل لنفس الحساب أو الخزينة!" });
    return;
  }

  try {
    let fromName = "";
    let toName = "";

    // Fetch From Name & Check Balance
    if (from_type === "safe") {
      const s = db.prepare("SELECT name, balance FROM safes WHERE id = ?").get(from_id) as any;
      if (!s) return res.status(400).json({ error: "خزينة المصدر غير موجودة" });
      fromName = s.name;
    } else {
      const b = db.prepare("SELECT bank_name, account_number FROM bank_accounts WHERE id = ?").get(from_id) as any;
      if (!b) return res.status(400).json({ error: "البنك المصدر غير موجود" });
      fromName = `${b.bank_name} (${b.account_number})`;
    }

    // Fetch To Name
    if (to_type === "safe") {
      const s = db.prepare("SELECT name FROM safes WHERE id = ?").get(to_id) as any;
      if (!s) return res.status(400).json({ error: "خزينة المستلم غير موجودة" });
      toName = s.name;
    } else {
      const b = db.prepare("SELECT bank_name, account_number FROM bank_accounts WHERE id = ?").get(to_id) as any;
      if (!b) return res.status(400).json({ error: "البنك المستلم غير موجود" });
      toName = `${b.bank_name} (${b.account_number})`;
    }

    const countRow = db.prepare("SELECT COUNT(*) as c FROM inter_account_transfers").get() as { c: number };
    const transferNum = `TRF-${String(countRow.c + 1).padStart(5, "0")}`;

    // Update balances
    if (from_type === "safe") {
      db.prepare("UPDATE safes SET balance = balance - ? WHERE id = ?").run(numAmount, from_id);
    } else {
      db.prepare("UPDATE bank_accounts SET balance = balance - ? WHERE id = ?").run(numAmount, from_id);
    }

    if (to_type === "safe") {
      db.prepare("UPDATE safes SET balance = balance + ? WHERE id = ?").run(numAmount, to_id);
    } else {
      db.prepare("UPDATE bank_accounts SET balance = balance + ? WHERE id = ?").run(numAmount, to_id);
    }

    // Double Entry Journal Creation (Debit Receiving Asset, Credit Sending Asset)
    let journalId: number | null = null;
    try {
      journalId = createDoubleEntryJournal(
        transfer_date || new Date().toISOString().slice(0, 10),
        `تحويل مالي بين الحسابات (${transferNum}): من ${fromName} إلى ${toName}`,
        "transfer",
        0,
        [
          { account_code: "11100", debit: numAmount, credit: 0, description: `إيداع إلى ${toName}` },
          { account_code: "11100", debit: 0, credit: numAmount, description: `سحب من ${fromName}` }
        ]
      );
    } catch (e) {}

    const r = db.prepare(`
      INSERT INTO inter_account_transfers (
        transfer_number, transfer_date, from_type, from_id, from_name,
        to_type, to_id, to_name, amount, notes, journal_entry_id, created_by
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      transferNum,
      transfer_date || new Date().toISOString().slice(0, 10),
      from_type,
      from_id,
      fromName,
      to_type,
      to_id,
      toName,
      numAmount,
      notes ?? "",
      journalId,
      user?.name || "مدير النظام"
    );

    const created = db.prepare("SELECT * FROM inter_account_transfers WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 9. Fixed Assets & Depreciation (الأصول الثابتة والإهلاك) ─── */
router.get("/accounting/fixed-assets", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const assets = db.prepare("SELECT * FROM fixed_assets ORDER BY id DESC").all();
    res.json(assets);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/fixed-assets", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, location, responsible_person } = req.body;

  if (!name || !category || !purchase_date || !purchase_cost) {
    res.status(400).json({ error: "اسم الأصل، الفئة، تاريخ الشراء، وتكلفة الشراء حقول إجبارية" });
    return;
  }

  try {
    const countRow = db.prepare("SELECT COUNT(*) as c FROM fixed_assets").get() as { c: number };
    const assetCode = `AST-${String(countRow.c + 1).padStart(3, "0")}`;

    const cost = Number(purchase_cost);
    const salvage = Number(salvage_value || 0);
    const years = Number(useful_life_years || 5);

    const r = db.prepare(`
      INSERT INTO fixed_assets (
        asset_code, name, category, purchase_date, purchase_cost, salvage_value,
        useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 0.0, ?, ?, ?)
    `).run(
      assetCode, name, category, purchase_date, cost, salvage, years, cost, location ?? "المقر الرئيسي", responsible_person ?? "مدير الفرع"
    );

    // Record asset acquisition journal entry
    try {
      createDoubleEntryJournal(
        purchase_date,
        `شراء أصل ثابت جديد: ${name} (${assetCode})`,
        "asset_purchase",
        r.lastInsertRowid,
        [
          { account_code: "10000", debit: cost, credit: 0, description: `إضافة أصل ثابت - ${name}` },
          { account_code: "11100", debit: 0, credit: cost, description: `دفع قيمة الأصل ${name}` }
        ]
      );
    } catch (e) {}

    const created = db.prepare("SELECT * FROM fixed_assets WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/run-depreciation", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const activeAssets = db.prepare("SELECT * FROM fixed_assets WHERE status = 'active'").all() as any[];
    const today = new Date().toISOString().slice(0, 10);
    let totalDepreciated = 0;
    const details = [];

    for (const asset of activeAssets) {
      const depreciableAmount = asset.purchase_cost - asset.salvage_value;
      if (depreciableAmount <= 0) continue;

      // Annual depreciation / 12 for monthly depreciation run
      const annualDepr = depreciableAmount / asset.useful_life_years;
      const monthlyDepr = Math.round(annualDepr / 12);

      if (asset.net_book_value <= asset.salvage_value) continue;

      const actualDepr = Math.min(monthlyDepr, asset.net_book_value - asset.salvage_value);
      const newAccumulated = asset.accumulated_depreciation + actualDepr;
      const newBookValue = asset.purchase_cost - newAccumulated;

      db.prepare(`
        UPDATE fixed_assets
        SET accumulated_depreciation = ?, net_book_value = ?
        WHERE id = ?
      `).run(newAccumulated, newBookValue, asset.id);

      db.prepare(`
        INSERT INTO asset_depreciations (
          fixed_asset_id, asset_name, period_date, depreciation_amount,
          accumulated_total, net_book_value_after, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        asset.id, asset.name, today, actualDepr, newAccumulated, newBookValue, "إهلاك شهري آلي"
      );

      totalDepreciated += actualDepr;
      details.push({ asset: asset.name, amount: actualDepr });
    }

    if (totalDepreciated > 0) {
      try {
        createDoubleEntryJournal(
          today,
          `قيد احتساب الإهلاك الدوري للأصول الثابتة`,
          "depreciation",
          0,
          [
            { account_code: "60000", debit: totalDepreciated, credit: 0, description: "مصروف إهلاك الأصول الثابتة" },
            { account_code: "10000", debit: 0, credit: totalDepreciated, description: "مجمع إهلاك الأصول الثابتة" }
          ]
        );
      } catch (e) {}
    }

    res.json({
      message: "تم احتساب وقيد إهلاك الأصول الثابتة لهذا الشهر بنجاح",
      totalDepreciated,
      processedAssets: details.length
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 10. Recurring Expenses (المصروفات المتكررة) ─── */
router.get("/accounting/recurring-expenses", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM recurring_expenses ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/recurring-expenses", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { title, category, amount, frequency, next_due_date, notes } = req.body;
  if (!title || !category || !amount || !next_due_date) {
    res.status(400).json({ error: "العنوان، الفئة، المبلغ وتاريخ الاستحقاق حقول إجبارية" });
    return;
  }
  try {
    const r = db.prepare(`
      INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `).run(title, category, Number(amount), frequency || "monthly", next_due_date, notes ?? "");

    const created = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(r.lastInsertRowid);
    res.status(201).json(created);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/recurring-expenses/:id/generate", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rec = db.prepare("SELECT * FROM recurring_expenses WHERE id = ?").get(req.params.id) as any;
    if (!rec) {
      res.status(404).json({ error: "المصروف المتكرر غير موجود" });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const numAmount = Number(rec.amount);

    // Insert into expenses
    db.prepare(`
      INSERT INTO expenses (category, amount, expense_date, notes, is_recurring)
      VALUES (?, ?, ?, ?, 1)
    `).run(rec.category, numAmount, today, `مصروف متكرر: ${rec.title}`);

    // Create payment voucher
    const countRow = db.prepare("SELECT COUNT(*) as c FROM vouchers").get() as { c: number };
    const nextNum = String(countRow.c + 1);

    db.prepare(`
      INSERT INTO vouchers (voucher_number, type, party_type, party_id, party_name, amount, payment_against)
      VALUES (?, 'payment', 'general', 0, ?, ?, ?)
    `).run(nextNum, rec.title, numAmount, `سداد مصروف دوري متكرر: ${rec.title}`);

    // Calculate next due date
    const d = new Date(rec.next_due_date);
    if (rec.frequency === "monthly") d.setMonth(d.getMonth() + 1);
    else if (rec.frequency === "quarterly") d.setMonth(d.getMonth() + 3);
    else if (rec.frequency === "yearly") d.setFullYear(d.getFullYear() + 1);

    db.prepare("UPDATE recurring_expenses SET next_due_date = ? WHERE id = ?").run(d.toISOString().slice(0, 10), rec.id);

    res.json({ message: "تم توليد وقيد المصروف المتكرر وسند الصرف بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 11. Cost Centers & Fiscal Periods (مراكز التكلفة والفترات) ─── */
router.get("/accounting/cost-centers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM cost_centers ORDER BY code ASC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/cost-centers", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { code, name, notes } = req.body;
  if (!code || !name) {
    res.status(400).json({ error: "الرمز والاسم مطلوبان" });
    return;
  }
  try {
    const r = db.prepare("INSERT INTO cost_centers (code, name, notes, active) VALUES (?, ?, ?, 1)").run(code, name, notes ?? "");
    res.status(201).json(db.prepare("SELECT * FROM cost_centers WHERE id = ?").get(r.lastInsertRowid));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/fiscal-periods", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = db.prepare("SELECT * FROM fiscal_periods ORDER BY id DESC").all();
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/accounting/fiscal-periods/:id/close", (req, res) => {
  if (!requireAdmin(req, res)) return;
  const user = getAuthUser(req);
  try {
    db.prepare(`
      UPDATE fiscal_periods
      SET status = 'closed', closed_at = datetime('now', 'localtime'), closed_by = ?
      WHERE id = ?
    `).run(user?.name || "مدير النظام", req.params.id);

    res.json({ message: "تم إغلاق الفترة المالية وقفل عمليات التعديل عليها بنجاح" });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


/* ─── 12. Core Financial Statements (قائمة الدخل، الميزانية، التدفقات) ─── */
router.get("/accounting/reports/income-statement", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const salesTotal = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE status IS NULL OR status != 'cancelled'").get() as any).t;
    const receiptsTotal = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'receipt'").get() as any).t;
    
    const totalRevenues = salesTotal;

    const cogsTotal = (db.prepare(`
      SELECT COALESCE(SUM(i.quantity * COALESCE(p.cost, i.unit_price * 0.5)), 0) as t
      FROM order_items i
      LEFT JOIN products p ON p.id = i.product_id
      JOIN orders o ON o.id = i.order_id
      WHERE o.status IS NULL OR o.status != 'cancelled'
    `).get() as any).t;

    const grossProfit = totalRevenues - cogsTotal;

    const expensesList = db.prepare(`
      SELECT category, COALESCE(SUM(amount), 0) as total
      FROM expenses
      GROUP BY category
      ORDER BY total DESC
    `).all() as any[];

    const totalExpenses = expensesList.reduce((sum, item) => sum + item.total, 0);
    const netProfit = grossProfit - totalExpenses;

    res.json({
      totalRevenues,
      cogsTotal,
      grossProfit,
      expensesList,
      totalExpenses,
      netProfit,
      marginPercent: totalRevenues > 0 ? ((netProfit / totalRevenues) * 100).toFixed(1) : "0.0"
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/reports/balance-sheet", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cashInSafes = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM safes WHERE active = 1").get() as any).t;
    const cashInBanks = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM bank_accounts WHERE active = 1").get() as any).t;
    const receivables = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM customers").get() as any).t;
    
    const inventoryValuation = (db.prepare(`
      SELECT COALESCE(SUM(stock * cost), 0) as t FROM products WHERE active = 1
    `).get() as any).t;

    const currentAssets = cashInSafes + cashInBanks + receivables + inventoryValuation;

    const fixedAssetsCost = (db.prepare("SELECT COALESCE(SUM(purchase_cost), 0) as t FROM fixed_assets WHERE status = 'active'").get() as any).t;
    const accumDepreciation = (db.prepare("SELECT COALESCE(SUM(accumulated_depreciation), 0) as t FROM fixed_assets WHERE status = 'active'").get() as any).t;
    const netFixedAssets = fixedAssetsCost - accumDepreciation;

    const totalAssets = currentAssets + netFixedAssets;

    const payables = (db.prepare("SELECT COALESCE(SUM(balance), 0) as t FROM suppliers").get() as any).t;
    const currentLiabilities = payables;

    const capital = (db.prepare("SELECT COALESCE(balance, 5000000) as t FROM accounts WHERE code = '31000'").get() as any)?.t || 5000000;
    
    // Net profit calculation
    const salesTotal = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE status IS NULL OR status != 'cancelled'").get() as any).t;
    const cogsTotal = (db.prepare("SELECT COALESCE(SUM(i.quantity * COALESCE(p.cost, i.unit_price * 0.5)), 0) as t FROM order_items i JOIN orders o ON o.id = i.order_id LEFT JOIN products p ON p.id = i.product_id WHERE o.status IS NULL OR o.status != 'cancelled'").get() as any).t;
    const expTotal = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses").get() as any).t;
    const netIncome = (salesTotal - cogsTotal) - expTotal;

    const retainedEarnings = totalAssets - currentLiabilities - capital - netIncome;
    const totalEquity = capital + retainedEarnings + netIncome;

    res.json({
      currentAssets: { cashInSafes, cashInBanks, receivables, inventoryValuation, total: currentAssets },
      fixedAssets: { fixedAssetsCost, accumDepreciation, netFixedAssets },
      totalAssets,
      liabilities: { payables, total: currentLiabilities },
      equity: { capital, retainedEarnings, netIncome, total: totalEquity },
      totalLiabilitiesAndEquity: currentLiabilities + totalEquity,
      isBalanced: Math.abs(totalAssets - (currentLiabilities + totalEquity)) < 1.0
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get("/accounting/reports/cash-flow", (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const cashSales = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE payment_method = 'cash'").get() as any).t;
    const cardSales = (db.prepare("SELECT COALESCE(SUM(total), 0) as t FROM orders WHERE payment_method = 'card'").get() as any).t;
    const customerCollections = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'receipt' AND party_type = 'customer'").get() as any).t;
    
    const operatingInflows = cashSales + cardSales + customerCollections;

    const supplierPayments = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'payment' AND party_type = 'supplier'").get() as any).t;
    const operationalExpenses = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM expenses").get() as any).t;
    const employeeSalaries = (db.prepare("SELECT COALESCE(SUM(amount), 0) as t FROM vouchers WHERE type = 'payment' AND party_type = 'employee'").get() as any).t;

    const operatingOutflows = supplierPayments + operationalExpenses + employeeSalaries;
    const netOperatingCashFlow = operatingInflows - operatingOutflows;

    const fixedAssetPurchases = (db.prepare("SELECT COALESCE(SUM(purchase_cost), 0) as t FROM fixed_assets").get() as any).t;
    const netInvestingCashFlow = -fixedAssetPurchases;

    const netCashFlow = netOperatingCashFlow + netInvestingCashFlow;

    res.json({
      operatingInflows,
      operatingOutflows,
      netOperatingCashFlow,
      netInvestingCashFlow,
      netCashFlow
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
