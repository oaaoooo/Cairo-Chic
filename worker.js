// ============================================================
// worker.js — Cloudflare Workers entry (API + /admin redirect)
// Static files are served by [assets] CDN (see wrangler.toml)
// Secrets set in dashboard: DATABASE_URL, SESSION_SECRET
// ============================================================
import { createApp } from './app.js';
import { createNeonDb } from './db-neon.js';

let booted = null;

async function boot(env) {
  const driver = createNeonDb(env.DATABASE_URL);
  await driver.init();
  return createApp({ q: driver.q, sessionSecret: env.SESSION_SECRET });
}

export default {
  async fetch(request, env, ctx) {
    if (!env.DATABASE_URL) return new Response('Missing DATABASE_URL secret', { status: 500 });
    if (!env.SESSION_SECRET) return new Response('Missing SESSION_SECRET secret', { status: 500 });
    if (!booted) booted = boot(env);
    const { app } = await booted;
    return app.fetch(request, env, ctx);
  }
};
