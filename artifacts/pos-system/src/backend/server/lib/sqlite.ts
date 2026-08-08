import path from "node:path";
import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";

let DatabaseEngine: any;
let isNodeSqlite = false;

try {
  // Try built-in node:sqlite (available in Node.js 22+ & Electron)
  const sqliteModule = require("node:sqlite");
  DatabaseEngine = sqliteModule.DatabaseSync;
  isNodeSqlite = true;
} catch {
  try {
    DatabaseEngine = require("better-sqlite3");
  } catch {
    console.error("No SQLite engine found!");
    throw new Error("Could not initialize SQLite database");
  }
}

const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
  ? path.resolve(process.cwd(), "../..")
  : process.cwd();

const dbPath = process.env.OMNISYSTEM_DB_PATH
  ? path.resolve(process.env.OMNISYSTEM_DB_PATH)
  : path.resolve(workspaceRoot, "artifacts/api-server/data/pos.db");

mkdirSync(path.dirname(dbPath), { recursive: true });

class DatabaseWrapper {
  private rawDb: any;
  private isNodeSqlite: boolean;

  constructor(filename: string) {
    this.isNodeSqlite = isNodeSqlite;
    this.rawDb = new DatabaseEngine(filename);
  }

  pragma(sql: string) {
    if (this.isNodeSqlite) {
      this.rawDb.exec(`PRAGMA ${sql};`);
    } else {
      this.rawDb.pragma(sql);
    }
  }

  exec(sql: string) {
    return this.rawDb.exec(sql);
  }

  prepare(sql: string) {
    const stmt = this.rawDb.prepare(sql);
    return {
      run: (...params: any[]) => {
        const res = stmt.run(...params);
        return {
          lastInsertRowid: res?.lastInsertRowid,
          changes: res?.changes,
        };
      },
      get: (...params: any[]) => {
        return stmt.get(...params);
      },
      all: (...params: any[]) => {
        return stmt.all(...params);
      },
    };
  }

  transaction<T extends (...args: any[]) => any>(fn: T): T {
    if (!this.isNodeSqlite && typeof this.rawDb.transaction === "function") {
      return this.rawDb.transaction(fn);
    }
    const self = this;
    return ((...args: any[]) => {
      self.exec("BEGIN IMMEDIATE");
      try {
        const res = fn(...args);
        self.exec("COMMIT");
        return res;
      } catch (err) {
        self.exec("ROLLBACK");
        throw err;
      }
    }) as T;
  }
}

export const db = new DatabaseWrapper(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  if (!stored) return false;
  if (!stored.includes(":")) {
    return password === stored;
  }
  const [salt, storedHash] = stored.split(":");
  if (!salt || !storedHash) return false;
  try {
    const hash = scryptSync(password, salt, 64);
    const storedBuf = Buffer.from(storedHash, "hex");
    if (hash.length !== storedBuf.length) return false;
    return timingSafeEqual(hash, storedBuf);
  } catch (e) {
    return false;
  }
}

export const sessions = new Map<string, number>();

export function createSession(userId: number): string {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, userId);
  try {
    db.prepare("INSERT OR REPLACE INTO user_sessions (token, user_id) VALUES (?, ?)").run(token, userId);
  } catch (e) {
    console.error("Error persisting user_sessions:", e);
  }
  return token;
}

export function getSessionUser(token: string): number | undefined {
  if (!token) return undefined;
  if (sessions.has(token)) {
    return sessions.get(token);
  }
  try {
    const row = db.prepare("SELECT user_id FROM user_sessions WHERE token=?").get(token) as any;
    if (row && row.user_id) {
      sessions.set(token, row.user_id);
      return row.user_id;
    }
  } catch (e) {
    //
  }
  return undefined;
}

export function deleteSession(token: string): void {
  sessions.delete(token);
  try {
    db.prepare("DELETE FROM user_sessions WHERE token=?").run(token);
  } catch (e) {
    //
  }
}

