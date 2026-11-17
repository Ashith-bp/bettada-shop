const { DatabaseSync } = require("node:sqlite");
const path = require("path");
const fs = require("fs");

const dir = process.env.DATA_DIR || path.join(__dirname, "..", "data");
fs.mkdirSync(dir, { recursive: true });
const raw = new DatabaseSync(path.join(dir, "shop.db"));
raw.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

/* Small wrapper around Node's built-in SQLite: no native modules to compile. */
const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => raw.prepare(sql),
  transaction: (fn) => (...args) => {
    raw.exec("BEGIN");
    try { const r = fn(...args); raw.exec("COMMIT"); return r; }
    catch (e) { try { raw.exec("ROLLBACK"); } catch (x) { /* already rolled back */ } throw e; }
  }
};

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  tag TEXT NOT NULL,
  art TEXT NOT NULL,
  description TEXT NOT NULL,
  sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grams INTEGER NOT NULL,
  price INTEGER NOT NULL,
  in_stock INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, phone TEXT NOT NULL,
  line1 TEXT NOT NULL, line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL, state TEXT NOT NULL, pincode TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL, phone TEXT NOT NULL,
  line1 TEXT NOT NULL, line2 TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL, state TEXT NOT NULL, pincode TEXT NOT NULL,
  subtotal INTEGER NOT NULL, shipping INTEGER NOT NULL, total INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending_payment',
  pay_attempt INTEGER NOT NULL DEFAULT 0,
  cf_ref TEXT,
  cf_payment_id TEXT,
  tracking TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_cfref ON orders(cf_ref);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL,
  name TEXT NOT NULL, label TEXT NOT NULL,
  price INTEGER NOT NULL, grams INTEGER NOT NULL, qty INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  product TEXT NOT NULL, kg INTEGER NOT NULL, city TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* First run: load the catalogue. After that, change prices from the admin page. */
if (db.prepare("SELECT COUNT(*) c FROM products").get().c === 0) {
  const addP = db.prepare("INSERT INTO products (id,name,tag,art,description,sort) VALUES (?,?,?,?,?,?)");
  const addV = db.prepare("INSERT INTO variants (id,product_id,label,grams,price) VALUES (?,?,?,?,?)");
  db.transaction(() => {
    addP.run("arabica", "Arabica coffee powder", "Ground coffee", "cherry",
      "Ground from Arabica beans grown on our estate. Smooth and bright, made for filter coffee, pour-over and moka pots.", 1);
    addV.run("arabica-500g", "arabica", "500 g", 500, 800);
    addV.run("arabica-1kg", "arabica", "1 kg", 1000, 1500);
    addP.run("pepper", "Black pepper", "Dried whole seeds", "pepper",
      "Whole peppercorns from the vines on our estate, picked ripe and dried. Sharp, hot and full of aroma. Crush it fresh.", 2);
    addV.run("pepper-500g", "pepper", "500 g", 500, 800);
    addV.run("pepper-1kg", "pepper", "1 kg", 1000, 1500);
  })();
}

db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

/* ---------- Catalogue migration (safe to run on every start, and on older databases) ---------- */
function addCol(table, col, def) {
  if (!db.prepare("PRAGMA table_info(" + table + ")").all().some((c) => c.name === col)) db.exec("ALTER TABLE " + table + " ADD COLUMN " + col + " " + def);
}
addCol("products", "image", "TEXT NOT NULL DEFAULT ''");
addCol("products", "slug", "TEXT NOT NULL DEFAULT ''");
addCol("products", "category", "TEXT NOT NULL DEFAULT ''");
addCol("products", "mode", "TEXT NOT NULL DEFAULT 'buy'");      // buy = sold online by pack, quote = bulk grade, price on request
addCol("products", "tagline", "TEXT NOT NULL DEFAULT ''");
addCol("products", "moq_kg", "INTEGER NOT NULL DEFAULT 0");      // minimum bulk order in kg
addCol("enquiries", "business_type", "TEXT NOT NULL DEFAULT ''");
addCol("enquiries", "gstin", "TEXT NOT NULL DEFAULT ''");
addCol("enquiries", "state", "TEXT NOT NULL DEFAULT ''");
db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  art TEXT NOT NULL DEFAULT '',
  blurb TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);
`);
require("./seed")(db);

module.exports = db;
