// ============================================================
// db-neon.js — Production database (Neon Postgres over HTTPS)
// Works on Node AND Cloudflare Workers (no TCP, no native code)
// ============================================================
import { neon } from '@neondatabase/serverless';

export function createNeonDb(url) {
  const sql = neon(url);

  // Tagged-template query: q`SELECT ... ${val}` — parameterized & safe
  async function q(strings, ...values) {
    const rows = await sql(strings, ...values);
    return { rows };
  }

  async function init() {
    await sql`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, price NUMERIC NOT NULL, old_price NUMERIC DEFAULT 0,
      description TEXT DEFAULT '', colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]',
      stock INTEGER DEFAULT 100, active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_no TEXT UNIQUE, product_id INTEGER, product_name TEXT,
      color TEXT, size TEXT, qty INTEGER,
      unit_price NUMERIC, shipping NUMERIC, total NUMERIC,
      name TEXT, phone TEXT, governorate TEXT, address TEXT, notes TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`;
    await sql`CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY, data TEXT, mime TEXT DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
  }

  return { q, init, pgLike: true };
}
