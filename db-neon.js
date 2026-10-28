// ============================================================
// db-neon.js — Production database (Neon Postgres over HTTPS)
// Works on Node AND Cloudflare Workers (no TCP, no native code)
// ============================================================
import { neon } from '@neondatabase/serverless';
import { GOVERNORATES, CITY_GOVS } from './lib.js';

export function createNeonDb(url) {
  const sql = neon(url);

  // Tagged-template query: q`SELECT ... ${val}` — parameterized & safe
  async function q(strings, ...values) {
    const rows = await sql(strings, ...values);
    return { rows };
  }

  // Bump SCHEMA_V whenever DDL/migrations below change.
  const SCHEMA_V = '8';
  async function init() {
    // Fast path: schema already current -> skip ~13 queries on every cold start.
    try {
      const v = await sql`SELECT value FROM settings WHERE key = 'schema_v'`;
      if (v[0] && v[0].value === SCHEMA_V) {
        await sql`DELETE FROM governorates WHERE name = 'شمال سيناء'`;
        return;
      }
    } catch { /* fresh DB: fall through to full init */ }
    await sql`CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL, price NUMERIC NOT NULL, old_price NUMERIC DEFAULT 0,
      description TEXT DEFAULT '', colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]',
      stock INTEGER DEFAULT 100, active INTEGER DEFAULT 1, featured INTEGER DEFAULT 0, video TEXT DEFAULT '',
      size_guide TEXT DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_no TEXT UNIQUE, product_id INTEGER, product_name TEXT,
      color TEXT, size TEXT, qty INTEGER,
      unit_price NUMERIC, shipping NUMERIC, total NUMERIC,
      coupon_code TEXT DEFAULT '', discount NUMERIC DEFAULT 0,
      items TEXT DEFAULT '[]',
      name TEXT, phone TEXT, governorate TEXT, area TEXT DEFAULT '', address TEXT, notes TEXT DEFAULT '',
      status TEXT DEFAULT 'new',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT DEFAULT '')`;
    await sql`CREATE TABLE IF NOT EXISTS product_images (
      id SERIAL PRIMARY KEY, data TEXT, mime TEXT DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS governorates (
      name TEXT PRIMARY KEY, shipping NUMERIC DEFAULT 70, sort INTEGER DEFAULT 0)`;
    await sql`CREATE TABLE IF NOT EXISTS coupons (
      id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL,
      kind TEXT DEFAULT 'pct', value NUMERIC DEFAULT 0, min_order NUMERIC DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY, product_id INTEGER,
      name TEXT DEFAULT '', rating INTEGER DEFAULT 5, comment TEXT DEFAULT '',
      approved INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS site_images (
      key TEXT PRIMARY KEY, data TEXT, mime TEXT DEFAULT 'image/jpeg',
      created_at TIMESTAMPTZ DEFAULT NOW())`;
    // ---- migrate old DBs: coupon columns on orders ----
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT DEFAULT ''`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount NUMERIC DEFAULT 0`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS items TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS featured INTEGER DEFAULT 0`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS video TEXT DEFAULT ''`;
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS size_guide TEXT DEFAULT '[]'`;
    await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS area TEXT DEFAULT ''`;
    await sql`DELETE FROM governorates WHERE name = 'شمال سيناء'`;
    // ---- seed governorates once (from current shipping settings, single query) ----
    const cnt = await sql`SELECT COUNT(*)::int c FROM governorates`;
    if (!cnt[0].c) {
      const srows = await sql`SELECT key, value FROM settings`;
      const m = {};
      srows.forEach(r => { m[r.key] = r.value; });
      const cs = Number(m.shipping_cities) || 50, os = Number(m.shipping_others) || 70;
      const names = [...GOVERNORATES];
      const ships = names.map(g => CITY_GOVS.includes(g) ? cs : os);
      const sorts = names.map((_, i) => i);
      await sql`INSERT INTO governorates(name, shipping, sort)
        SELECT * FROM UNNEST(${names}::text[], ${ships}::numeric[], ${sorts}::int[])
        ON CONFLICT(name) DO NOTHING`;
    }
    await sql`INSERT INTO settings(key,value) VALUES('schema_v',${SCHEMA_V})
      ON CONFLICT(key) DO UPDATE SET value = ${SCHEMA_V}`;
  }

  return { q, init, pgLike: true };
}