export function logAudit(userId: number | null | undefined, userName: string | null | undefined, action: string, details?: string) {
  try {
    db.prepare("INSERT INTO audit_logs (user_id, user_name, action, details) VALUES (?, ?, ?, ?)").run(
      userId ?? null,
      userName ?? "",
      action,
      details ?? ""
    );
  } catch (e) {
    console.error("Error logging audit:", e);
  }
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cashier',
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT
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
      invoice_number TEXT UNIQUE NOT NULL,
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
      left_margin REAL NOT NULL DEFAULT 8,
      right_margin REAL NOT NULL DEFAULT 1.5,
      top_margin REAL NOT NULL DEFAULT 1,
      bottom_margin REAL NOT NULL DEFAULT 1,
      font_size INTEGER NOT NULL DEFAULT 10,
      line_spacing REAL NOT NULL DEFAULT 2,
      characters_per_line INTEGER NOT NULL DEFAULT 48
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

    CREATE TABLE IF NOT EXISTS safes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      balance REAL NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'ريال',
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_number TEXT NOT NULL,
      type TEXT NOT NULL,
      party_type TEXT NOT NULL,
      party_id TEXT,
      party_name TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL DEFAULT 'ريال',
      safe_id INTEGER REFERENCES safes(id),
      received_from TEXT,
      payment_against TEXT,
      payment_method TEXT DEFAULT 'cash',
      amount_text TEXT,
      notes TEXT,
      header_title TEXT,
      header_subtitle TEXT,
      logo_url TEXT,
      accent_color TEXT,
      bottom_text TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS manual_ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date TEXT NOT NULL,
      description TEXT NOT NULL,
      party_type TEXT NOT NULL,
      party_id TEXT NOT NULL,
      debit REAL NOT NULL DEFAULT 0,
      credit REAL NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS currencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      symbol TEXT NOT NULL,
      exchange_rate REAL NOT NULL DEFAULT 1.0,
      is_default INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_name TEXT,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS restaurant_tables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      number INTEGER NOT NULL,
      name TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'available',
      section TEXT
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      name_ar TEXT NOT NULL,
      unit TEXT NOT NULL,
      current_stock REAL NOT NULL DEFAULT 0,
      min_stock REAL NOT NULL DEFAULT 0,
      max_stock REAL,
      cost_per_unit REAL NOT NULL DEFAULT 0,
      supplier TEXT
    );

    CREATE TABLE IF NOT EXISTS restaurant_employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'waiter',
      salary REAL,
      is_active INTEGER NOT NULL DEFAULT 1,
      join_date TEXT
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_key TEXT UNIQUE NOT NULL,
      client_name TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      machine_id TEXT,
      max_devices INTEGER NOT NULL DEFAULT 1,
      expire_date TEXT,
      created_date TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_activations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      machine_id TEXT NOT NULL,
      activated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS license_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      user TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function runMigrations() {
  // orders table migrations
  try { db.exec("CREATE TABLE IF NOT EXISTS user_sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT (datetime('now')))"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN approved_by TEXT"); } catch {}
  try { db.exec("ALTER TABLE returns ADD COLUMN status TEXT DEFAULT 'approved'"); } catch {}
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_id INTEGER REFERENCES categories(id)"); } catch {}
  try { db.exec("ALTER TABLE order_items ADD COLUMN category_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN order_type TEXT NOT NULL DEFAULT 'dine-in'"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN table_number TEXT"); } catch {}
  try { db.exec("ALTER TABLE printer_settings ADD COLUMN main_printer_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE users ADD COLUMN allow_meal_deduction INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN is_employee_meal INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN employee_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN refund_status TEXT NOT NULL DEFAULT 'none'"); } catch {}
  try { db.exec("ALTER TABLE orders ADD COLUMN total_refunded REAL NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE order_items ADD COLUMN returned_quantity INTEGER NOT NULL DEFAULT 0"); } catch {}
  try { db.exec("ALTER TABLE return_items ADD COLUMN order_item_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE vouchers ADD COLUMN safe_id INTEGER"); } catch {}
  try { db.exec("ALTER TABLE vouchers ADD COLUMN currency TEXT NOT NULL DEFAULT 'ريال'"); } catch {}
  try { db.exec("ALTER TABLE safes ADD COLUMN currency TEXT NOT NULL DEFAULT 'ريال'"); } catch {}

  // ERP Tables & Migrations
  try { db.exec(`CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, address TEXT, phone TEXT, active INTEGER DEFAULT 1,
    company_id INTEGER DEFAULT 1, company_name TEXT, foreign_name TEXT, branch_foreign_name TEXT,
    header_1 TEXT, header_2 TEXT, header_3 TEXT, header_1_foreign TEXT, header_2_foreign TEXT, header_3_foreign TEXT,
    tax_id TEXT, tax_rate REAL DEFAULT 15, commercial_reg TEXT, lat TEXT, long TEXT, city TEXT, street TEXT, building TEXT
  )`); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN company_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN foreign_name TEXT"); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN header_1 TEXT"); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN tax_id TEXT"); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN tax_rate REAL DEFAULT 15"); } catch {}
  try { db.exec("ALTER TABLE branches ADD COLUMN city TEXT"); } catch {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, branch_id INTEGER REFERENCES branches(id), name TEXT NOT NULL, location TEXT, active INTEGER DEFAULT 1,
    foreign_name TEXT, keeper TEXT, country TEXT, city TEXT, price_tier TEXT, is_main INTEGER DEFAULT 0, is_disabled INTEGER DEFAULT 0
  )`); } catch {}

  try { db.exec("ALTER TABLE currencies ADD COLUMN fraction TEXT DEFAULT 'فلس'"); } catch {}
  try { db.exec("ALTER TABLE currencies ADD COLUMN type TEXT DEFAULT 'foreign'"); } catch {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS erp_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, device_name TEXT, login_time TEXT, logout_time TEXT, status TEXT DEFAULT 'نشط', branch_id INTEGER DEFAULT 1, language TEXT DEFAULT 'عربي'
  )`); } catch {}

  try { db.exec(`CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, role TEXT UNIQUE NOT NULL, name TEXT NOT NULL, permissions TEXT
  )`); } catch {}

  // printer_settings default row
  try {
    db.exec(`INSERT OR IGNORE INTO printer_settings (id, paper_width, left_margin, right_margin, top_margin, bottom_margin, font_size, line_spacing, characters_per_line)
             VALUES (1, 80, 8, 1.5, 1, 1, 10, 2, 48)`);
    db.exec(`UPDATE printer_settings SET left_margin = 8, right_margin = 1.5, top_margin = 1, bottom_margin = 1 WHERE id = 1 AND left_margin = 4 AND right_margin = 4`);
  } catch {}

  // Seed default safes if empty
  try {
    const safesCount = (db.prepare("SELECT COUNT(*) as c FROM safes").get() as any)?.c ?? 0;
    if (safesCount === 0) {
      const insertSafe = db.prepare("INSERT INTO safes (name, balance, currency, notes, active) VALUES (?,?,?,?,1)");
      insertSafe.run("الصندوق الرئيسي (الريال)", 50000, "ريال", "الصندوق الرئيسي للمبيعات اليومية والمصروفات");
      insertSafe.run("صندوق الدولار", 2500, "دولار", "صندوق المبيعات بالدولار الأمريكي");
      insertSafe.run("خزينة البنك والشبكة", 120000, "ريال", "حساب الحوالات البنكية ومبيعات الشبكة");
      insertSafe.run("صندوق الدينار", 1200, "دينار", "صندوق المعاملات بالدينار الأردني");
    }
  } catch (e) { console.error("Error seeding safes:", e); }

  // Seed default currencies if empty
  try {
    const currenciesCount = (db.prepare("SELECT COUNT(*) as c FROM currencies").get() as any)?.c ?? 0;
    if (currenciesCount === 0) {
      const insertCur = db.prepare("INSERT INTO currencies (code, name, symbol, exchange_rate, is_default, active) VALUES (?,?,?,?,?,1)");
      insertCur.run("SAR", "ريال سعودي", "ر.س / ريال", 1.0, 1);
      insertCur.run("USD", "دولار أمريكي", "دولار / $", 3.75, 0);
      insertCur.run("YER", "ريال يمني", "ر.ي", 0.002, 0);
      insertCur.run("JOD", "دينار أردني", "د.أ / دينار", 5.29, 0);
      insertCur.run("EUR", "يورو", "€ / يورو", 4.10, 0);
      insertCur.run("AED", "درهم إماراتي", "د.إ", 1.02, 0);
    }
  } catch (e) { console.error("Error seeding currencies:", e); }
}

