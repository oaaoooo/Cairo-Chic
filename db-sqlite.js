// ============================================================
// db-sqlite.js — Local dev database (Node only, better-sqlite3)
// NEVER imported by worker.js (native module can't run on Workers)
// ============================================================
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GOVERNORATES, CITY_GOVS } from './lib.js';

export const DDL_SQLITE = [
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, price REAL NOT NULL, old_price REAL DEFAULT 0,
    description TEXT DEFAULT '', colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]',
    stock INTEGER DEFAULT 100, active INTEGER DEFAULT 1, featured INTEGER DEFAULT 0, video TEXT DEFAULT '',
    size_guide TEXT DEFAULT '[]',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE, product_id INTEGER, product_name TEXT,
    color TEXT, size TEXT, qty INTEGER,
    unit_price REAL, shipping REAL, total REAL,
    coupon_code TEXT DEFAULT '', discount REAL DEFAULT 0,
    items TEXT DEFAULT '[]',
    name TEXT, phone TEXT, governorate TEXT, area TEXT DEFAULT '', address TEXT, notes TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, mime TEXT DEFAULT 'image/jpeg',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS governorates (
    name TEXT PRIMARY KEY, shipping REAL DEFAULT 70, sort INTEGER DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS coupons (
    id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL,
    kind TEXT DEFAULT 'pct', value REAL DEFAULT 0, min_order REAL DEFAULT 0,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT, product_id INTEGER,
    name TEXT DEFAULT '', rating INTEGER DEFAULT 5, comment TEXT DEFAULT '',
    approved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS site_images (
    key TEXT PRIMARY KEY, data TEXT, mime TEXT DEFAULT 'image/jpeg',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
];

export function createSqliteDb() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const db = new Database(path.join(dir, 'store.db'));
  db.pragma('journal_mode = WAL');

  // Tagged-template query: q`SELECT ... ${val}` — same style as Neon driver
  async function q(strings, ...values) {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `?${strings[i + 1]}`;
    const stmt = db.prepare(text);
    if (/^\s*select/i.test(text)) return { rows: stmt.all(...values) };
    if (/returning\s+id/i.test(text)) {
      const row = stmt.get(...values);
      return { rows: row ? [row] : [] };
    }
    stmt.run(...values);
    return { rows: [] };
  }

  const SCHEMA_V = '8';
  async function init() {
    try {
      const r = db.prepare(`SELECT value FROM settings WHERE key = 'schema_v'`).get();
      if (r && r.value === SCHEMA_V) {
        db.prepare(`DELETE FROM governorates WHERE name = 'شمال سيناء'`).run();
        return;
      }
    } catch { /* fresh DB */ }
    for (const stmt of DDL_SQLITE) db.exec(stmt);
    // ---- migrate old DBs: coupon columns on orders ----
    const cols = db.prepare('PRAGMA table_info(orders)').all().map(c => c.name);
    if (!cols.includes('coupon_code')) db.exec(`ALTER TABLE orders ADD COLUMN coupon_code TEXT DEFAULT ''`);
    if (!cols.includes('discount')) db.exec(`ALTER TABLE orders ADD COLUMN discount REAL DEFAULT 0`);
    if (!cols.includes('items')) db.exec(`ALTER TABLE orders ADD COLUMN items TEXT DEFAULT '[]'`);
    const pcols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
    if (!pcols.includes('featured')) db.exec(`ALTER TABLE products ADD COLUMN featured INTEGER DEFAULT 0`);
    if (!pcols.includes('video')) db.exec(`ALTER TABLE products ADD COLUMN video TEXT DEFAULT ''`);
    if (!pcols.includes('size_guide')) db.exec(`ALTER TABLE products ADD COLUMN size_guide TEXT DEFAULT '[]'`);
    if (!cols.includes('area')) db.exec(`ALTER TABLE orders ADD COLUMN area TEXT DEFAULT ''`);
    // no delivery to Sinai — drop from existing DBs (no Sinai orders exist)
    db.prepare(`DELETE FROM governorates WHERE name = 'شمال سيناء'`).run();
    db.prepare(`INSERT INTO settings(key,value) VALUES('schema_v',?) ON CONFLICT(key) DO UPDATE SET value=?`).run(SCHEMA_V, SCHEMA_V);
    // ---- seed governorates once (from current shipping settings) ----
    const n = db.prepare('SELECT COUNT(*) c FROM governorates').get().c;
    if (!n) {
      const getS = (k, d) => {
        try {
          const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(k);
          return r ? (Number(r.value) || d) : d;
        } catch { return d; }
      };
      const cs = getS('shipping_cities', 50), os = getS('shipping_others', 70);
      const ins = db.prepare('INSERT OR IGNORE INTO governorates(name, shipping, sort) VALUES(?,?,?)');
      GOVERNORATES.forEach((g, i) => ins.run(g, CITY_GOVS.includes(g) ? cs : os, i));
    }
  }

  return { q, init, pgLike: false };
}
