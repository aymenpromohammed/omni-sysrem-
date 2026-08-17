import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync, renameSync, existsSync, unlinkSync } from "node:fs";

class StatementWrapper {
  private stmt: any;

  constructor(stmt: any) {
    this.stmt = stmt;
  }

  private cleanParams(params: any[]): any[] {
    return params.map(p => {
      if (p === undefined) return null;
      if (typeof p === "object" && p !== null && !(p instanceof Uint8Array) && !(p instanceof Buffer)) {
        // If it's a plain object, clone and sanitize keys
        const cleaned: Record<string, any> = {};
        for (const [k, v] of Object.entries(p)) {
          cleaned[k] = v === undefined ? null : v;
        }
        return cleaned;
      }
      return p;
    });
  }

  all(...params: any[]): any[] {
    return this.stmt.all(...this.cleanParams(params));
  }

  get(...params: any[]): any {
    return this.stmt.get(...this.cleanParams(params));
  }

  run(...params: any[]): { changes: number; lastInsertRowid: number } {
    const result = this.stmt.run(...this.cleanParams(params));
    return {
      changes: result.changes,
      lastInsertRowid: Number(result.lastInsertRowid)
    };
  }
}

class DatabaseWrapper {
  private db: DatabaseSync;

  constructor(filename: string) {
    this.db = new DatabaseSync(filename);
  }

  prepare(sql: string) {
    const stmt = this.db.prepare(sql);
    return new StatementWrapper(stmt);
  }

  exec(sql: string) {
    return this.db.exec(sql);
  }

  pragma(sql: string) {
    this.db.exec(`PRAGMA ${sql}`);
  }

  transaction(fn: (...args: any[]) => any) {
    return (...args: any[]) => {
      this.db.exec("BEGIN TRANSACTION");
      try {
        const result = fn(...args);
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.exec("ROLLBACK");
        throw error;
      }
    };
  }

  close() {
    this.db.close();
  }
}

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dbPath = process.env.OMNISYSTEM_DB_PATH || process.env.DB_PATH || path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

let dbInstance: DatabaseWrapper;
try {
  dbInstance = new DatabaseWrapper(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
  const integrity = dbInstance.prepare("PRAGMA integrity_check").get() as any;
  const resVal = integrity ? Object.values(integrity)[0] : "ok";
  if (resVal !== "ok") {
    throw new Error("Database integrity check failed: " + JSON.stringify(integrity));
  }
} catch (err: any) {
  console.error("Database connection/corruption error:", err);
  if (
    err?.message?.includes("malformed") ||
    err?.code === "SQLITE_CORRUPT" ||
    err?.message?.includes("corrupt") ||
    err?.message?.includes("integrity check")
  ) {
    if (dbInstance) {
      try {
        dbInstance.close();
      } catch (closeErr) {
        console.error("Failed to close corrupted database:", closeErr);
      }
    }

    const timestamp = Date.now();
    const backupPath = `${dbPath}.corrupt.${timestamp}`;
    const walPath = `${dbPath}-wal`;
    const shmPath = `${dbPath}-shm`;
    const walBackupPath = `${walPath}.corrupt.${timestamp}`;
    const shmBackupPath = `${shmPath}.corrupt.${timestamp}`;

    try {
      if (existsSync(dbPath)) {
        try {
          renameSync(dbPath, backupPath);
          console.warn(`Backed up corrupted database to ${backupPath}`);
        } catch (renameErr) {
          console.warn("Could not rename locked DB file. Attempting to delete instead.");
          unlinkSync(dbPath);
        }
      }
      if (existsSync(walPath)) {
        try {
          renameSync(walPath, walBackupPath);
        } catch {
          try { unlinkSync(walPath); } catch {}
        }
      }
      if (existsSync(shmPath)) {
        try {
          renameSync(shmPath, shmBackupPath);
        } catch {
          try { unlinkSync(shmPath); } catch {}
        }
      }
      console.warn("Cleared corrupted database files. Creating fresh database.");
    } catch (e) {
      console.error("Failed to backup/clear corrupted db:", e);
    }
  }
  dbInstance = new DatabaseWrapper(dbPath);
  dbInstance.pragma("journal_mode = WAL");
  dbInstance.pragma("foreign_keys = ON");
}

export const db = dbInstance;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, storedHash] = stored.split(":");
  const hash = scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(storedHash, "hex");
  return timingSafeEqual(hash, storedBuf);
}

export const sessions = new Map<string, number>();

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  try {
    db.prepare("INSERT OR REPLACE INTO user_tokens (token, user_id, created_at) VALUES (?, ?, datetime('now'))").run(token, userId);
  } catch (e) {}
  return token;
}

