// ============================================================
// server-node.js — Local dev server (Node + SQLite or Neon)
// Start: npm start
// ============================================================
import 'dotenv/config';
import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { createSqliteDb } from './db-sqlite.js';
import { createNeonDb } from './db-neon.js';
import fs from 'node:fs';
import path from 'node:path';

const PORT = process.env.PORT || 3000;
const PUB = path.join(process.cwd(), 'public');
const MIME = {
  '.html': 'text/html;charset=UTF-8', '.css': 'text/css', '.js': 'text/javascript',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json'
};

const useNeon = !!process.env.DATABASE_URL;
const driver = useNeon ? createNeonDb(process.env.DATABASE_URL) : createSqliteDb();
await driver.init();
console.log('📦 Database:', useNeon ? 'Neon Postgres' : 'SQLite (local)');

const dbKind = useNeon ? 'neon' : 'sqlite';
const getDbBytes = async () => {
  if (useNeon) return Number((await driver.q`SELECT pg_database_size(current_database()) s`).rows[0].s);
  let bytes = 0;
  for (const f of ['store.db', 'store.db-wal', 'store.db-shm']) {
    try { bytes += fs.statSync(path.join(process.cwd(), 'data', f)).size; } catch { /* ignore */ }
  }
  return bytes;
};
const { app } = await createApp({
  q: driver.q,
  sessionSecret: process.env.SESSION_SECRET || 'cairo-chic-dev-secret-CHANGE-ME',
  dbKind, getDbBytes
});

// Static files (on Cloudflare these come from [assets] CDN instead)
app.use('/*', async (c, next) => {
  const p = new URL(c.req.url).pathname;
  if (p.startsWith('/api/') || p.startsWith('/img/') || p === '/health' || p === '/admin') return next();
  const f = p === '/' ? '/index.html' : decodeURIComponent(p);
  const fp = path.join(PUB, f);
  if (!fp.startsWith(PUB)) return next();
  try {
    const data = await fs.promises.readFile(fp);
    return new Response(data, {
      headers: {
        'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  } catch { return next(); }
});

serve({ fetch: app.fetch, port: Number(PORT) }, () => {
  console.log(`🚀 Cairo Chic running on port ${PORT}`);
});
