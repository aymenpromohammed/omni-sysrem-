const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbPath;
try {
  const { app } = require('electron');
  if (app) {
    // If running inside Electron main process, save inside system's user app data
    const userDataPath = app.getPath('userData');
    dbPath = path.join(userDataPath, 'database.db');
  } else {
    dbPath = path.join(process.cwd(), 'data', 'database.db');
  }
} catch (e) {
  // Fallback for standalone or development mode
  dbPath = path.join(process.cwd(), 'data', 'database.db');
}

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

console.log(`Database is initialized at: ${dbPath}`);

const db = new Database(dbPath);

// Create the tables for POS and inventory management
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    stock INTEGER NOT NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    barcode TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    total REAL NOT NULL,
    payment_method TEXT NOT NULL,
    cash_received REAL,
    change_given REAL,
    items_count INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    total REAL NOT NULL
  );
`);

// Seed default data if database is empty
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
if (categoryCount === 0) {
  const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const catIds = {
    hot: insertCategory.run('مشروبات ساخنة').lastInsertRowid,
    cold: insertCategory.run('مشروبات باردة').lastInsertRowid,
    sweets: insertCategory.run('حلويات ومخبوزات').lastInsertRowid,
    food: insertCategory.run('مأكولات وجبات').lastInsertRowid,
  };

  const insertItem = db.prepare('INSERT INTO items (name, price, stock, category_id, barcode) VALUES (?, ?, ?, ?, ?)');
  insertItem.run('قهوة إسبريسو دوبل', 12.0, 150, catIds.hot, '1001');
  insertItem.run('كابتشينو كلاسيك', 15.0, 120, catIds.hot, '1002');
  insertItem.run('لاتيه فانيليا', 16.5, 95, catIds.hot, '1003');
  insertItem.run('عصير برتقال طازج', 18.0, 60, catIds.cold, '2001');
  insertItem.run('ميلك شيك شوكولاتة', 22.0, 45, catIds.cold, '2002');
  insertItem.run('كرواسون زبدة فرنسي', 10.0, 40, catIds.sweets, '3001');
  insertItem.run('كعكة الشوكولاتة الفاخرة', 25.0, 25, catIds.sweets, '3002');
  insertItem.run('كلوب ساندوتش دجاج', 28.0, 30, catIds.food, '4001');
  insertItem.run('بيتزا مارغريتا وسط', 35.0, 20, catIds.food, '4002');

  // Seed some historic sales for dashboard graphs
  const insertSale = db.prepare('INSERT INTO sales (total, payment_method, cash_received, change_given, items_count, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const insertSaleItem = db.prepare('INSERT INTO sale_items (sale_id, item_name, price, quantity, total) VALUES (?, ?, ?, ?, ?)');

  const dates = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  // Create mock sales for the past 7 days
  dates.reverse().forEach((dateStr, idx) => {
    const dailyTotal = 300 + idx * 85;
    const saleId = insertSale.run(dailyTotal, 'cash', dailyTotal + 50, 50, 4, `${dateStr} 14:30:00`).lastInsertRowid;
    insertSaleItem.run(saleId, 'كلوب ساندوتش دجاج', 28.0, 2, 56.0);
    insertSaleItem.run(saleId, 'عصير برتقال طازج', 18.0, 2, 36.0);
  });
}

module.exports = db;
