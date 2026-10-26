// ============================================================
// app.js — Cairo Chic API (Hono: runs on Node AND Cloudflare Workers)
// ============================================================
import { Hono } from 'hono';
import { getCookie, setCookie, deleteCookie } from 'hono/cookie';
import {
  GOVERNORATES, CITY_GOVS, ORDER_STATUSES, STATUS_AR, AREAS,
  parseProduct, normalizePhone, cairoDayRange, validateProductBody,
  hashPassword, verifyPassword, signToken, verifyToken,
  bytesToBase64, base64ToBytes, calcDiscount, validateCouponBody, validateReviewBody
} from './lib.js';

// Editable settings (store data + page content + theme + deal + logo).
// Shipping prices moved to the governorates table (per-governorate).
const SETTINGS_KEYS = [
  'store_name_ar', 'store_name_en', 'whatsapp', 'tiktok_pixel', 'announcement',
  'features_title', 'reviews_title', 'how_title', 'faq_title', 'more_title',
  'footer_text', 'stock_line', 'size_hint', 'cta_text',
  'f1i', 'f1t', 'f1d', 'f2i', 'f2t', 'f2d', 'f3i', 'f3t', 'f3d', 'f4i', 'f4t', 'f4d',
  't1i', 't1t', 't1d', 't2i', 't2t', 't2d', 't3i', 't3t', 't3d', 't4i', 't4t', 't4d',
  'theme_primary', 'theme_dark',
  'deal_enabled', 'deal_title', 'deal_sub', 'deal_ends_at',
  'maint_enabled', 'maint_ends_at', 'maint_msg',
  'logo_url',
  'show_reviews', 'show_coupon', 'show_features', 'show_trust', 'show_how',
  'show_faq', 'show_countdown', 'show_announce', 'show_wa'
];

