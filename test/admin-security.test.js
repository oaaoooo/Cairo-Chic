import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Database from 'better-sqlite3';
import { createApp } from '../app.js';
import { DDL_SQLITE } from '../db-sqlite.js';
import { hashPassword, signToken } from '../lib.js';

const sessionSecret = 'test-session-secret-not-used-in-production';
const adminFiles = {
  loginHtml: fs.readFileSync(new URL('../private/admin-login.html', import.meta.url), 'utf8'),
  dashboardHtml: fs.readFileSync(new URL('../private/admin.html', import.meta.url), 'utf8'),
  dashboardJs: fs.readFileSync(new URL('../private/admin.js', import.meta.url), 'utf8')
};

async function fixture(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  for (const statement of DDL_SQLITE) db.exec(statement);
  const setting = db.prepare('INSERT INTO settings(key, value) VALUES(?, ?)');
  setting.run('seeded', '1');
  setting.run('reviews_seeded', '1');
  setting.run('admin_password', await hashPassword('admin123', sessionSecret));
  async function q(strings, ...values) {
    let sql = strings[0];
    for (let i = 0; i < values.length; i++) sql += `?${strings[i + 1]}`;
    const statement = db.prepare(sql);
    if (/^\s*select/i.test(sql)) return { rows: statement.all(...values) };
    if (/returning\s+id/i.test(sql)) {
      const row = statement.get(...values);
      return { rows: row ? [row] : [] };
    }
    statement.run(...values);
    return { rows: [] };
  }
  const { app } = await createApp({ q, sessionSecret, adminFiles, dbKind: 'sqlite' });
  db.prepare(`INSERT INTO orders(order_no, name, phone, address, governorate, total, items)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    'CC-123456', 'PRIVATE CUSTOMER', '01012345678', 'PRIVATE ADDRESS', 'القاهرة', 123, '[]'
  );
  return { app, db };
}

function request(app, path, options = {}) {
  return app.request(`https://example.test${path}`, options);
}

async function login(app, password = 'admin123') {
  return request(app, '/api/admin/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password })
  });
}

function cookieFrom(response) {
  const setCookie = response.headers.get('set-cookie');
  assert.ok(setCookie, 'login must set a session cookie');
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /Secure/i);
  assert.match(setCookie, /SameSite=Lax/i);
  return setCookie.split(';')[0];
}

function assertPrivateHeaders(response) {
  assert.match(response.headers.get('cache-control') || '', /no-store/i);
  assert.match(response.headers.get('vary') || '', /cookie/i);
  assert.match(response.headers.get('x-robots-tag') || '', /noindex/i);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
}

test('anonymous visitors only receive the login page, never dashboard HTML or script', async (t) => {
  const { app } = await fixture(t);
  for (const path of ['/admin', '/admin/', '/admin.html']) {
    const response = await request(app, path);
    assert.equal(response.status, 200, path);
    assertPrivateHeaders(response);
    const html = await response.text();
    assert.match(html, /id="loginForm"[^>]*method="post"/);
    assert.doesNotMatch(html, /id="panelView"|id="ordersBody"|PRIVATE CUSTOMER|PRIVATE ADDRESS|admin123/);
  }
  const script = await request(app, '/js/admin.js');
  assert.equal(script.status, 401);
  assertPrivateHeaders(script);
  assert.doesNotMatch(await script.text(), /function loadOrders/);
  assert.equal(fs.existsSync(new URL('../public/admin.html', import.meta.url)), false);
  assert.equal(fs.existsSync(new URL('../public/js/admin.js', import.meta.url)), false);
});

test('all sensitive admin APIs reject unauthenticated requests', async (t) => {
  const { app } = await fixture(t);
  const routes = [
    ['GET', '/api/admin/orders'], ['GET', '/api/admin/report'], ['GET', '/api/admin/stats'],
    ['GET', '/api/admin/products'], ['GET', '/api/admin/settings'], ['GET', '/api/admin/storage'],
    ['GET', '/api/admin/reviews'], ['GET', '/api/admin/governorates'], ['GET', '/api/admin/coupons'],
    ['POST', '/api/admin/password'], ['POST', '/api/admin/products'], ['PATCH', '/api/admin/orders/1'],
    ['DELETE', '/api/admin/orders'], ['GET', '/api/admin/future-sensitive-route']
  ];
  for (const [method, path] of routes) {
    const response = await request(app, path, { method });
    assert.equal(response.status, 401, `${method} ${path}`);
    assertPrivateHeaders(response);
    assert.doesNotMatch(await response.text(), /PRIVATE CUSTOMER|PRIVATE ADDRESS/);
  }
  const me = await request(app, '/api/admin/me');
  assertPrivateHeaders(me);
  assert.deepEqual(await me.json(), { ok: true, admin: false });
  const products = await request(app, '/api/products');
  assert.equal(products.status, 200, 'the public store still works');
});