export function getSessionUser(token: string): number | undefined {
  if (sessions.has(token)) return sessions.get(token);
  try {
    const row = db.prepare("SELECT user_id FROM user_tokens WHERE token = ?").get(token) as { user_id: number } | undefined;
    if (row && row.user_id) {
      sessions.set(token, row.user_id);
      return row.user_id;
    }
  } catch (e) {}
  return undefined;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
  try {
    db.prepare("DELETE FROM user_tokens WHERE token = ?").run(token);
  } catch (e) {}
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_tokens (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS erp_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      device_name TEXT,
      login_time DATETIME,
      logout_time DATETIME,
      status TEXT DEFAULT 'نشط',
      branch_id INTEGER DEFAULT 1,
      language TEXT DEFAULT 'عربي'
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT,
      cost REAL DEFAULT 0.0,
      revenue REAL DEFAULT 0.0
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER UNIQUE NOT NULL,
      name TEXT NOT NULL,
      price REAL NOT NULL,
      cost REAL,
      barcode TEXT,
      category_id INTEGER REFERENCES categories(id),
      active INTEGER NOT NULL DEFAULT 1,
      stock INTEGER
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      tax REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      cash_amount REAL,
      card_amount REAL,
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      note TEXT,
      order_type TEXT NOT NULL DEFAULT 'dine-in',
      table_number TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL,
      category_id INTEGER REFERENCES categories(id),
      category_name TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS receipt_copy_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      copy_number INTEGER NOT NULL,
      label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS department_print_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
      printer_name TEXT,
      copies INTEGER NOT NULL DEFAULT 1,
      enabled INTEGER NOT NULL DEFAULT 1,
      print_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS print_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      invoice_number TEXT NOT NULL,
      receipt_type TEXT NOT NULL,
      department_name TEXT,
      printer_name TEXT,
      printed_at TEXT NOT NULL DEFAULT (datetime('now')),
      user_id INTEGER NOT NULL,
      user_name TEXT,
      copies INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'success',
      reprint_reason TEXT,
      reprint_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS printer_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      paper_width INTEGER NOT NULL DEFAULT 80,
      left_margin REAL NOT NULL DEFAULT 4,
      right_margin REAL NOT NULL DEFAULT 4,
      top_margin REAL NOT NULL DEFAULT 2,
      bottom_margin REAL NOT NULL DEFAULT 2,
      font_size INTEGER NOT NULL DEFAULT 10,
      line_spacing REAL NOT NULL DEFAULT 2,
      characters_per_line INTEGER NOT NULL DEFAULT 48
    );

    CREATE TABLE IF NOT EXISTS document_print_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT DEFAULT 'OmniSystem Pro',
      company_subtitle TEXT DEFAULT 'نظام نقاط البيع وإدارة الموارد',
      logo_url TEXT DEFAULT '/omnisystem-logo.png',
      customer_header_text TEXT DEFAULT 'كشف حساب عميل معتمد',
      customer_footer_text TEXT DEFAULT 'شكراً لتعاملكم معنا - يُرجى مراجعة الحسابات خلال 15 يوماً',
      employee_header_text TEXT DEFAULT 'كشف حساب ومسير رواتب موظف',
      employee_footer_text TEXT DEFAULT 'إدارة الموارد البشرية - التوقيع والاعتماد',
      voucher_receipt_title TEXT DEFAULT 'سند قبض',
      voucher_payment_title TEXT DEFAULT 'سند صرف',
      voucher_footer_text TEXT DEFAULT 'المحاسب _______ المدير _______ المستلم _______',
      report_header_text TEXT DEFAULT 'تقرير عام شامل',
      report_footer_text TEXT DEFAULT 'طبع بواسطة نظام OmniSystem Pro',
      accent_color TEXT DEFAULT '#2563eb'
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'in', 'out', 'adjustment'
      quantity REAL NOT NULL,
      previous_stock REAL NOT NULL,
      new_stock REAL NOT NULL,
      reason TEXT,
      reference_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      user_id INTEGER,
      user_name TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      budget REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS hr_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_number TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      department_id INTEGER REFERENCES hr_departments(id),
      basic_salary REAL NOT NULL DEFAULT 0,
      hire_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS hr_salaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      basic_salary REAL NOT NULL DEFAULT 0,
      bonuses REAL NOT NULL DEFAULT 0,
      deductions REAL NOT NULL DEFAULT 0,
      net_salary REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      payment_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS hr_attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      check_in TEXT,
      check_out TEXT,
      status TEXT NOT NULL DEFAULT 'present',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_loans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      amount REAL NOT NULL DEFAULT 0,
      type TEXT NOT NULL DEFAULT 'loan', -- 'loan' or 'temporary'
      request_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
      repayment_terms TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_tools (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      serial_number TEXT UNIQUE,
      quantity INTEGER NOT NULL DEFAULT 1,
      available_qty INTEGER NOT NULL DEFAULT 1,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_tools_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tool_id INTEGER NOT NULL REFERENCES hr_tools(id) ON DELETE CASCADE,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'out' or 'in'
      quantity INTEGER NOT NULL DEFAULT 1,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_entitlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      type TEXT NOT NULL, -- 'daily' or 'monthly'
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_leaves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      type TEXT NOT NULL, -- 'sick', 'annual', 'unpaid'
      status TEXT NOT NULL DEFAULT 'approved',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_custodies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      item_name TEXT NOT NULL,
      received_date TEXT NOT NULL,
      returned_date TEXT,
      status TEXT NOT NULL DEFAULT 'held', -- 'held' or 'returned'
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_penalties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      violation_name TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_overtime (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
      hours REAL NOT NULL DEFAULT 0,
      rate REAL NOT NULL DEFAULT 0,
      total_amount REAL NOT NULL DEFAULT 0,
      date TEXT NOT NULL,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS hr_temp_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      position TEXT,
      daily_rate REAL NOT NULL DEFAULT 0,
      hire_date TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS hr_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER REFERENCES hr_departments(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      invoice_number TEXT NOT NULL,
      order_id INTEGER,
      reason TEXT,
      total_refund REAL NOT NULL DEFAULT 0,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      customer_id INTEGER REFERENCES customers(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meal_deductions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL REFERENCES hr_employees(id),
      employee_name TEXT NOT NULL,
      employee_number TEXT NOT NULL,
      order_id INTEGER REFERENCES orders(id),
      invoice_number TEXT,
      amount REAL NOT NULL DEFAULT 0,
      cashier_id INTEGER NOT NULL REFERENCES users(id),
      cashier_name TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL, -- 'receipt' or 'payment'
      party_type TEXT NOT NULL, -- 'employee' or 'customer'
      party_id INTEGER NOT NULL,
      party_name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'دينار',
      received_from TEXT,
      payment_against TEXT,
      payment_method TEXT NOT NULL DEFAULT 'cash',
      amount_text TEXT,
      notes TEXT,
      header_title TEXT DEFAULT 'مخابز الشام للخبز العربي',
      header_subtitle TEXT DEFAULT 'Maamil Al Sham',
      logo_url TEXT DEFAULT '/omnisystem-logo.png',
      accent_color TEXT DEFAULT '#ef4444',
      bottom_text TEXT DEFAULT 'جودة الخبز ... سر ثقة عملائنا',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manual_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      party_type TEXT NOT NULL, -- 'employee' or 'customer'
      party_id INTEGER NOT NULL,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      phone TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS warehouses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      location TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS warehouse_stocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      stock REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      address TEXT,
      rating INTEGER NOT NULL DEFAULT 5,
      balance REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      status TEXT NOT NULL DEFAULT 'pending', -- pending, received, cancelled
      total REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS purchase_order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
      product_id INTEGER,
      product_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cash_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      user_name TEXT NOT NULL,
      start_time TEXT NOT NULL DEFAULT (datetime('now')),
      end_time TEXT,
      starting_cash REAL NOT NULL DEFAULT 0,
      cash_sales REAL NOT NULL DEFAULT 0,
      card_sales REAL NOT NULL DEFAULT 0,
      withdrawals REAL NOT NULL DEFAULT 0,
      deposits REAL NOT NULL DEFAULT 0,
      actual_cash REAL,
      difference REAL,
      status TEXT NOT NULL DEFAULT 'open', -- open, closed
      safe_id INTEGER REFERENCES safes(id),
      branch_id INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_number TEXT UNIQUE NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available', -- available, occupied, reserved
      section TEXT DEFAULT 'الرئيسية',
      current_order_id INTEGER REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS product_recipes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      ingredient_name TEXT NOT NULL,
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT NOT NULL DEFAULT 'جم'
    );

    CREATE TABLE IF NOT EXISTS product_modifiers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL, -- كهرباء، ماء، إيجار، مرتبات، تشغيل
      amount REAL NOT NULL,
      expense_date TEXT NOT NULL DEFAULT (date('now')),
      notes TEXT,
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      devices_limit INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER REFERENCES licenses(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT,
      last_active TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(license_id, device_id)
    );

    CREATE TABLE IF NOT EXISTS safes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ريال',
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      user_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- DOUBLE ENTRY ACCOUNTING TABLES
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL, -- 'asset', 'liability', 'equity', 'revenue', 'expense', 'cogs', 'wastage'
      parent_code TEXT,
      balance REAL NOT NULL DEFAULT 0.0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_number TEXT UNIQUE NOT NULL,
      entry_date TEXT NOT NULL DEFAULT (date('now')),
      description TEXT NOT NULL,
      source_type TEXT, -- 'sale', 'return', 'purchase', 'expense', 'voucher', 'shift_difference'
      source_id INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS journal_entry_lines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
      account_id INTEGER NOT NULL REFERENCES accounts(id),
      debit REAL NOT NULL DEFAULT 0.0,
      credit REAL NOT NULL DEFAULT 0.0,
      description TEXT
    );
    -- PROCUREMENT & PURCHASING SYSTEM TABLES
    CREATE TABLE IF NOT EXISTS purchase_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_number TEXT UNIQUE NOT NULL,
      requester_name TEXT NOT NULL,
      department TEXT,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      request_date TEXT NOT NULL,
      need_date TEXT,
      priority TEXT DEFAULT 'عادي', -- 'عادي', 'عالي', 'عاجل جداً'
      reason TEXT,
      status TEXT DEFAULT 'pending_approval', -- 'draft', 'review', 'pending_approval', 'approved', 'rejected', 'converted_to_po', 'completed', 'cancelled'
      approved_by TEXT,
      approval_date TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_request_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_id INTEGER NOT NULL REFERENCES purchase_requests(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit TEXT DEFAULT 'كجم',
      requested_qty REAL NOT NULL,
      need_date TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS purchase_rfqs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      rfq_number TEXT UNIQUE NOT NULL,
      pr_id INTEGER REFERENCES purchase_requests(id),
      item_name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT 'كجم',
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      unit_price REAL NOT NULL,
      lead_time_days INTEGER DEFAULT 1,
      total_price REAL NOT NULL,
      quality_rating REAL DEFAULT 5.0,
      payment_terms TEXT DEFAULT 'نقداً',
      min_order_qty REAL DEFAULT 1,
      return_rate_percent REAL DEFAULT 0,
      on_time_delivery_percent REAL DEFAULT 100,
      status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected'
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_number TEXT UNIQUE NOT NULL,
      po_id INTEGER REFERENCES purchase_orders(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      received_date TEXT NOT NULL,
      delivery_note_ref TEXT,
      received_by TEXT NOT NULL,
      qc_passed INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS goods_receipt_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grn_id INTEGER NOT NULL REFERENCES goods_receipt_notes(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      ordered_qty REAL NOT NULL,
      received_qty REAL NOT NULL,
      accepted_qty REAL NOT NULL,
      rejected_qty REAL DEFAULT 0,
      rejection_reason TEXT,
      temperature REAL,
      expiry_date TEXT,
      batch_number TEXT,
      quality_status TEXT DEFAULT 'مطابق'
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT UNIQUE NOT NULL,
      supplier_invoice_ref TEXT,
      po_id INTEGER REFERENCES purchase_orders(id),
      grn_id INTEGER REFERENCES goods_receipt_notes(id),
      supplier_id INTEGER REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      branch_id INTEGER DEFAULT 1,
      warehouse_id INTEGER DEFAULT 1,
      invoice_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      subtotal REAL NOT NULL DEFAULT 0,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      shipping_cost REAL DEFAULT 0,
      additional_expenses REAL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      paid_amount REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid'
      payment_method TEXT DEFAULT 'credit',
      is_direct_purchase INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS purchase_invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id),
      product_name TEXT NOT NULL,
      unit TEXT DEFAULT 'كجم',
      quantity REAL NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax REAL DEFAULT 0,
      total REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      invoice_id INTEGER REFERENCES purchase_invoices(id),
      payment_date TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'bank_transfer', 'check', 'earned_discount', 'settlement'
      check_number TEXT,
      bank_name TEXT,
      reference_number TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS supplier_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contract_number TEXT UNIQUE NOT NULL,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      title TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      agreed_amount REAL DEFAULT 0,
      payment_terms TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'expired', 'terminated'
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS supplier_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
      supplier_name TEXT NOT NULL,
      evaluation_date TEXT NOT NULL,
      price_score REAL DEFAULT 5,
      quality_score REAL DEFAULT 5,
      delivery_score REAL DEFAULT 5,
      return_score REAL DEFAULT 5,
      overall_rating REAL DEFAULT 5,
      evaluator_name TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS procurement_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      tier1_limit REAL DEFAULT 500000, -- Manager branch
      tier2_limit REAL DEFAULT 2000000, -- System Manager
      auto_reorder_enabled INTEGER DEFAULT 1,
      default_tax_rate REAL DEFAULT 15,
      default_payment_terms TEXT DEFAULT '30 يوم'
    );

    CREATE TABLE IF NOT EXISTS stock_waste_records (
      id TEXT PRIMARY KEY,
      waste_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      product_name TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id),
      quantity REAL NOT NULL DEFAULT 1,
      unit TEXT DEFAULT 'حبة',
      unit_cost REAL DEFAULT 0,
      total_cost REAL DEFAULT 0,
      reason TEXT,
      notes TEXT,
      waste_date TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      user_id INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_issue_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      issue_type TEXT,
      recipient TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_return_vouchers (
      id TEXT PRIMARY KEY,
      voucher_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      return_type TEXT,
      supplier_name TEXT,
      reason TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT UNIQUE NOT NULL,
      from_warehouse TEXT,
      to_warehouse TEXT,
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );

    CREATE TABLE IF NOT EXISTS stocktakes (
      id TEXT PRIMARY KEY,
      stocktake_number TEXT UNIQUE NOT NULL,
      warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
      notes TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      status TEXT DEFAULT 'approved',
      cancelled_at TEXT,
      cancelled_by TEXT,
      cancel_reason TEXT
    );
  `);
}

export function logAudit(userId: number, userName: string, action: string, details: string) {
  try {
    db.prepare("INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?,?,?,?)")
      .run(userId ?? null, userName ?? "system", action, details);
  } catch {}
}

function runMigrations() {
  // categories table cost/revenue migrations
  try { db.exec("ALTER TABLE categories ADD COLUMN cost REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE categories ADD COLUMN revenue REAL DEFAULT 0.0"); } catch {}

  // orders table migrations
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_id INTEGER REFERENCES categories(id)"); } catch {}
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN table_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN status TEXT DEFAULT 'completed'"); } catch {}
  try { db.exec("ALTER TABLE customers ADD COLUMN balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE printer_settings ADD COLUMN main_printer_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN allow_meal_deduction INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN can_discount INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("UPDATE users SET can_discount = 1 WHERE role IN ('admin', 'developer', 'accountant')"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN phone TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN default_branch_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'عربي'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'GMT+3'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'نشط'"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN full_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN is_employee_meal INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN employee_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE cash_shifts ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE cash_shifts ADD COLUMN branch_id INTEGER DEFAULT 1"); } catch {}
  
  // Safe box migrations and seeding
  try { db.exec("ALTER TABLE safes ADD COLUMN opening_balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN actual_balance REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN difference REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN status TEXT DEFAULT 'open'"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN branch_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN cashier_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN last_closing_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN reconciliation_reason TEXT"); } catch {}

  try { db.exec("ALTER TABLE returns ADD COLUMN approved_by INTEGER REFERENCES users(id)"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN approved_at TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN status TEXT DEFAULT 'approved'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN branch_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN warehouse_id INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN return_type TEXT DEFAULT 'مردود مبيعات نقدي'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN currency TEXT DEFAULT 'ريال'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN exchange_rate REAL DEFAULT 1.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN cost_center TEXT DEFAULT '101'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN delegate_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN driver_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN region_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN reference_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN commission_rate REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN attachments_count INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN is_suspended INTEGER DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN is_posted INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN subtotal REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN discount REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN tax REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN additional_charges REAL DEFAULT 0.0"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN entry_device TEXT DEFAULT 'WORKSTATION-01'"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN print_count INTEGER DEFAULT 1"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN edit_count INTEGER DEFAULT 0"); } catch {}

  try { db.exec("ALTER TABLE return_items ADD COLUMN item_code TEXT"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN unit TEXT DEFAULT 'حبة'"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN invoice_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN original_quantity INTEGER DEFAULT 1"); } catch {}

  // Convert old invoice numbers to clean plain integers (1, 2, 3...)
  try {
    db.exec(`
      UPDATE orders 
      SET invoice_number = CAST(id AS TEXT);
    `);
    db.exec(`
      UPDATE returns 
      SET invoice_number = CAST(COALESCE(order_id, 1) AS TEXT);
    `);
  } catch (e) {
    console.error("Migration error updating invoice numbers:", e);
  }

  try { db.exec("ALTER TABLE expenses ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try { db.exec("ALTER TABLE vouchers ADD COLUMN safe_id INTEGER REFERENCES safes(id)"); } catch {}
  try {
    const safeCount = (db.prepare("SELECT COUNT(*) as c FROM safes").get() as { c: number }).c;
    if (safeCount === 0) {
      db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?, ?, ?, ?, 1)")
        .run("الصندوق الرئيسي", 1000000, "ريال", "الصندوق الافتراضي للنظام");
    }
  } catch (e) {
    console.error("Error seeding default safe:", e);
  }
  // Ensure developer and admin users exist and have correct roles/passwords
  try {
    const devUser = db.prepare("SELECT id FROM users WHERE username='developer'").get() as any;
    const devHash = hashPassword("dev123");
    if (!devUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
        .run("developer", devHash, "مطور النظام", "developer");
    } else {
      db.prepare("UPDATE users SET role = 'developer', password_hash = ?, active = 1 WHERE username = 'developer'").run(devHash);
    }

    const adminUser = db.prepare("SELECT id FROM users WHERE username='admin'").get() as any;
    const adminHash = hashPassword("admin123");
    if (!adminUser) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
        .run("admin", adminHash, "مدير النظام", "admin");
    } else {
      db.prepare("UPDATE users SET role = 'admin', password_hash = ?, active = 1 WHERE username = 'admin'").run(adminHash);
    }
  } catch (e) {
    console.error("Error ensuring admin/developer users:", e);
  }
  // printer_settings default row
  try {
    db.exec(`INSERT OR IGNORE INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line)
             VALUES (1, 80, 1.5, 1.5, 1, 1, 11, 0, 48)`);
    // Ensure existing row also gets updated to the new paper-saving defaults
    db.exec(`UPDATE printer_settings SET paper_width = 80, left_margin = 1.5, right_margin = 1.5, top_margin = 1, bottom_margin = 1, font_size = 11, line_spacing = 0 WHERE id = 1`);
  } catch {}

  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN invoice_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE purchase_returns ADD COLUMN return_date TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN tax_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN commercial_register TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN payment_terms TEXT DEFAULT '30 يوم'"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN contact_person TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN bank_account TEXT"); } catch {}
  try { db.exec("ALTER TABLE suppliers ADD COLUMN notes TEXT"); } catch {}

  // ────────────────────────────────────────────────────────
  // ENHANCED INVENTORY SYSTEM TABLES & MIGRATIONS
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS purchase_returns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_number TEXT UNIQUE NOT NULL,
        supplier_id INTEGER REFERENCES suppliers(id),
        supplier_name TEXT NOT NULL,
        purchase_order_id INTEGER REFERENCES purchase_orders(id),
        invoice_id INTEGER REFERENCES purchase_invoices(id),
        invoice_number TEXT,
        return_date TEXT,
        total_amount REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'approved', -- 'approved', 'cancelled'
        notes TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        cancelled_at TEXT,
        cancelled_by TEXT,
        cancel_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS purchase_return_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        return_id INTEGER NOT NULL REFERENCES purchase_returns(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL DEFAULT 0,
        total_price REAL NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS internal_stock_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_number TEXT UNIQUE NOT NULL,
        branch_id INTEGER DEFAULT 1,
        requesting_department TEXT NOT NULL,
        target_warehouse_id TEXT DEFAULT 'wh-main',
        target_warehouse_name TEXT DEFAULT 'المخزن الرئيسي',
        status TEXT NOT NULL DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'preparing', 'issued', 'received', 'cancelled'
        notes TEXT,
        requested_by TEXT NOT NULL,
        approved_by TEXT,
        prepared_by TEXT,
        issued_by TEXT,
        received_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS internal_stock_request_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        request_id INTEGER NOT NULL REFERENCES internal_stock_requests(id) ON DELETE CASCADE,
        product_id INTEGER REFERENCES products(id),
        product_name TEXT NOT NULL,
        requested_qty REAL NOT NULL DEFAULT 1,
        approved_qty REAL,
        issued_qty REAL,
        unit TEXT DEFAULT 'حبة',
        unit_cost REAL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS stock_batches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        batch_number TEXT NOT NULL,
        expiry_date TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit_cost REAL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );
    `);
  } catch (e) {
    console.error("Error creating enhanced inventory tables:", e);
  }

  // Add cancellation, status & expiry columns to existing inventory tables
  const inventoryAlterations = [
    ["stock_issue_vouchers", "status", "TEXT DEFAULT 'approved'"],
    ["stock_issue_vouchers", "cancelled_at", "TEXT"],
    ["stock_issue_vouchers", "cancelled_by", "TEXT"],
    ["stock_issue_vouchers", "cancel_reason", "TEXT"],

    ["stock_return_vouchers", "status", "TEXT DEFAULT 'approved'"],
    ["stock_return_vouchers", "cancelled_at", "TEXT"],
    ["stock_return_vouchers", "cancelled_by", "TEXT"],
    ["stock_return_vouchers", "cancel_reason", "TEXT"],

    ["stock_transfers", "cancelled_at", "TEXT"],
    ["stock_transfers", "cancelled_by", "TEXT"],
    ["stock_transfers", "cancel_reason", "TEXT"],

    ["stocktakes", "cancelled_at", "TEXT"],
    ["stocktakes", "cancelled_by", "TEXT"],
    ["stocktakes", "cancel_reason", "TEXT"],

    ["stock_waste_records", "status", "TEXT DEFAULT 'approved'"],
    ["stock_waste_records", "cancelled_at", "TEXT"],
    ["stock_waste_records", "cancelled_by", "TEXT"],
    ["stock_waste_records", "cancel_reason", "TEXT"],

    ["products", "batch_number", "TEXT"],
    ["products", "expiry_date", "TEXT"],
    ["products", "min_stock", "INTEGER DEFAULT 10"]
  ];

  for (const [table, col, type] of inventoryAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Purchase Orders alterations for comprehensive procurement lifecycle
  const poAlterations = [
    ["purchase_orders", "pr_id", "INTEGER REFERENCES purchase_requests(id)"],
    ["purchase_orders", "branch_id", "INTEGER DEFAULT 1"],
    ["purchase_orders", "warehouse_id", "INTEGER DEFAULT 1"],
    ["purchase_orders", "order_date", "TEXT"],
    ["purchase_orders", "expected_delivery_date", "TEXT"],
    ["purchase_orders", "subtotal", "REAL DEFAULT 0"],
    ["purchase_orders", "discount", "REAL DEFAULT 0"],
    ["purchase_orders", "tax", "REAL DEFAULT 0"],
    ["purchase_orders", "shipping_cost", "REAL DEFAULT 0"],
    ["purchase_orders", "payment_terms", "TEXT DEFAULT 'نقداً'"],
    ["purchase_orders", "delivery_terms", "TEXT"],
    ["purchase_orders", "approval_tier", "TEXT DEFAULT 'branch'"],
    ["purchase_orders", "approved_by", "TEXT"],
    ["purchase_orders", "approved_at", "TEXT"],
    ["purchase_orders", "shipment_status", "TEXT DEFAULT 'created'"]
  ];
  for (const [table, col, type] of poAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }


  // ────────────────────────────────────────────────────────
  // OMNI ERP INTEGRATION MIGRATIONS (BRANCHES, CURRENCIES, SESSIONS)
  // ────────────────────────────────────────────────────────
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS currencies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        fraction TEXT,
        type TEXT NOT NULL, -- 'local' or 'foreign'
        exchange_rate REAL NOT NULL DEFAULT 1.0,
        active INTEGER NOT NULL DEFAULT 1
      );
    `);
    const curCount = (db.prepare("SELECT COUNT(*) as c FROM currencies").get() as { c: number }).c;
    if (curCount === 0) {
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("ريال يمني", "YER", "فلس", "local", 1.0);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("ريال سعودي", "SAR", "هللة", "foreign", 0.27);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("دولار أمريكي", "USD", "سنت", "foreign", 1.0);
      db.prepare("INSERT INTO currencies (name, symbol, fraction, type, exchange_rate) VALUES (?,?,?,?,?)").run("دينار أردني", "JOD", "قرش", "foreign", 0.71);
    }
  } catch (e) {
    console.error("Error creating currencies:", e);
  }

  const branchCols = [
    ["company_id", "INTEGER DEFAULT 1"],
    ["company_name", "TEXT DEFAULT 'شركة عماد عقلان'"],
    ["foreign_name", "TEXT DEFAULT 'Emad Aqlaan Co.'"],
    ["branch_foreign_name", "TEXT DEFAULT 'Main Branch'"],
    ["group_id", "INTEGER DEFAULT 1"],
    ["header_1", "TEXT"],
    ["header_2", "TEXT"],
    ["header_3", "TEXT"],
    ["header_1_foreign", "TEXT"],
    ["header_2_foreign", "TEXT"],
    ["header_3_foreign", "TEXT"],
    ["tax_id", "TEXT"],
    ["tax_rate", "REAL DEFAULT 15"],
    ["commercial_reg", "TEXT"],
    ["lat", "TEXT"],
    ["long", "TEXT"],
    ["city", "TEXT"],
    ["street", "TEXT"],
    ["building", "TEXT"]
  ];
  for (const [col, type] of branchCols) {
    try { db.exec(`ALTER TABLE branches ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Active Sessions & Audit list for ERP
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS erp_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        device_name TEXT NOT NULL,
        login_time TEXT NOT NULL,
        logout_time TEXT,
        status TEXT NOT NULL DEFAULT 'نشط',
        branch_id INTEGER DEFAULT 1,
        language TEXT DEFAULT 'عربي'
      );
    `);
    const sCount = (db.prepare("SELECT COUNT(*) as c FROM erp_sessions").get() as { c: number }).c;
    if (sCount === 0) {
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language) VALUES (?,?,?,?,?,?,?)")
        .run("مدير النظام", "DESKTOP-QLP03GF-EMAD", "2026-07-18 07:29:52", null, "نشط", 1, "عربي");
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language) VALUES (?,?,?,?,?,?,?)")
        .run("مدير النظام", "DESKTOP-QLP03GF-EMAD", "2026-07-18 10:52:12", "2026-07-18 11:45:00", "خروج", 1, "عربي");
      db.prepare("INSERT INTO erp_sessions (username, device_name, login_time, logout_time, status, branch_id, language) VALUES (?,?,?,?,?,?,?)")
        .run("مطور النظام", "DESKTOP-DEV-PC", "2026-07-18 09:15:30", null, "نشط", 1, "عربي");
    }
  } catch (e) {}

  // Role Permissions table for customizable granular access control
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role TEXT PRIMARY KEY,
        can_void_bills INTEGER NOT NULL DEFAULT 0,
        can_view_cost INTEGER NOT NULL DEFAULT 0,
        can_change_currencies INTEGER NOT NULL DEFAULT 0,
        can_approve_returns INTEGER NOT NULL DEFAULT 0,
        can_open_close_safe INTEGER NOT NULL DEFAULT 0,
        can_transfer_funds INTEGER NOT NULL DEFAULT 0,
        can_edit_products INTEGER NOT NULL DEFAULT 0,
        can_delete_orders INTEGER NOT NULL DEFAULT 0
      );
    `);
    const permCount = (db.prepare("SELECT COUNT(*) as c FROM role_permissions").get() as { c: number }).c;
    if (permCount === 0) {
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1)`).run("developer");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 1, 1, 1, 1, 1, 1, 1, 1)`).run("admin");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 0, 1, 0, 0, 1, 1, 0, 0)`).run("accountant");
      db.prepare(`INSERT INTO role_permissions (role, can_void_bills, can_view_cost, can_change_currencies, can_approve_returns, can_open_close_safe, can_transfer_funds, can_edit_products, can_delete_orders) VALUES (?, 0, 0, 0, 0, 1, 0, 0, 0)`).run("cashier");
    }
  } catch (e) {
    console.error("Error creating role_permissions table:", e);
  }

  // Comprehensive Accounting Tables (OmniFinance)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bank_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        iban TEXT,
        swift TEXT,
        balance REAL NOT NULL DEFAULT 0.0,
        currency TEXT NOT NULL DEFAULT 'ريال',
        branch_id INTEGER DEFAULT 1,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS inter_account_transfers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transfer_number TEXT UNIQUE NOT NULL,
        transfer_date TEXT NOT NULL,
        from_type TEXT NOT NULL, -- 'safe' or 'bank'
        from_id INTEGER NOT NULL,
        from_name TEXT NOT NULL,
        to_type TEXT NOT NULL, -- 'safe' or 'bank'
        to_id INTEGER NOT NULL,
        to_name TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'ريال',
        notes TEXT,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS fixed_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL, -- 'أجهزة ومعدات', 'وسائل نقل', 'أثاث وديكور', 'مباني وعقارات'
        purchase_date TEXT NOT NULL,
        purchase_cost REAL NOT NULL DEFAULT 0.0,
        salvage_value REAL NOT NULL DEFAULT 0.0,
        useful_life_years INTEGER NOT NULL DEFAULT 5,
        accumulated_depreciation REAL NOT NULL DEFAULT 0.0,
        net_book_value REAL NOT NULL DEFAULT 0.0,
        branch_id INTEGER DEFAULT 1,
        location TEXT,
        responsible_person TEXT,
        status TEXT NOT NULL DEFAULT 'active', -- 'active', 'sold', 'scrapped'
        account_code TEXT DEFAULT '12100',
        accum_depr_account_code TEXT DEFAULT '12200',
        depr_expense_account_code TEXT DEFAULT '61500',
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS asset_depreciations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fixed_asset_id INTEGER NOT NULL REFERENCES fixed_assets(id) ON DELETE CASCADE,
        asset_name TEXT NOT NULL,
        period_date TEXT NOT NULL,
        depreciation_amount REAL NOT NULL,
        accumulated_total REAL NOT NULL,
        net_book_value_after REAL NOT NULL,
        journal_entry_id INTEGER REFERENCES journal_entries(id),
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS recurring_expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        frequency TEXT NOT NULL DEFAULT 'monthly', -- 'monthly', 'quarterly', 'yearly'
        next_due_date TEXT NOT NULL,
        safe_id INTEGER REFERENCES safes(id),
        bank_account_id INTEGER REFERENCES bank_accounts(id),
        cost_center_id INTEGER,
        auto_generate INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS bank_reconciliations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reconciliation_number TEXT UNIQUE NOT NULL,
        bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
        bank_name TEXT NOT NULL,
        statement_date TEXT NOT NULL,
        statement_balance REAL NOT NULL DEFAULT 0.0,
        book_balance REAL NOT NULL DEFAULT 0.0,
        difference REAL NOT NULL DEFAULT 0.0,
        status TEXT NOT NULL DEFAULT 'completed', -- 'draft', 'completed'
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
      );

      CREATE TABLE IF NOT EXISTS bank_reconciliation_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reconciliation_id INTEGER NOT NULL REFERENCES bank_reconciliations(id) ON DELETE CASCADE,
        transaction_date TEXT NOT NULL,
        description TEXT NOT NULL,
        amount REAL NOT NULL,
        type TEXT NOT NULL, -- 'deposit', 'withdrawal'
        is_matched INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS cost_centers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        branch_id INTEGER DEFAULT 1,
        notes TEXT,
        active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS fiscal_periods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        period_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
        closed_at TEXT,
        closed_by TEXT,
        notes TEXT
      );
    `);
  } catch (e) {
    console.error("Error creating OmniFinance tables:", e);
  }

  // Column alterations for accounting compatibility
  const acctAlterations = [
    ["vouchers", "bank_account_id", "INTEGER REFERENCES bank_accounts(id)"],
    ["vouchers", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["journal_entries", "status", "TEXT DEFAULT 'posted'"],
    ["journal_entries", "is_reversed", "INTEGER DEFAULT 0"],
    ["journal_entries", "reversal_of_id", "INTEGER REFERENCES journal_entries(id)"],
    ["journal_entries", "user_id", "INTEGER REFERENCES users(id)"],
    ["journal_entry_lines", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["expenses", "cost_center_id", "INTEGER REFERENCES cost_centers(id)"],
    ["expenses", "bank_account_id", "INTEGER REFERENCES bank_accounts(id)"],
    ["expenses", "is_recurring", "INTEGER DEFAULT 0"]
  ];
  for (const [table, col, type] of acctAlterations) {
    try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch {}
  }

  // Seed default bank accounts if empty
  try {
    const bankCount = (db.prepare("SELECT COUNT(*) as c FROM bank_accounts").get() as { c: number }).c;
    if (bankCount === 0) {
      db.prepare("INSERT INTO bank_accounts (bank_name, account_number, iban, balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?)")
        .run("البنك الأهلي - الحساب الرئيسي", "1029384756", "SA03800000001029384756", 4200000, "ريال", "الحساب البنكي الأول لتحويلات الكروت والشبكة");
      db.prepare("INSERT INTO bank_accounts (bank_name, account_number, iban, balance, currency, notes) VALUES (?, ?, ?, ?, ?, ?)")
        .run("بنك الراجحي - حساب المشتريات", "5049382710", "SA92800000005049382710", 1850000, "ريال", "حساب الموردين والمشتروات الذكية");
    }
  } catch (e) {}

  // Seed default cost centers if empty
  try {
    const ccCount = (db.prepare("SELECT COUNT(*) as c FROM cost_centers").get() as { c: number }).c;
    if (ccCount === 0) {
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-101", "فرع صنعاء الرئيسي", 1, "المركز الرئيسي والمطعم");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-102", "فرع عدن - صالة الضيافة", 2, "فرع المحافظات الجنوبية");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-201", "قسم التوصيل والسفري", 1, "إدارة أسطول الدليفري");
      db.prepare("INSERT INTO cost_centers (code, name, branch_id, notes) VALUES (?, ?, ?, ?)").run("CC-301", "المطبخ المركزي والمخبز", 1, "التجهيز والتصنيع");
    }
  } catch (e) {}

  // Seed default fiscal periods if empty
  try {
    const fpCount = (db.prepare("SELECT COUNT(*) as c FROM fiscal_periods").get() as { c: number }).c;
    if (fpCount === 0) {
      db.prepare("INSERT INTO fiscal_periods (period_code, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("FY-2026", "السنة المالية 2026", "2026-01-01", "2026-12-31", "open");
      db.prepare("INSERT INTO fiscal_periods (period_code, name, start_date, end_date, status) VALUES (?, ?, ?, ?, ?)")
        .run("FY-2025", "السنة المالية 2025 (مغلقة)", "2025-01-01", "2025-12-31", "closed");
    }
  } catch (e) {}

  // Seed fixed assets if empty
  try {
    const faCount = (db.prepare("SELECT COUNT(*) as c FROM fixed_assets").get() as { c: number }).c;
    if (faCount === 0) {
      db.prepare(`
        INSERT INTO fixed_assets (asset_code, name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("AST-001", "فرن آلي دوار إيطالي", "أجهزة ومعدات", "2025-01-15", 1200000, 100000, 5, 220000, 980000, "المطبخ المركزي", "الشيف الرئيسي");

      db.prepare(`
        INSERT INTO fixed_assets (asset_code, name, category, purchase_date, purchase_cost, salvage_value, useful_life_years, accumulated_depreciation, net_book_value, location, responsible_person)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run("AST-002", "سيارة تويوتا هايلوكس دليفري", "وسائل نقل", "2025-06-01", 1800000, 300000, 5, 300000, 1500000, "موقف الفرع الرئيسي", "مشرف التوصيل");
    }
  } catch (e) {}

  // Seed recurring expenses if empty
  try {
    const reCount = (db.prepare("SELECT COUNT(*) as c FROM recurring_expenses").get() as { c: number }).c;
    if (reCount === 0) {
      db.prepare(`
        INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("إيجار مقر الفرع الرئيسي", "إيجار", 500000, "monthly", "2026-09-01", "استحقاق إيجار شهري لمالك العقار");

      db.prepare(`
        INSERT INTO recurring_expenses (title, category, amount, frequency, next_due_date, notes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run("اشتراك إنترنت فايبر ونظام السحاب", "اتصالات وإنترنت", 45000, "monthly", "2026-08-25", "الفاتورة الشهرية لخدمة الاتصال الدائم");
    }
  } catch (e) {}

  // Seed Chart of Accounts (COA)
  try {
    const accCount = (db.prepare("SELECT COUNT(*) as c FROM accounts").get() as { c: number }).c;
    if (accCount === 0) {
      const standardAccounts = [
        // Assets (10000)
        { code: "10000", name: "الأصول", type: "asset", parent_code: null },
        { code: "11000", name: "الأصول المتداولة", type: "asset", parent_code: "10000" },
        { code: "11100", name: "الصندوق الرئيسي", type: "asset", parent_code: "11000" },
        { code: "11101", name: "صندوق كاشير الصالة", type: "asset", parent_code: "11000" },
        { code: "11200", name: "الذمم المدينة (العملاء)", type: "asset", parent_code: "11000" },
        { code: "11300", name: "المخزون والسلع", type: "asset", parent_code: "11000" },
        
        // Liabilities (20000)
        { code: "20000", name: "الالتزامات", type: "liability", parent_code: null },
        { code: "21000", name: "الالتزامات المتداولة", type: "liability", parent_code: "20000" },
        { code: "21100", name: "الذمم الدائنة (الموردين)", type: "liability", parent_code: "21000" },
        { code: "21200", name: "رواتب وأجور مستحقة", type: "liability", parent_code: "21000" },
        
        // Equity (30000)
        { code: "30000", name: "حقوق الملكية", type: "equity", parent_code: null },
        { code: "31000", name: "رأس المال المعتمد", type: "equity", parent_code: "30000" },
        { code: "32000", name: "الأرباح والخسائر المبقاة", type: "equity", parent_code: "30000" },
        
        // Revenue (40000)
        { code: "40000", name: "الإيرادات", type: "revenue", parent_code: null },
        { code: "41000", name: "إيرادات المبيعات والخدمات", type: "revenue", parent_code: "40000" },
        
        // COGS (50000)
        { code: "50000", name: "تكلفة المبيعات (COGS)", type: "cogs", parent_code: null },
        { code: "51000", name: "تكلفة المواد الخام والسلع المباعة", type: "cogs", parent_code: "50000" },
        
        // Expenses (60000)
        { code: "60000", name: "المصروفات", type: "expense", parent_code: null },
        { code: "61000", name: "المصاريف التشغيلية والإدارية والعمومية", type: "expense", parent_code: "60000" },
        { code: "62000", name: "مصروف تالف ومفقودات المطبخ", type: "expense", parent_code: "60000" },
        { code: "63000", name: "مصروف الرواتب والأجور للعمال", type: "expense", parent_code: "60000" }
      ];

      const stmt = db.prepare("INSERT INTO accounts (code, name, type, parent_code, balance) VALUES (?, ?, ?, ?, 0.0)");
      for (const acc of standardAccounts) {
        stmt.run(acc.code, acc.name, acc.type, acc.parent_code);
      }
    }
  } catch (e) {
    console.error("Error seeding chart of accounts:", e);
  }

  // Create views for compatibility with reports and queries
  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS cashier_shifts AS
      SELECT id, user_id, user_name, start_time, end_time, starting_cash, cash_sales, card_sales, withdrawals, deposits, actual_cash, difference as variance, status
      FROM cash_shifts;
    `);
  } catch (e) {}

  try {
    db.exec(`
      CREATE VIEW IF NOT EXISTS waste_records AS
      SELECT id, waste_number, warehouse_name, product_name, product_id, quantity, unit, unit_cost as cost, total_cost, reason, notes, created_at as waste_date, user_id, status
      FROM stock_waste_records;
    `);
  } catch (e) {}
}

function seedData() {
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (userCount > 0) return;

  const adminHash = hashPassword("admin123");
  const cashierHash = hashPassword("cashier123");
  const devHash = hashPassword("dev123");

  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("developer", devHash, "مطور النظام", "developer");
  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("admin", adminHash, "مدير النظام", "admin");
  db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
    .run("cashier", cashierHash, "الكاشير الأول", "cashier");

  const categories = [
    { name: "المطبخ", color: "#f59e0b" },
    { name: "العصائر", color: "#3b82f6" },
    { name: "الحلويات", color: "#ec4899" },
    { name: "الشاورما", color: "#10b981" },
  ];
  const insertCat = db.prepare("INSERT INTO categories (name, color) VALUES (?,?)");
  const catIds: number[] = [];
  for (const cat of categories) {
    const r = insertCat.run(cat.name, cat.color);
    catIds.push(r.lastInsertRowid as number);
  }

  const products = [
    { number: 1, name: "برياني دجاج", price: 14000, cost: 8000, category_id: catIds[0] },
    { number: 2, name: "رز أبيض", price: 6500, cost: 3000, category_id: catIds[0] },
    { number: 3, name: "دجاج مشوي", price: 18000, cost: 10000, category_id: catIds[0] },
    { number: 4, name: "لحم مشوي", price: 25000, cost: 15000, category_id: catIds[0] },
    { number: 5, name: "سمك مقلي", price: 20000, cost: 12000, category_id: catIds[0] },
    { number: 6, name: "عصير برتقال", price: 3000, cost: 1000, category_id: catIds[1] },
    { number: 7, name: "شاي", price: 1500, cost: 500, category_id: catIds[1] },
    { number: 8, name: "ماء معدني", price: 1000, cost: 300, category_id: catIds[1] },
    { number: 9, name: "كولا", price: 2000, cost: 800, category_id: catIds[1] },
    { number: 10, name: "كيك شوكولاتة", price: 5000, cost: 2500, category_id: catIds[2] },
    { number: 11, name: "آيس كريم", price: 4000, cost: 1500, category_id: catIds[2] },
    { number: 12, name: "شاورما دجاج", price: 8000, cost: 4000, category_id: catIds[3] },
    { number: 13, name: "شاورما لحم", price: 10000, cost: 5000, category_id: catIds[3] },
    { number: 14, name: "فتة", price: 8000, cost: 4000, category_id: catIds[0] },
    { number: 15, name: "مرق لحم", price: 5000, cost: 2000, category_id: catIds[0] },
  ];

  const insertProd = db.prepare(
    "INSERT INTO products (number, name, price, cost, category_id, active) VALUES (?,?,?,?,?,1)"
  );
  for (const p of products) {
    insertProd.run(p.number, p.name, p.price, p.cost, p.category_id);
  }

  const defaultSettings: [string, string][] = [
    ["businessName", "مطعم إتقان"],
    ["address", "الرياض، المملكة العربية السعودية"],
    ["phone", "0501234567"],
    ["taxNumber", "300000000000003"],
    ["taxRate", "15"],
    ["currency", "ريال"],
    ["receiptMessage", "شكراً لزيارتكم - يسعدنا خدمتكم"],
    ["printLogo", "true"],
    ["printQr", "false"],
    ["showCashier", "true"],
    ["showCustomer", "true"],
    ["receiptPaperSize", "80mm"],
    ["showOrderNumber", "true"],
    ["showTableNumber", "true"],
    ["showDateTime", "true"],
    ["showBarcode", "false"],
    ["showOrderType", "true"],
    ["showTax", "true"],
    ["showDiscount", "true"],
    ["showNotes", "true"],
    ["autoPrintTrigger", "after_payment"],
    ["maxReprintCount", "3"],
    ["masterCopiesCount", "1"],
    ["logoUrl", ""],
  ];
  const insertSetting = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?,?)");
  for (const [key, value] of defaultSettings) {
    insertSetting.run(key, value);
  }

  // Seed sample suppliers if empty
  const suppCount = (db.prepare("SELECT count(*) as c FROM suppliers").get() as any)?.c || 0;
  if (suppCount === 0) {
    const insertSupp = db.prepare(`
      INSERT INTO suppliers (name, contact_person, phone, email, tax_number, commercial_register, address, payment_terms, bank_name, bank_account, rating, balance, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertSupp.run("شركة التوريدات الغذائية المتحدة", "أحمد السعيد", "0501122334", "sales@united-food.sa", "300123456700003", "1010554433", "الرياض - طريق الملك فهد", "30 يوم", "مصرف الراجحي", "SA4480000123608010123456", 5, 0, "مورد رئيسي للمواد الغذائية والمشروبات");
    insertSupp.run("مؤسسة الألبان واللحوم الطازجة", "خالد المنصور", "0559988776", "info@freshmeats.sa", "300765432100003", "1010667788", "جدة - المنطقة الصناعية", "نقداً عند الاستلام", "البنك الأهلي السعودي", "SA2210000045608010654321", 4, 0, "توريد يومي للمنتجات الطازجة");
    insertSupp.run("شركة التعبئة والتغليف الحديثة", "محمد العتيبي", "0543322110", "contact@packmodern.com", "300998811200003", "1010332211", "الدمام - المدينة الصناعية الثانية", "15 يوم", "بنك الرياض", "SA8820000078908010987654", 5, 0, "مواد وأكياس التغليف والطباعة");
  }

  // Seed receipt copy configs
  const copyConfigs = [
    { copy_number: 1, label: "نسخة العميل" },
    { copy_number: 2, label: "نسخة الكاشير" },
    { copy_number: 3, label: "نسخة المحاسبة" },
    { copy_number: 4, label: "نسخة الأرشيف" },
  ];
  const insertCopy = db.prepare("INSERT OR IGNORE INTO receipt_copy_configs (copy_number, label, enabled) VALUES (?,?,?)");
  for (const c of copyConfigs) {
    insertCopy.run(c.copy_number, c.label, c.copy_number <= 2 ? 1 : 0);
  }

  // Seed department print configs
  const insertDept = db.prepare(
    "INSERT OR IGNORE INTO department_print_configs (category_id, printer_name, copies, enabled, print_order) VALUES (?,?,?,?,?)"
  );
  catIds.forEach((cid, idx) => {
    insertDept.run(cid, null, 1, 1, idx + 1);
  });

  const now = new Date();
  const adminUser = db.prepare("SELECT id FROM users WHERE username='admin'").get() as { id: number };

  const insertOrder = db.prepare(`
    INSERT INTO orders (invoice_number, subtotal, discount, tax, total, payment_method, cash_amount, user_id, created_at)
    VALUES (?,?,?,?,?,?,?,?,?)
  `);
  const insertItem = db.prepare(`
    INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, total, category_id, category_name)
    VALUES (?,?,?,?,?,?,?,?)
  `);

  for (let i = 0; i < 20; i++) {
    const d = new Date(now);
    d.setHours(d.getHours() - i * 2);
    const subtotal = 20500 + i * 3000;
    const tax = Math.round(subtotal * 0.15);
    const total = subtotal + tax;
    const invNum = String(1001 + i);
    const result = insertOrder.run(invNum, subtotal, 0, tax, total, "cash", total, adminUser.id, d.toISOString());
    const orderId = result.lastInsertRowid;
    insertItem.run(orderId, 1, "برياني دجاج", 4, 14000, 56000, catIds[0], "المطبخ");
    insertItem.run(orderId, 2, "رز أبيض", 5, 6500, 32500, catIds[0], "المطبخ");
  }

  // Seed a default license to prevent lockout on first use
  const licCount = (db.prepare("SELECT COUNT(*) as c FROM licenses").get() as { c: number }).c;
  if (licCount === 0) {
    db.prepare(`
      INSERT INTO licenses (license_key, client_name, devices_limit, expires_at, active)
      VALUES (?, ?, ?, ?, 1)
    `).run("ITQAN-SOFT-DEV-TRIAL-2027", "مطعم المذاق الراقي", 10, "2027-12-31");
  }
}

initSchema();
runMigrations();
seedData();

export function createDoubleEntryJournal(
  entryDate: string,
  description: string,
  sourceType: string,
  sourceId: number,
  lines: { account_code: string; debit: number; credit: number; description?: string }[]
): number {
  const totalDebit = lines.reduce((sum, l) => sum + (l.debit || 0), 0);
  const totalCredit = lines.reduce((sum, l) => sum + (l.credit || 0), 0);

  // Allow small rounding tolerance, balance it
  const diff = Math.abs(totalDebit - totalCredit);
  if (diff > 0.01) {
    throw new Error(`القيد غير متزن! إجمالي المدين: ${totalDebit}، إجمالي الدائن: ${totalCredit}`);
  }

  // Get next sequential entry number
  const countRow = db.prepare("SELECT COUNT(*) as c FROM journal_entries").get() as { c: number };
  const entryNumber = `JV-${String(countRow.c + 1).padStart(5, "0")}`;

  // Create standard date string if empty
  const cleanDate = entryDate || new Date().toISOString().slice(0, 10);

  // Check if date falls in a closed fiscal period
  const closedPeriod = db.prepare(`
    SELECT name FROM fiscal_periods 
    WHERE status = 'closed' 
    AND ? BETWEEN start_date AND end_date
  `).get(cleanDate) as { name: string };

  if (closedPeriod) {
    throw new Error(`لا يمكن تسجيل القيد في تاريخ ${cleanDate} لأن الفترة المالية "${closedPeriod.name}" مغلقة.`);
  }

  // Run transaction manually
  const entryRes = db.prepare(`
    INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(entryNumber, cleanDate, description, sourceType, sourceId);

  const entryId = entryRes.lastInsertRowid;

  for (const line of lines) {
    const acc = db.prepare("SELECT id, type FROM accounts WHERE code = ?").get(line.account_code) as { id: number; type: string };
    if (!acc) {
      throw new Error(`الحساب ذو الرمز ${line.account_code} غير موجود في دليل الحسابات!`);
    }

    db.prepare(`
      INSERT INTO journal_entry_lines (journal_entry_id, account_id, debit, credit, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(entryId, acc.id, line.debit || 0, line.credit || 0, line.description || null);

    // Update account balance
    const isDebitNormal = ["asset", "expense", "cogs", "wastage"].includes(acc.type);
    const amountChange = isDebitNormal
      ? (line.debit - line.credit)
      : (line.credit - line.debit);

    db.prepare("UPDATE accounts SET balance = balance + ? WHERE id = ?").run(amountChange, acc.id);
  }

  return entryId;
}