function seedData() {
  const userCount = (db.prepare("SELECT COUNT(*) as c FROM users").get() as { c: number }).c;
  if (userCount > 0) return;

  const adminHash = hashPassword("admin123");
  const cashierHash = hashPassword("cashier123");

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
    const invNum = `INV-${String(i + 1).padStart(4, "0")}`;
    const result = insertOrder.run(invNum, subtotal, 0, tax, total, "cash", total, adminUser.id, d.toISOString());
    const orderId = result.lastInsertRowid;
    insertItem.run(orderId, 1, "برياني دجاج", 4, 14000, 56000, catIds[0], "المطبخ");
    insertItem.run(orderId, 2, "رز أبيض", 5, 6500, 32500, catIds[0], "المطبخ");
  }
}

initSchema();
runMigrations();
seedData();

function ensureDeveloperAccount() {
  try {
    const devHash = hashPassword("dev123");
    const dev = db.prepare("SELECT id FROM users WHERE username='developer'").get() as any;
    if (!dev) {
      db.prepare(`INSERT INTO users (username, password_hash, name, role, active) VALUES (?,?,?,?,1)`)
        .run("developer", devHash, "مطور النظام", "developer");
    } else {
      db.prepare(`UPDATE users SET password_hash=?, active=1, role='developer' WHERE username='developer'`)
        .run(devHash);
    }
  } catch (e) {
    console.error("Error ensuring developer account:", e);
  }
}
ensureDeveloperAccount();