test('only a valid login grants access to dashboard, script, and order data', async (t) => {
  const { app } = await fixture(t);
  const rejected = await login(app, 'wrong password');
  assert.equal((await rejected.json()).ok, false);
  assert.equal(rejected.headers.get('set-cookie'), null);
  assertPrivateHeaders(rejected);

  const accepted = await login(app);
  assert.equal((await accepted.clone().json()).ok, true);
  assertPrivateHeaders(accepted);
  const cookie = cookieFrom(accepted);
  const headers = { cookie };

  const dashboard = await request(app, '/admin', { headers });
  assertPrivateHeaders(dashboard);
  const html = await dashboard.text();
  assert.match(html, /id="panelView"/);
  assert.match(html, /id="ordersBody"/);
  assert.doesNotMatch(html, /id="loginForm"/);

  const script = await request(app, '/js/admin.js', { headers });
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assertPrivateHeaders(script);
  assert.match(await script.text(), /function loadOrders/);

  const orders = await request(app, '/api/admin/orders', { headers });
  assert.equal(orders.status, 200);
  assertPrivateHeaders(orders);
  const data = await orders.json();
  assert.equal(data.orders[0].name, 'PRIVATE CUSTOMER');
  assert.equal(data.orders[0].address, 'PRIVATE ADDRESS');
});

test('tampered, legacy, non-expiring, expired and non-admin tokens cannot open the panel', async (t) => {
  const { app, db } = await fixture(t);
  const passwordHash = db.prepare("SELECT value FROM settings WHERE key = 'admin_password'").get().value;
  const signingKey = `${sessionSecret}\0${passwordHash}`;
  const tokens = [
    'tampered.token',
    await signToken({ role: 'admin', exp: Date.now() + 60000 }, sessionSecret),
    await signToken({ role: 'admin' }, signingKey),
    await signToken({ role: 'admin', exp: Date.now() - 1000 }, signingKey),
    await signToken({ role: 'customer', exp: Date.now() + 60000 }, signingKey)
  ];
  for (const token of tokens) {
    const headers = { cookie: `admin_token=${token}` };
    const response = await request(app, '/api/admin/orders', { headers });
    assert.equal(response.status, 401);
    const page = await request(app, '/admin', { headers });
    assert.match(await page.text(), /id="loginForm"/);
  }
});

test('changing the password invalidates all previously issued sessions', async (t) => {
  const { app } = await fixture(t);
  const firstCookie = cookieFrom(await login(app));
  const secondCookie = cookieFrom(await login(app));
  const changed = await request(app, '/api/admin/password', {
    method: 'POST',
    headers: { cookie: firstCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ current: 'admin123', next: 'new-longer-password' })
  });
  assert.equal((await changed.json()).ok, true);
  assert.match(changed.headers.get('set-cookie'), /Max-Age=0/i);
  for (const cookie of [firstCookie, secondCookie]) {
    const response = await request(app, '/api/admin/orders', { headers: { cookie } });
    assert.equal(response.status, 401);
  }
  assert.equal((await (await login(app)).json()).ok, false);
  assert.equal((await (await login(app, 'new-longer-password')).json()).ok, true);
});

test('logout clears the browser session cookie', async (t) => {
  const { app } = await fixture(t);
  const cookie = cookieFrom(await login(app));
  const response = await request(app, '/api/admin/logout', { method: 'POST', headers: { cookie } });
  assert.equal((await response.json()).ok, true);
  assertPrivateHeaders(response);
  assert.match(response.headers.get('set-cookie'), /Max-Age=0/i);
  const loggedOutPage = await request(app, '/admin');
  assert.match(await loggedOutPage.text(), /id="loginForm"/);
});
