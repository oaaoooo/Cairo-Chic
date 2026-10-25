// ============================================================
// db-sqlite.js — Local dev database (Node only, better-sqlite3)
// NEVER imported by worker.js (native module can't run on Workers)
// ============================================================
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DDL_SQLITE = [
  `CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, price REAL NOT NULL, old_price REAL DEFAULT 0,
    description TEXT DEFAULT '', colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]',
    stock INTEGER DEFAULT 100, active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT UNIQUE, product_id INTEGER, product_name TEXT,
    color TEXT, size TEXT, qty INTEGER,
    unit_price REAL, shipping REAL, total REAL,
    name TEXT, phone TEXT, governorate TEXT, address TEXT, notes TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT, mime TEXT DEFAULT 'image/jpeg',
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

  async function init() {
    for (const stmt of DDL_SQLITE) db.exec(stmt);
  }

  return { q, init, pgLike: false };
}
