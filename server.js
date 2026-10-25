// ============================================================
// CAIRO CHIC STORE - Backend (Express + SQLite/Postgres)
// Local dev: SQLite file | Production: Postgres via DATABASE_URL
// ============================================================
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
app.set('trust proxy', 1);

let sharp = null;
try { sharp = require('sharp'); } catch { console.log('ℹ️ sharp not available — uploads stored as-is'); }

// ---------------- Constants ----------------
const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الأسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية',
  'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'مطروح',
  'شمال سيناء', 'جنوب سيناء', 'الوادي الجديد'
];
const CITY_GOVS = ['القاهرة', 'الجيزة', 'القليوبية', 'الأسكندرية'];
const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
const STATUS_AR = {
  new: '🆕 جديد', confirmed: '✅ تم التأكيد', preparing: '📦 قيد التجهيز',
  shipped: '🚚 تم الشحن', delivered: '✔ تم التوصيل', cancelled: '❌ ملغي'
};

// ---------------- Helpers ----------------
async function getSetting(k, d = '') {
  const { rows } = await db.q('SELECT value FROM settings WHERE key=$1', [k]);
  return rows.length ? rows[0].value : d;
}
async function setSetting(k, v) {
  await db.q('INSERT INTO settings(key,value) VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [k, String(v)]);
}
function parseProduct(p) {
  p.price = Number(p.price); p.old_price = Number(p.old_price); p.stock = Number(p.stock);
  try { p.colors = JSON.parse(p.colors || '[]'); } catch { p.colors = []; }
  try { p.sizes = JSON.parse(p.sizes || '[]'); } catch { p.sizes = []; }
  return p;
}
function normalizePhone(phone) {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let p = String(phone || '').trim();
  p = p.replace(/[٠-٩]/g, d => ar.indexOf(d));
  p = p.replace(/[\s-]/g, '');
  if (p.startsWith('+2')) p = p.slice(1);
  if (p.startsWith('2') && p.length === 13) p = p.slice(1);
  return p;
}
// Cairo-today boundaries as UTC ISO strings (works for both DBs)
function cairoDayRange() {
  const now = new Date();
  const cairoWall = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const shift = cairoWall.getTime() - now.getTime();
  const start = new Date(cairoWall); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [new Date(start.getTime() - shift).toISOString(), new Date(end.getTime() - shift).toISOString()];
}

// Rate-limit: 10 orders/hour per IP
const orderHits = new Map();
function orderRateLimit(req, res, next) {
  const ip = req.ip || 'x';
  const now = Date.now();
  const rec = orderHits.get(ip) || { count: 0, reset: now + 3600e3 };
  if (now > rec.reset) { rec.count = 0; rec.reset = now + 3600e3; }
  rec.count++;
  orderHits.set(ip, rec);
  if (rec.count > 10) return res.status(429).json({ ok: false, error: 'محاولات كتير، جرب كمان شوية' });
  next();
}
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin) return next();
  return res.status(401).json({ ok: false, error: 'غير مسموح' });
}

