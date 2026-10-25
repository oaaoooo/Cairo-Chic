// ============================================================
// db.js — Database adapter
// Local: SQLite file (no setup) | Production: Postgres (Neon)
// Switch via DATABASE_URL env var (empty = SQLite)
// ============================================================
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL || '';
const isPg = DATABASE_URL.startsWith('postgres://') || DATABASE_URL.startsWith('postgresql://');
const isPglite = DATABASE_URL.startsWith('pglite:'); // in-process PG for tests only
const pgLike = isPg || isPglite;

let pool = null, pglite = null, sqlite = null;

const DDL_SQLITE = [
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
    id INTEGER PRIMARY KEY AUTOINCREMENT, data BLOB, mime TEXT DEFAULT 'image/jpeg',
    created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`
];

const DDL_PG = [
  `CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL, price NUMERIC NOT NULL, old_price NUMERIC DEFAULT 0,
    description TEXT DEFAULT '', colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]',
    stock INTEGER DEFAULT 100, active INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_no TEXT UNIQUE, product_id INTEGER, product_name TEXT,
    color TEXT, size TEXT, qty INTEGER,
    unit_price NUMERIC, shipping NUMERIC, total NUMERIC,
    name TEXT, phone TEXT, governorate TEXT, address TEXT, notes TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TIMESTAMPTZ DEFAULT NOW())`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY, data BYTEA, mime TEXT DEFAULT 'image/jpeg',
    created_at TIMESTAMPTZ DEFAULT NOW())`
];

async function init() {
  if (isPg) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000
    });
    pool.on('error', (e) => console.error('pg pool error:', e.message));
    for (const stmt of DDL_PG) await pool.query(stmt);
  } else if (isPglite) {
    const { PGlite } = require('@electric-sql/pglite');
    pglite = new PGlite();
    await pglite.waitReady;
    for (const stmt of DDL_PG) await pglite.query(stmt);
  } else {
    const Database = require('better-sqlite3');
    const DATA_DIR = path.join(__dirname, 'data');
    fs.mkdirSync(DATA_DIR, { recursive: true });
    sqlite = new Database(path.join(DATA_DIR, 'store.db'));
    sqlite.pragma('journal_mode = WAL');
    sqlite.exec(DDL_SQLITE.join(';'));
  }
}

// Unified query: SQL uses $1,$2 placeholders. Returns {rows, lastID}
async function q(sql, params = []) {
  if (pool) {
    const r = await pool.query(sql, params);
    return { rows: r.rows, lastID: null };
  }
  if (pglite) {
    const r = await pglite.query(sql, params);
    return { rows: r.rows, lastID: null };
  }
  const stmt = sqlite.prepare(sql.replace(/\$(\d+)/g, '?'));
  if (/^\s*select/i.test(sql)) return { rows: stmt.all(...params), lastID: null };
  const info = stmt.run(...params);
  return { rows: [], lastID: Number(info.lastInsertRowid) };
}

module.exports = {
  init, q, pgLike, isPg,
  describe: () => (isPg ? 'Postgres (Neon)' : isPglite ? 'PGlite (test)' : 'SQLite (local)'),
  get pool() { return pool; }
};