function ensureHRData() {
  try {
    const deptCount = (db.prepare("SELECT COUNT(*) as c FROM hr_departments").get() as any)?.c || 0;
    if (deptCount === 0) {
      const depts = [
        { name: "الإدارة العامة والشؤون المالية", budget: 100000 },
        { name: "المطبخ والإنتاج", budget: 80000 },
        { name: "المبيعات والكاشير", budget: 60000 },
        { name: "الخدمة والصالة", budget: 40000 },
        { name: "التوصيل واللوجستيات", budget: 30000 },
        { name: "الصيانة والنظافة", budget: 20000 },
      ];
      const stmt = db.prepare("INSERT INTO hr_departments (name, budget) VALUES (?,?)");
      for (const d of depts) {
        stmt.run(d.name, d.budget);
      }
    }

    const empCount = (db.prepare("SELECT COUNT(*) as c FROM hr_employees").get() as any)?.c || 0;
    if (empCount === 0) {
      const firstDept = db.prepare("SELECT id FROM hr_departments ORDER BY id ASC LIMIT 1").get() as any;
      const deptId = firstDept ? firstDept.id : null;
      db.prepare(`
        INSERT INTO hr_employees (employee_number, name, phone, position, department_id, basic_salary, hire_date, active)
        VALUES (?,?,?,?,?,?,?,1)
      `).run("EMP-001", "عبدالله أحمد علي", "770000001", "مدير حسابات", deptId, 150000, "2025-01-01");
      
      db.prepare(`
        INSERT INTO hr_employees (employee_number, name, phone, position, department_id, basic_salary, hire_date, active)
        VALUES (?,?,?,?,?,?,?,1)
      `).run("EMP-002", "محمد صالح حسن", "770000002", "كاشير رئيسي", deptId ? deptId + 2 : null, 100000, "2025-02-01");
    }
  } catch (e) {
    console.error("Error ensuring HR data:", e);
  }
}
ensureHRData();