const DEFAULT_REVIEWS = [
  { name: 'أحمد م. | القاهرة', rating: 5, comment: 'الخامة تقيلة فعلاً والتلبيس مظبوط، أحسن ترنج جبته الشتا ده.' },
  { name: 'مصطفى س. | الجيزة', rating: 5, comment: 'طلبت الأسود، وصل في 3 أيام والتغليف كان محترم. شكراً كايرو شيك.' },
  { name: 'كريم ع. | الأسكندرية', rating: 5, comment: 'المقاس طلع مظبوط واللون البيج شيك أوي على الطبيعة.' }
];

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
      announcement: '🚚 شحن سريع لكل محافظات مصر (ماعدا سيناء) — الدفع عند الاستلام 💵',
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

  // ---------- Seed default testimonials once (product 1) ----------
  if (!(await getSetting('reviews_seeded'))) {
    const has1 = await q`SELECT id FROM products WHERE id = 1`;
    if (has1.rows.length) {
      for (const r of DEFAULT_REVIEWS) {
        await q`INSERT INTO reviews(product_id,name,rating,comment,approved)
          VALUES(${'1'},${r.name},${r.rating},${r.comment},${1})`;
      }
    }
    await setSetting('reviews_seeded', '1');
  }

  // ---------- Backfill items JSON for pre-cart orders (once, then no-op) ----------
  try {
    const old = await q`SELECT id, product_id, product_name, color, size, qty, unit_price FROM orders WHERE items = '' OR items = '[]' OR items IS NULL LIMIT 200`;
    for (const o of old.rows) {
      const items = JSON.stringify([{
        pid: o.product_id, name: o.product_name || '', color: o.color || '',
        size: o.size || '', qty: Number(o.qty) || 1, unit: Number(o.unit_price) || 0
      }]);
      await q`UPDATE orders SET items = ${items} WHERE id = ${o.id}`;
    }
    if (old.rows.length) console.log(`↩️ Backfilled items for ${old.rows.length} order(s)`);
  } catch (e) { console.error('items backfill failed', e); }

  // ---------- Rate limits (in-memory, per isolate) ----------
  const hits = new Map();
  function limit(kind, max) {
    return async (c, next) => {
      const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'x';
      const key = kind + ':' + ip;
      const now = Date.now();
      const rec = hits.get(key) || { count: 0, reset: now + 3600e3 };
      if (now > rec.reset) { rec.count = 0; rec.reset = now + 3600e3; }
      rec.count++;
      hits.set(key, rec);
      if (rec.count > max) return c.json({ ok: false, error: 'محاولات كتير، جرب كمان شوية' }, 429);
      return next();
    };
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
    let govs = (await q`SELECT name, shipping FROM governorates ORDER BY sort`).rows;
    if (!govs.length) {
      govs = GOVERNORATES.map(g => ({ name: g, shipping: CITY_GOVS.includes(g) ? 50 : 70 }));
    }
    const out = {
      ok: true,
      governorates: govs.map(g => ({ name: g.name, shipping: Number(g.shipping) })),
      areas: AREAS,
      city_govs: CITY_GOVS,
      shipping_cities: Number(s.shipping_cities || 50),
      shipping_others: Number(s.shipping_others || 70)
    };
    for (const k of SETTINGS_KEYS) out[k] = s[k] || '';
    return c.json(out);
  });

  app.get('/api/products', async (c) => {
    const { rows } = await q`SELECT * FROM products WHERE active = 1 ORDER BY featured DESC, id`;
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

  app.get('/img/site/:key', async (c) => {
    const { rows } = await q`SELECT data, mime FROM site_images WHERE key = ${c.req.param('key')}`;
    if (!rows.length || !rows[0].data) return c.notFound();
    const bytes = base64ToBytes(rows[0].data);
    return new Response(bytes, {
      headers: { 'Content-Type': rows[0].mime || 'image/jpeg', 'Cache-Control': 'public, max-age=86400' }
    });
  });

  // ---------- Public: coupon validate ----------
  app.post('/api/coupon', limit('coupon', 30), async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
    const subtotal = Math.max(0, Number(b.subtotal) || 0);
    if (!code) return c.json({ ok: false, error: 'اكتب الكود' });
    const cr = await q`SELECT * FROM coupons WHERE code = ${code} AND active = 1`;
    if (!cr.rows.length) return c.json({ ok: false, error: 'الكود غلط أو منتهي' });
    const cp = cr.rows[0];
    if (Number(cp.min_order) > 0 && subtotal < Number(cp.min_order))
      return c.json({ ok: false, error: `الكود ده للطلبات فوق ${cp.min_order} جنيه` });
    const discount = calcDiscount(cp.kind, cp.value, subtotal);
    if (!discount) return c.json({ ok: false, error: 'الكود مش شغال على المبلغ ده' });
    return c.json({
      ok: true, code: cp.code, discount,
      kind: cp.kind, value: Number(cp.value), min_order: Number(cp.min_order)
    });
  });

  // ---------- Public: reviews ----------
  app.get('/api/products/:id/reviews', async (c) => {
    const { rows } = await q`SELECT name, rating, comment, created_at FROM reviews
      WHERE product_id = ${c.req.param('id')} AND approved = 1 ORDER BY id DESC LIMIT 50`;
    return c.json({ ok: true, reviews: rows });
  });

  app.post('/api/products/:id/reviews', limit('review', 5), async (c) => {
    const v = validateReviewBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const pr = await q`SELECT id FROM products WHERE id = ${c.req.param('id')} AND active = 1`;
    if (!pr.rows.length) return c.json({ ok: false, error: 'المنتج غير متاح' });
    const d = v.data;
    await q`INSERT INTO reviews(product_id,name,rating,comment,approved)
      VALUES(${c.req.param('id')},${d.name},${d.rating},${d.comment},${0})`;
    return c.json({ ok: true });
  });

  app.post('/api/order', limit('order', 10), async (c) => {
    try {
      if ((await getSetting('maint_enabled')) === '1')
        return c.json({ ok: false, error: 'المتجر تحت التحديث حالياً 🛠 — حاول كمان شوية' });
      const b = await c.req.json().catch(() => ({}));
      let { name, phone, governorate, area, address, notes } = b;
      name = String(name || '').trim();
      area = String(area || '').trim();
      address = String(address || '').trim();
      notes = String(notes || '').trim();
      phone = normalizePhone(phone);

      if (name.length < 3) return c.json({ ok: false, error: 'اكتب الاسم بالكامل (3 حروف على الأقل)' });
      if (!/^01[0125][0-9]{8}$/.test(phone)) return c.json({ ok: false, error: 'رقم الموبايل غلط — لازم يبدأ بـ 01 ومكوّن من 11 رقم' });
      if (address.length < 5) return c.json({ ok: false, error: 'اكتب العنوان بالتفصيل' });

      const gr = await q`SELECT shipping FROM governorates WHERE name = ${governorate}`;
      if (!gr.rows.length) return c.json({ ok: false, error: 'اختار المحافظة' });
      const areas = AREAS[governorate];
      if (areas ? !areas.includes(area) : area.length < 2)
        return c.json({ ok: false, error: 'اختار المركز / المنطقة' });

      // normalize items (support legacy single-product payload)
      let rawItems = [];
      if (Array.isArray(b.items) && b.items.length) {
        rawItems = b.items.slice(0, 10).map(it => ({
          product_id: it.product_id,
          color: String(it.color || ''),
          size: String(it.size || ''),
          qty: Math.max(1, Math.min(5, parseInt(it.qty) || 1))
        }));
      } else if (b.product_id) {
        rawItems = [{
          product_id: b.product_id,
          color: String(b.color || ''),
          size: String(b.size || ''),
          qty: Math.max(1, Math.min(5, parseInt(b.qty) || 1))
        }];
      }
      if (!rawItems.length) return c.json({ ok: false, error: 'السلة فاضية — ضيف منتج الأول 🛒' });

      const lines = [];
      for (const it of rawItems) {
        const pr = await q`SELECT * FROM products WHERE id = ${it.product_id} AND active = 1`;
        if (!pr.rows.length) return c.json({ ok: false, error: 'في منتج في السلة بقى غير متاح — حدّث الصفحة وحاول تاني' });
        const pp = parseProduct(pr.rows[0]);
        if (!pp.colors.map(x => x.name).includes(it.color)) return c.json({ ok: false, error: `(${pp.name}): اختار اللون` });
        if (!pp.sizes.includes(it.size)) return c.json({ ok: false, error: `(${pp.name}): اختار المقاس` });
        lines.push({ pid: pp.id, name: pp.name, color: it.color, size: it.size, qty: it.qty, unit: Number(pp.price) });
      }
      const subtotal = lines.reduce((a, l) => a + l.unit * l.qty, 0);

      // coupon (revalidated server-side, never trust client math)
      let couponCode = '', discount = 0;
      const rawCode = String(b.coupon_code || '').trim().toUpperCase().replace(/\s+/g, '');
      if (rawCode) {
        const cr = await q`SELECT * FROM coupons WHERE code = ${rawCode} AND active = 1`;
        if (!cr.rows.length) return c.json({ ok: false, error: 'كود الخصم غلط أو منتهي' });
        const cp = cr.rows[0];
        if (Number(cp.min_order) > 0 && subtotal < Number(cp.min_order))
          return c.json({ ok: false, error: `الكود ده للطلبات فوق ${cp.min_order} جنيه` });
        discount = calcDiscount(cp.kind, cp.value, subtotal);
        if (!discount) return c.json({ ok: false, error: 'الكود ده مش شغال على الطلب ده' });
        couponCode = cp.code;
      }

      const shipping = Number(gr.rows[0].shipping);
      const total = subtotal - discount + shipping;
      const first = lines[0];

      const ins = await q`INSERT INTO orders
        (product_id, product_name, color, size, qty, unit_price, shipping, total, coupon_code, discount, items,
         name, phone, governorate, area, address, notes)
        VALUES (${first.pid},${first.name},${first.color},${first.size},${first.qty},${first.unit},
          ${shipping},${total},${couponCode},${discount},${JSON.stringify(lines)},
          ${name},${phone},${governorate},${area},${address},${notes})
        RETURNING id`;
      const id = ins.rows[0].id;
      const order_no = 'CC-' + (100000 + Number(id));
      await q`UPDATE orders SET order_no = ${order_no} WHERE id = ${id}`;

      return c.json({ ok: true, order_no, total, shipping, discount, items_count: lines.length });
    } catch (e) {
      console.error('order error', e);
      return c.json({ ok: false, error: 'حصل خطأ، حاول تاني' }, 500);
    }
  });

  // ---------- Public: order tracking ----------
  const TRACK_STEPS = [
    { k: 'new', t: '📝 طلبك اتسجل' },
    { k: 'confirmed', t: '✅ أكدنا طلبك' },
    { k: 'preparing', t: '📦 بنجهز طلبك' },
    { k: 'shipped', t: '🚚 طلبك في الطريق' },
    { k: 'delivered', t: '✔ طلبك وصل' }
  ];
  app.get('/api/track', limit('track', 20), async (c) => {
    const order_no = String(c.req.query('order_no') || '').trim().toUpperCase();
    const phone = normalizePhone(c.req.query('phone'));
    if (!order_no || !phone) return c.json({ ok: false, error: 'اكتب رقم الطلب ورقم الموبايل' });
    const { rows } = await q`SELECT order_no, status, name, governorate, area, total, items, created_at
      FROM orders WHERE order_no = ${order_no} AND phone = ${phone}`;
    if (!rows.length) return c.json({ ok: false, error: 'مفيش طلب بالبيانات دي — تأكد من رقم الطلب ورقم الموبايل' });
    const o = rows[0];
    let items = [];
    try { items = JSON.parse(o.items || '[]'); } catch { items = []; }
    const idx = TRACK_STEPS.findIndex(s => s.k === o.status);
    return c.json({
      ok: true,
      order: {
        order_no: o.order_no, status: o.status, statusAr: STATUS_AR[o.status] || o.status,
        name: o.name, governorate: o.governorate, area: o.area || '',
        total: Number(o.total), created_at: o.created_at,
        items: items.map(l => ({ name: l.name, color: l.color, size: l.size, qty: l.qty })),
        steps: TRACK_STEPS.map((s, i) => ({ t: s.t, done: idx >= 0 && i <= idx, now: i === idx }))
      }
    });
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
    const PAGE = 50;
    const page = Math.max(1, parseInt(c.req.query('page')) || 1);
    const off = (page - 1) * PAGE;
    let rows, total;
    if (status && ORDER_STATUSES.includes(status)) {
      total = Number((await q`SELECT COUNT(*) c FROM orders WHERE status = ${status}`).rows[0].c);
      rows = (await q`SELECT * FROM orders WHERE status = ${status} ORDER BY id DESC LIMIT ${PAGE} OFFSET ${off}`).rows;
    } else {
      total = Number((await q`SELECT COUNT(*) c FROM orders`).rows[0].c);
      rows = (await q`SELECT * FROM orders ORDER BY id DESC LIMIT ${PAGE} OFFSET ${off}`).rows;
    }
    rows = rows.map(o => {
      try { o.items = JSON.parse(o.items || '[]'); } catch { o.items = []; }
      if (!o.items.length && o.product_name) {
        o.items = [{
          pid: o.product_id, name: o.product_name, color: o.color,
          size: o.size, qty: o.qty, unit: Number(o.unit_price) || 0
        }];
      }
      return o;
    });
    return c.json({ ok: true, orders: rows, statusAr: STATUS_AR, page, pages: Math.max(1, Math.ceil(total / PAGE)), total });
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

  // ---------- Admin: bulk delete orders ----------
  app.delete('/api/admin/orders', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(n => Number.isInteger(n) && n > 0).slice(0, 200);
    if (!ids.length) return c.json({ ok: false, error: 'مفيش طلبات محددة' });
    for (const id of ids) await q`DELETE FROM orders WHERE id = ${id}`;
    return c.json({ ok: true, deleted: ids.length });
  });

  // ---------- Admin: storage & cleanup ----------
  async function findOrphanImages() {
    const products = (await q`SELECT colors FROM products`).rows;
    const used = new Set();
    const re = /\/img\/(\d+)/g;
    for (const p of products) {
      let m;
      const s = String(p.colors || '');
      while ((m = re.exec(s))) used.add(Number(m[1]));
    }
    const imgs = (await q`SELECT id, LENGTH(data) s FROM product_images`).rows;
    return imgs.filter(im => !used.has(Number(im.id)));
  }

  app.get('/api/admin/storage', requireAdmin, async (c) => {
    const orphans = await findOrphanImages();
    const orphanBytes = orphans.reduce((a, im) => a + (Number(im.s) || 0), 0);
    const imgTot = (await q`SELECT COUNT(*) c, COALESCE(SUM(LENGTH(data)),0) s FROM product_images`).rows[0];
    const siteTot = (await q`SELECT COUNT(*) c, COALESCE(SUM(LENGTH(data)),0) s FROM site_images`).rows[0];
    const realKB = (b64len) => Math.round(Number(b64len) * 0.75 / 1024);
    return c.json({
      ok: true,
      stats: {
        products: Number((await q`SELECT COUNT(*) c FROM products`).rows[0].c),
        orders: Number((await q`SELECT COUNT(*) c FROM orders`).rows[0].c),
        reviews: Number((await q`SELECT COUNT(*) c FROM reviews`).rows[0].c),
        coupons: Number((await q`SELECT COUNT(*) c FROM coupons`).rows[0].c),
        images: { count: Number(imgTot.c), kb: realKB(imgTot.s) },
        siteImages: { count: Number(siteTot.c), kb: realKB(siteTot.s) },
        orphans: { count: orphans.length, kb: realKB(orphanBytes) }
      }
    });
  });

  app.delete('/api/admin/cleanup-images', requireAdmin, async (c) => {
    const orphans = await findOrphanImages();
    let freed = 0;
    for (const o of orphans) {
      await q`DELETE FROM product_images WHERE id = ${o.id}`;
      freed += Number(o.s) || 0;
    }
    return c.json({ ok: true, deleted: orphans.length, freedKB: Math.round(freed * 0.75 / 1024) });
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
    await q`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active,featured)
      VALUES(${d.name},${d.price},${d.old_price},${d.description},${d.colors},${d.sizes},${d.stock},${d.active},${d.featured})`;
    return c.json({ ok: true });
  });

  app.put('/api/admin/products/:id', requireAdmin, async (c) => {
    const v = validateProductBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const d = v.data;
    await q`UPDATE products SET name=${d.name},price=${d.price},old_price=${d.old_price},
      description=${d.description},colors=${d.colors},sizes=${d.sizes},stock=${d.stock},active=${d.active},featured=${d.featured}
      WHERE id=${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (c) => {
    await q`DELETE FROM products WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  // ---------- Admin: governorates ----------
  app.get('/api/admin/governorates', requireAdmin, async (c) => {
    const { rows } = await q`SELECT name, shipping FROM governorates ORDER BY sort`;
    return c.json({ ok: true, governorates: rows.map(g => ({ name: g.name, shipping: Number(g.shipping) })) });
  });

  app.post('/api/admin/governorates', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const name = String(b.name || '').trim();
    const shipping = Number(b.shipping);
    if (name.length < 2) return c.json({ ok: false, error: 'اكتب اسم المحافظة' });
    if (!(shipping >= 0)) return c.json({ ok: false, error: 'سعر الشحن غلط' });
    try {
      const mx = await q`SELECT COALESCE(MAX(sort),-1)+1 s FROM governorates`;
      await q`INSERT INTO governorates(name, shipping, sort) VALUES(${name},${shipping},${Number(mx.rows[0].s)})`;
    } catch {
      return c.json({ ok: false, error: 'المحافظة دي موجودة قبل كده' });
    }
    return c.json({ ok: true });
  });

  app.put('/api/admin/governorates/:name', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    const shipping = Number(b.shipping);
    if (!(shipping >= 0)) return c.json({ ok: false, error: 'سعر الشحن غلط' });
    await q`UPDATE governorates SET shipping = ${shipping} WHERE name = ${c.req.param('name')}`;
    return c.json({ ok: true });
  });

  app.delete('/api/admin/governorates/:name', requireAdmin, async (c) => {
    await q`DELETE FROM governorates WHERE name = ${c.req.param('name')}`;
    return c.json({ ok: true });
  });

  // ---------- Admin: coupons ----------
  app.get('/api/admin/coupons', requireAdmin, async (c) => {
    const { rows } = await q`SELECT * FROM coupons ORDER BY id`;
    return c.json({
      ok: true, coupons: rows.map(x => ({
        id: x.id, code: x.code, kind: x.kind, value: Number(x.value),
        min_order: Number(x.min_order), active: Number(x.active)
      }))
    });
  });

  app.post('/api/admin/coupons', requireAdmin, async (c) => {
    const v = validateCouponBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const d = v.data;
    try {
      await q`INSERT INTO coupons(code,kind,value,min_order,active) VALUES(${d.code},${d.kind},${d.value},${d.min_order},${d.active})`;
    } catch {
      return c.json({ ok: false, error: 'الكود ده موجود قبل كده' });
    }
    return c.json({ ok: true });
  });

  app.put('/api/admin/coupons/:id', requireAdmin, async (c) => {
    const v = validateCouponBody(await c.req.json().catch(() => ({})));
    if (v.error) return c.json({ ok: false, error: v.error });
    const d = v.data;
    try {
      await q`UPDATE coupons SET code=${d.code},kind=${d.kind},value=${d.value},min_order=${d.min_order},active=${d.active}
        WHERE id=${c.req.param('id')}`;
    } catch {
      return c.json({ ok: false, error: 'الكود ده موجود قبل كده' });
    }
    return c.json({ ok: true });
  });

  app.delete('/api/admin/coupons/:id', requireAdmin, async (c) => {
    await q`DELETE FROM coupons WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  // ---------- Admin: reviews moderation ----------
  app.get('/api/admin/reviews', requireAdmin, async (c) => {
    const f = c.req.query('filter');
    let rows;
    if (f === 'pending')
      rows = (await q`SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.approved = 0 ORDER BY r.id DESC`).rows;
    else if (f === 'approved')
      rows = (await q`SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id WHERE r.approved = 1 ORDER BY r.id DESC`).rows;
    else
      rows = (await q`SELECT r.*, p.name AS product_name FROM reviews r LEFT JOIN products p ON p.id = r.product_id ORDER BY r.id DESC LIMIT 200`).rows;
    return c.json({ ok: true, reviews: rows });
  });

  app.patch('/api/admin/reviews/:id', requireAdmin, async (c) => {
    const b = await c.req.json().catch(() => ({}));
    await q`UPDATE reviews SET approved = ${b.approved ? 1 : 0} WHERE id = ${c.req.param('id')}`;
    return c.json({ ok: true });
  });

  app.delete('/api/admin/reviews/:id', requireAdmin, async (c) => {
    await q`DELETE FROM reviews WHERE id = ${c.req.param('id')}`;
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

  // ---------- Admin: site images (logo etc.) ----------
  app.post('/api/admin/site-image', requireAdmin, async (c) => {
    try {
      const form = await c.req.formData();
      const key = String(form.get('key') || '').trim();
      if (!/^[a-z0-9_-]{1,20}$/.test(key)) return c.json({ ok: false, error: 'اسم الصورة غلط' });
      const file = form.get('image');
      if (!file || typeof file.arrayBuffer !== 'function') return c.json({ ok: false, error: 'اختار صورة' });
      if (!String(file.type || '').startsWith('image/')) return c.json({ ok: false, error: 'لازم ملف صورة' });
      const buf = new Uint8Array(await file.arrayBuffer());
      if (buf.length > 2.5 * 1024 * 1024) return c.json({ ok: false, error: 'الصورة كبيرة — لازم أصغر من 2.5MB' });
      const b64 = bytesToBase64(buf);
      await q`INSERT INTO site_images(key,data,mime) VALUES(${key},${b64},${file.type || 'image/jpeg'})
        ON CONFLICT(key) DO UPDATE SET data = ${b64}, mime = ${file.type || 'image/jpeg'}`;
      const url = '/img/site/' + key;
      if (key === 'logo') await setSetting('logo_url', url);
      return c.json({ ok: true, url });
    } catch (e) {
      console.error('site-image error', e);
      return c.json({ ok: false, error: 'فشل الرفع' });
    }
  });

  app.delete('/api/admin/site-image/:key', requireAdmin, async (c) => {
    const key = c.req.param('key');
    await q`DELETE FROM site_images WHERE key = ${key}`;
    if (key === 'logo') await setSetting('logo_url', '');
    return c.json({ ok: true });
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
      if (b[k] === undefined) continue;
      let v = String(b[k]);
      if (k === 'whatsapp') v = v.replace(/\D/g, '').slice(0, 20);
      else if (k === 'tiktok_pixel') v = v.trim().slice(0, 40);
      else if (k === 'theme_primary' || k === 'theme_dark') {
        v = v.trim();
        if (v && !/^#[0-9a-fA-F]{6}$/.test(v)) continue; // ignore invalid colors
      }
      else if (k === 'deal_enabled' || k === 'maint_enabled') v = (v === '1' || v === 'true' || v === 'on') ? '1' : '';
      else if (k.startsWith('show_')) v = (v === '0') ? '0' : '1';
      else if (k === 'deal_ends_at' || k === 'maint_ends_at') v = v.trim().slice(0, 25);
      else if (/^[ft][1-4]i$/.test(k)) v = v.trim().slice(0, 8);
      else v = v.trim().slice(0, 500);
      await setSetting(k, v);
    }
    return c.json({ ok: true });
  });

  return { app };
}
