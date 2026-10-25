// ============================================================
// app.js — Cairo Chic API (Hono: runs on Node AND Cloudflare Workers)
// ============================================================
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  GOVERNORATES, CITY_GOVS, ORDER_STATUSES, STATUS_AR,
  parseProduct, normalizePhone, cairoDayRange, validateProductBody,
  hashPassword, verifyPassword, signToken, verifyToken,
  bytesToBase64, base64ToBytes
} from './lib.js';

const SETTINGS_KEYS = ['store_name_ar', 'store_name_en', 'whatsapp', 'tiktok_pixel', 'shipping_cities', 'shipping_others', 'announcement'];

export async function createApp({ q, sessionSecret }) {
  const app = new Hono();

  async function getSettings() {
    const { rows } = await q`SELECT key, value FROM settings`;
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }
  async function getSetting(k, d = '') {
    const { rows } = await q`SELECT value FROM settings WHERE key = ${k}`;
    return rows.length ? rows[0].value : d;
  }
  async function setSetting(k, v) {
    await q`INSERT INTO settings(key,value) VALUES(${k},${String(v)})
      ON CONFLICT(key) DO UPDATE SET value = ${String(v)}`;
  }

  // ---------- Seed (first run) ----------
  if (!(await getSetting('seeded'))) {
    const defaults = {
      store_name_ar: 'كايرو شيك', store_name_en: 'CAIRO CHIC',
      whatsapp: '', tiktok_pixel: '',
      shipping_cities: '50', shipping_others: '70',
      announcement: '🚚 شحن سريع لكل محافظات مصر — الدفع عند الاستلام 💵',
      admin_password: await hashPassword('admin123', sessionSecret), seeded: '1'
    };
    for (const [k, v] of Object.entries(defaults)) await setSetting(k, v);
    const colors = JSON.stringify([
      { name: 'البيج', image: '/images/v11-beige.jpg' },
      { name: 'الأسود', image: '/images/v11-black.jpg' },
      { name: 'الكحلي', image: '/images/v11-blue.jpg' },
      { name: 'الرمادي', image: '/images/v11-gray.jpg' }
    ]);
    await q`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active)
      VALUES(${'ترنج V11 الشتوي'},${599},${850},
        ${'ترنج V11 الشتوي بخامة ميلتون تقيلة تدفيك في عز البرد، وتلبيس مظبوط وشيك يخليك فورمة طول اليوم. مناسب للخروجات والجامعة والشغل.'},
        ${colors},${JSON.stringify(['M', 'L', 'XL', 'XXL'])},${100},${1})`;
    console.log('✅ Database seeded (admin password: admin123)');
  }

  // ---------- Rate limit (orders) ----------
  const orderHits = new Map();
  function orderRateLimit(c, next) {
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'x';
    const now = Date.now();
    const rec = orderHits.get(ip) || { count: 0, reset: now + 3600e3 };
    if (now > rec.reset) { rec.count = 0; rec.reset = now + 3600e3; }
    rec.count++;
    orderHits.set(ip, rec);
    if (rec.count > 10) return c.json({ ok: false, error: 'محاولات كتير، جرب كمان شوية' }, 429);
    return next();
  }

  async function requireAdmin(c, next) {
    const tok = getCookie(c, 'admin_token');
    const payload = tok ? await verifyToken(tok, sessionSecret) : null;
    if (!payload || payload.role !== 'admin') return c.json({ ok: false, error: 'غير مسموح' }, 401);
    return next();
  }

  // ---------- Public ----------
  app.get('/health', (c) => c.json({ ok: true, time: new Date().toISOString() }));
  app.get('/admin', (c) => c.redirect('/admin.html'));

  app.get('/api/settings-public', async (c) => {
    const s = await getSettings();
    return c.json({
      ok: true,
      store_name_ar: s.store_name_ar || '', store_name_en: s.store_name_en || '',
      whatsapp: s.whatsapp || '', tiktok_pixel: s.tiktok_pixel || '',
      shipping_cities: Number(s.shipping_cities || 50), shipping_others: Number(s.shipping_others || 70),
      announcement: s.announcement || '',
      governorates: GOVERNORATES, city_govs: CITY_GOVS
    });
  });

  app.get('/api/products', async (c) => {
    const { rows } = await q`SELECT * FROM products WHERE active = 1 ORDER BY id`;
    return c.json({ ok: true, products: rows.map(parseProduct) });
  });

  app.get('/img/:id', async (c) => {
    const { rows } = await q`SELECT data, mime FROM product_images WHERE id = ${c.req.param('id')}`;
    if (!rows.length || !rows[0].data) return c.notFound();
    const bytes = base64ToBytes(rows[0].data);
    return new Response(bytes, {
      headers: { 'Content-Type': rows[0].mime || 'image/jpeg', 'Cache-Control': 'public, max-age=2592000' }
    });
  });

  app.post('/api/order', orderRateLimit, async (c) => {
    try {
      const b = await c.req.json().catch(() => ({}));
      let { product_id, color, size, qty, name, phone, governorate, address, notes } = b;
      name = String(name || '').trim();
      address = String(address || '').trim();
      notes = String(notes || '').trim();
      phone = normalizePhone(phone);
      qty = Math.max(1, Math.min(5, parseInt(qty) || 1));

      if (name.length < 3) return c.json({ ok: false, error: 'اكتب الاسم بالكامل (3 حروف على الأقل)' });
      if (!/^01[0125][0-9]{8}$/.test(phone)) return c.json({ ok: false, error: 'رقم الموبايل غلط — لازم يبدأ بـ 01 ومكوّن من 11 رقم' });
      if (!GOVERNORATES.includes(governorate)) return c.json({ ok: false, error: 'اختار المحافظة' });
      if (address.length < 5) return c.json({ ok: false, error: 'اكتب العنوان بالتفصيل' });

      const pr = await q`SELECT * FROM products WHERE id = ${product_id} AND active = 1`;
      if (!pr.rows.length) return c.json({ ok: false, error: 'المنتج غير متاح' });
      const pp = parseProduct(pr.rows[0]);
      if (!pp.colors.map(x => x.name).includes(color)) return c.json({ ok: false, error: 'اختار اللون' });
      if (!pp.sizes.includes(size)) return c.json({ ok: false, error: 'اختار المقاس' });

      const s = await getSettings();
      const unit = Number(pp.price);
      const shipping = CITY_GOVS.includes(governorate) ? Number(s.shipping_cities || 50) : Number(s.shipping_others || 70);
      const total = unit * qty + shipping;

      const ins = await q`INSERT INTO orders
        (product_id, product_name, color, size, qty, unit_price, shipping, total, name, phone, governorate, address, notes)
        VALUES (${pp.id},${pp.name},${color},${size},${qty},${unit},${shipping},${total},${name},${phone},${governorate},${address},${notes})
        RETURNING id`;
      const id = ins.rows[0].id;
      const order_no = 'CC-' + (100000 + Number(id));
      await q`UPDATE orders SET order_no = ${order_no} WHERE id = ${id}`;

      return c.json({ ok: true, order_no, total, shipping });
    } catch (e) {
      console.error('order error', e);
      return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500);
    }
  });

  // ---------- Admin: auth ----------
  app.post('/api/admin/login', async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const hash = await getSetting('admin_password');
    if (b.password && hash && await verifyPassword(String(b.password), sessionSecret, hash)) {
      const token = await signToken({ role: 'admin', exp: Date.now() + 12 * 3600e3 }, sessionSecret);
      const secure = new URL(c.req.url).protocol === 'https:';
      setCookie(c, 'admin_token', token, { httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: 12 * 3600 });
      return c.json({ ok: true });
    }
    return c.json({ ok: false, error: 'الباسورد غلط' });
  });
  app.post('/api/admin/logout', (c) => {
    deleteCookie(c, 'admin_token', { path: '/' });
    return c.json({ ok: true });
  });
  app.get('/api/admin/me', async (c) => {
    const tok = getCookie(c, 'admin_token');
    const p = tok ? await verifyToken(tok, sessionSecret) : null;
    return c.json({ ok: true, admin: !!(p && p.role === 'admin') });
  });
  app.post('/api/admin/password', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!await verifyPassword(String(b.current || ''), sessionSecret, await getSetting('admin_password')))
      return c.json({ ok: false, error: 'الباسورد الحالي غلط' });
    if (String(b.next || '').length < 6) return c.json({ ok: false, error: 'الباسورد الجديد لازم 6 حروف على الأقل' });
    await setSetting('admin_password', await hashPassword(String(b.next), sessionSecret));
    return c.json({ ok: true });
  });

  // ---------- Admin: stats & orders ----------
  app.get('/api/admin/stats', requireAdmin, async (c) => {
    const counts = (await q`SELECT status, COUNT(*) c FROM orders GROUP BY status`).rows;
    const byStatus = {};
    ORDER_STATUSES.forEach(s => byStatus[s] = 0);
    counts.forEach(r => byStatus[r.status] = Number(r.c));
    const revenue = Number((await q`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'`).rows[0].s);
    const [from, to] = cairoDayRange();
    const today = Number((await q`SELECT COUNT(*) c FROM orders WHERE created_at >= ${from} AND created_at < ${to}`).rows[0].c);
    const total = Number((await q`SELECT COUNT(*) c FROM orders`).rows[0].c);
    return c.json({ ok: true, byStatus, revenue, today, total, statusAr: STATUS_AR });
  });

  app.get('/api/admin/orders', requireAdmin, async (c) => {
    const status = c.req.query('status');
    let rows;
    if (status && ORDER_STATUSES.includes(status))
      rows = (await q`SELECT * FROM orders WHERE status = ${status} ORDER BY id DESC`).rows;
    else
      rows = (await q`SELECT * FROM orders ORDER BY id DESC LIMIT 500`).rows;
    return c.json({ ok: true, orders: rows, statusAr: STATUS_AR });
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    if (!ORDER_STATUSES.includes(b.status)) return c.json({ ok: false, error: 'حالة غلط' });
    await q`UPDATE orders SET status = ${b.status} WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (c) => {
    await q`DELETE FROM orders WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  // ---------- Admin: products ----------
  app.get('/api/admin/products', requireAdmin, async (c) => {
    const { rows } = await q`SELECT * FROM products ORDER BY id`;
    return c.json({ ok: true, products: rows.map(parseProduct) });
  });

  app.post('/api/admin/products', requireAdmin, async (c) => {
    const v = validateProductBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const d = v.data;
    await q`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active)
      VALUES(${d.name},${d.price},${d.old_price},${d.description},${d.colors},${d.sizes},${d.stock},${d.active})`;
    return c.json({ ok: true });
  });

  app.put('/api/admin/products/:id', requireAdmin, async (c) => {
    const v = validateProductBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const d = v.data;
    await q`UPDATE products SET name=${d.name},price=${d.price},old_price=${d.old_price},
      description=${d.description},colors=${d.colors},sizes=${d.sizes},stock=${d.stock},active=${d.active}
      WHERE id=${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (c) => {
    await q`DELETE FROM products WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  // ---------- Admin: upload (stored as base64 in DB) ----------
  app.post('/api/admin/upload', requireAdmin, async (c) => {
    try {
      const form = await c.req.formData();
      const file = form.get('image');
      if (!file || typeof file.arrayBuffer !== 'function') return c.json({ ok: false, error: 'اختار صورة' });
      if (!String(file.type || '').startsWith('image/')) return c.json({ ok: false, error: 'لازم ملف صورة' });
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.length > 2.5 * 1024 * 1024) return c.json({ ok: false, error: 'الصورة كبيرة — لازم أصغر من 2.5MB' });
      const b64 = bytesToBase64(buf);
      const ins = await q`INSERT INTO product_images(data,mime) VALUES(${b64},${file.type || 'image/jpeg'}) RETURNING id`;
      return c.json({ ok: true, url: '/img/' + ins.rows[0].id });
    } catch (e) {
      console.error('upload error', e);
      return c.json({ ok: false, error: 'فشل الرفع' });
    }
  });

  // ---------- Admin: settings ----------
  app.get('/api/admin/settings', requireAdmin, async (c) => {
    const s = await getSettings();
    const out = {};
    SETTINGS_KEYS.forEach(k => out[k] = s[k] || '');
    return c.json({ ok: true, settings: out });
  });

  app.put('/api/admin/settings', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    for (const k of SETTINGS_KEYS) {
      if (b[k] !== undefined) {
        let v = String(b[k]).trim();
        if (k === 'whatsapp') v = v.replace(/\D/g, '');
        await setSetting(k, v);
      }
    }
    return c.json({ ok: true });
  });

  return { app };
}