// ---------------- Boot ----------------
async function start() {
  await db.init();
  console.log('📦 Database:', db.describe());

  // Seed (first run only)
  if (!(await getSetting('seeded'))) {
    const defaults = {
      store_name_ar: 'كايرو شيك', store_name_en: 'CAIRO CHIC',
      whatsapp: '', tiktok_pixel: '',
      shipping_cities: '50', shipping_others: '70',
      announcement: '🚚 شحن سريع لكل محافظات مصر — الدفع عند الاستلام 💵',
      admin_password: bcrypt.hashSync('admin123', 10), seeded: '1'
    };
    for (const [k, v] of Object.entries(defaults)) await setSetting(k, v);
    const colors = JSON.stringify([
      { name: 'البيج', image: '/images/v11-beige.jpg' },
      { name: 'الأسود', image: '/images/v11-black.jpg' },
      { name: 'الكحلي', image: '/images/v11-blue.jpg' },
      { name: 'الرمادي', image: '/images/v11-gray.jpg' }
    ]);
    await db.q(`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      ['ترنج V11 الشتوي', 599, 850,
        'ترنج V11 الشتوي بخامة ميلتون تقيلة تدفيك في عز البرد، وتلبيس مظبوط وشيك يخليك فورمة طول اليوم. مناسب للخروجات والجامعة والشغل.',
        colors, JSON.stringify(['M', 'L', 'XL', 'XXL']), 100, 1]);
    console.log('✅ Database seeded (admin password: admin123)');
  }

  // Persistent admin sessions on Postgres, memory otherwise
  let store;
  if (db.isPg && db.pool) {
    try {
      const PgStore = require('connect-pg-simple')(session);
      store = new PgStore({ pool: db.pool, createTableIfMissing: true });
      console.log('🔐 Admin sessions: Postgres');
    } catch (e) { console.log('⚠️ pg session store failed, using memory'); }
  }

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(session({
    store,
    secret: process.env.SESSION_SECRET || 'cairo-chic-dev-secret-CHANGE-ME',
    resave: false, saveUninitialized: false,
    cookie: { maxAge: 12 * 3600 * 1000, secure: 'auto', sameSite: 'lax' }
  }));

  // Health check — NO database access (for keepalive pings)
  app.get('/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

  // ---------- PUBLIC API ----------
  app.get('/api/settings-public', async (req, res) => {
    res.json({
      ok: true,
      store_name_ar: await getSetting('store_name_ar'),
      store_name_en: await getSetting('store_name_en'),
      whatsapp: await getSetting('whatsapp'),
      tiktok_pixel: await getSetting('tiktok_pixel'),
      shipping_cities: Number(await getSetting('shipping_cities', '50')),
      shipping_others: Number(await getSetting('shipping_others', '70')),
      announcement: await getSetting('announcement'),
      governorates: GOVERNORATES, city_govs: CITY_GOVS
    });
  });

  app.get('/api/products', async (req, res) => {
    const { rows } = await db.q('SELECT * FROM products WHERE active=1 ORDER BY id');
    res.json({ ok: true, products: rows.map(parseProduct) });
  });

  // Images stored in DB (survive redeploys on free hosting)
  app.get('/img/:id', async (req, res) => {
    const { rows } = await db.q('SELECT data,mime FROM product_images WHERE id=$1', [req.params.id]);
    if (!rows.length) return res.status(404).end();
    res.set('Content-Type', rows[0].mime || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=2592000');
    res.send(rows[0].data);
  });

  app.post('/api/order', orderRateLimit, async (req, res) => {
    try {
      let { product_id, color, size, qty, name, phone, governorate, address, notes } = req.body || {};
      name = String(name || '').trim();
      address = String(address || '').trim();
      notes = String(notes || '').trim();
      phone = normalizePhone(phone);
      qty = Math.max(1, Math.min(5, parseInt(qty) || 1));

      if (name.length < 3) return res.json({ ok: false, error: 'اكتب الاسم بالكامل (3 حروف على الأقل)' });
      if (!/^01[0125][0-9]{8}$/.test(phone)) return res.json({ ok: false, error: 'رقم الموبايل غلط — لازم يبدأ بـ 01 ومكوّن من 11 رقم' });
      if (!GOVERNORATES.includes(governorate)) return res.json({ ok: false, error: 'اختار المحافظة' });
      if (address.length < 5) return res.json({ ok: false, error: 'اكتب العنوان بالتفصيل' });

      const pr = await db.q('SELECT * FROM products WHERE id=$1 AND active=1', [product_id]);
      if (!pr.rows.length) return res.json({ ok: false, error: 'المنتج غير متاح' });
      const pp = parseProduct(pr.rows[0]);
      if (!pp.colors.map(c => c.name).includes(color)) return res.json({ ok: false, error: 'اختار اللون' });
      if (!pp.sizes.includes(size)) return res.json({ ok: false, error: 'اختار المقاس' });

      const unit = Number(pp.price);
      const shipping = CITY_GOVS.includes(governorate)
        ? Number(await getSetting('shipping_cities', '50'))
        : Number(await getSetting('shipping_others', '70'));
      const total = unit * qty + shipping;

      const RET = db.pgLike ? 'RETURNING id' : '';
      const r = await db.q(`INSERT INTO orders
        (product_id, product_name, color, size, qty, unit_price, shipping, total, name, phone, governorate, address, notes)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ${RET}`,
        [pp.id, pp.name, color, size, qty, unit, shipping, total, name, phone, governorate, address, notes]);
      const id = db.pgLike ? r.rows[0].id : r.lastID;
      const order_no = 'CC-' + (100000 + id);
      await db.q('UPDATE orders SET order_no=$1 WHERE id=$2', [order_no, id]);

      res.json({ ok: true, order_no, total, shipping });
    } catch (e) {
      console.error('order error', e);
      res.status(500).json({ ok: false, error: 'حصل خطأ، حاول تاني' });
    }
  });

  // ---------- ADMIN: auth ----------
  app.post('/api/admin/login', async (req, res) => {
    const { password } = req.body || {};
    const hash = await getSetting('admin_password');
    if (password && hash && bcrypt.compareSync(String(password), hash)) {
      req.session.admin = true;
      return res.json({ ok: true });
    }
    res.json({ ok: false, error: 'الباسورد غلط' });
  });
  app.post('/api/admin/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
  app.get('/api/admin/me', (req, res) => res.json({ ok: true, admin: !!req.session.admin }));
  app.post('/api/admin/password', requireAdmin, async (req, res) => {
    const { current, next } = req.body || {};
    if (!bcrypt.compareSync(String(current || ''), await getSetting('admin_password')))
      return res.json({ ok: false, error: 'الباسورد الحالي غلط' });
    if (String(next || '').length < 6) return res.json({ ok: false, error: 'الباسورد الجديد لازم 6 حروف على الأقل' });
    await setSetting('admin_password', bcrypt.hashSync(String(next), 10));
    res.json({ ok: true });
  });

  // ---------- ADMIN: stats & orders ----------
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    const counts = (await db.q('SELECT status, COUNT(*) c FROM orders GROUP BY status')).rows;
    const byStatus = {};
    ORDER_STATUSES.forEach(s => byStatus[s] = 0);
    counts.forEach(r => byStatus[r.status] = Number(r.c));
    const revenue = Number((await db.q(`SELECT COALESCE(SUM(total),0) s FROM orders WHERE status != 'cancelled'`)).rows[0].s);
    const [from, to] = cairoDayRange();
    const today = Number((await db.q('SELECT COUNT(*) c FROM orders WHERE created_at >= $1 AND created_at < $2', [from, to])).rows[0].c);
    const total = Number((await db.q('SELECT COUNT(*) c FROM orders')).rows[0].c);
    res.json({ ok: true, byStatus, revenue, today, total, statusAr: STATUS_AR });
  });

  app.get('/api/admin/orders', requireAdmin, async (req, res) => {
    const { status } = req.query;
    let rows;
    if (status && ORDER_STATUSES.includes(status))
      rows = (await db.q('SELECT * FROM orders WHERE status=$1 ORDER BY id DESC', [status])).rows;
    else
      rows = (await db.q('SELECT * FROM orders ORDER BY id DESC LIMIT 500')).rows;
    res.json({ ok: true, orders: rows, statusAr: STATUS_AR });
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    const { status } = req.body || {};
    if (!ORDER_STATUSES.includes(status)) return res.json({ ok: false, error: 'حالة غلط' });
    await db.q('UPDATE orders SET status=$1 WHERE id=$2', [status, req.params.id]);
    res.json({ ok: true });
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (req, res) => {
    await db.q('DELETE FROM orders WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- ADMIN: products ----------
  app.get('/api/admin/products', requireAdmin, async (req, res) => {
    const { rows } = await db.q('SELECT * FROM products ORDER BY id');
    res.json({ ok: true, products: rows.map(parseProduct) });
  });

  function validateProductBody(b) {
    const name = String(b.name || '').trim();
    const price = Number(b.price);
    const old_price = Number(b.old_price || 0);
    if (name.length < 2) return { error: 'اسم المنتج مطلوب' };
    if (!(price > 0)) return { error: 'السعر لازم يكون أكبر من صفر' };
    let colors = Array.isArray(b.colors) ? b.colors : [];
    colors = colors.filter(c => c && c.name).map(c => ({ name: String(c.name), image: String(c.image || '') }));
    if (!colors.length) return { error: 'ضيف لون واحد على الأقل' };
    const sizes = Array.isArray(b.sizes) ? b.sizes.map(s => String(s).trim()).filter(Boolean) : [];
    if (!sizes.length) return { error: 'ضيف مقاس واحد على الأقل' };
    return {
      data: {
        name, price, old_price, description: String(b.description || ''),
        colors: JSON.stringify(colors), sizes: JSON.stringify(sizes),
        stock: parseInt(b.stock) || 0, active: b.active ? 1 : 0
      }
    };
  }

  app.post('/api/admin/products', requireAdmin, async (req, res) => {
    const v = validateProductBody(req.body || {});
    if (v.error) return res.json({ ok: false, error: v.error });
    const d = v.data;
    await db.q(`INSERT INTO products(name,price,old_price,description,colors,sizes,stock,active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8)`, [d.name, d.price, d.old_price, d.description, d.colors, d.sizes, d.stock, d.active]);
    res.json({ ok: true });
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req, res) => {
    const v = validateProductBody(req.body || {});
    if (v.error) return res.json({ ok: false, error: v.error });
    const d = v.data;
    await db.q(`UPDATE products SET name=$1,price=$2,old_price=$3,description=$4,colors=$5,sizes=$6,stock=$7,active=$8 WHERE id=$9`,
      [d.name, d.price, d.old_price, d.description, d.colors, d.sizes, d.stock, d.active, req.params.id]);
    res.json({ ok: true });
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    await db.q('DELETE FROM products WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  });

  // ---------- ADMIN: image upload → stored in DB (survives redeploys) ----------
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 8 * 1024 * 1024 },
    fileFilter: (req, file, cb) => file.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('images only'))
  });
  app.post('/api/admin/upload', requireAdmin, upload.single('image'), async (req, res) => {
    try {
      if (!req.file) return res.json({ ok: false, error: 'اختار صورة' });
      let buf = req.file.buffer, mime = 'image/jpeg';
      if (sharp) {
        try {
          buf = await sharp(req.file.buffer).resize(1200, 1200, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
        } catch { if (buf.length > 3 * 1024 * 1024) return res.json({ ok: false, error: 'الصورة كبيرة أوي' }); mime = req.file.mimetype; }
      } else if (buf.length > 3 * 1024 * 1024) {
        return res.json({ ok: false, error: 'الصورة كبيرة — اختار صورة أصغر من 3MB' });
      } else mime = req.file.mimetype;
      const RET = db.pgLike ? 'RETURNING id' : '';
      const r = await db.q(`INSERT INTO product_images(data,mime) VALUES($1,$2) ${RET}`, [buf, mime]);
      const id = db.pgLike ? r.rows[0].id : r.lastID;
      res.json({ ok: true, url: '/img/' + id });
    } catch (e) {
      console.error('upload error', e);
      res.json({ ok: false, error: 'فشل الرفع' });
    }
  });

  // ---------- ADMIN: settings ----------
  const SETTINGS_KEYS = ['store_name_ar', 'store_name_en', 'whatsapp', 'tiktok_pixel', 'shipping_cities', 'shipping_others', 'announcement'];
  app.get('/api/admin/settings', requireAdmin, async (req, res) => {
    const out = {};
    for (const k of SETTINGS_KEYS) out[k] = await getSetting(k);
    res.json({ ok: true, settings: out });
  });
  app.put('/api/admin/settings', requireAdmin, async (req, res) => {
    const b = req.body || {};
    for (const k of SETTINGS_KEYS) {
      if (b[k] !== undefined) {
        let v = String(b[k]).trim();
        if (k === 'whatsapp') v = v.replace(/\D/g, '');
        await setSetting(k, v);
      }
    }
    res.json({ ok: true });
  });

  // ---------- Pages ----------
  app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
  app.use(express.static(path.join(__dirname, 'public')));

  app.listen(PORT, '0.0.0.0', () => console.log(`🚀 Cairo Chic store running on port ${PORT}`));
}

start().catch(e => { console.error('FATAL:', e); process.exit(1); });
