// ============================================================
// lib.js — Pure shared helpers (Node + Cloudflare Workers)
// No Node-only imports allowed in this file!
// ============================================================

export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الأسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية',
  'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'مطروح',
  'شمال سيناء', 'جنوب سيناء', 'الوادي الجديد'
];
export const CITY_GOVS = ['القاهرة', 'الجيزة', 'القليوبية', 'الأسكندرية'];
export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];
export const STATUS_AR = {
  new: '🆕 جديد', confirmed: '✅ تم التأكيد', preparing: '📦 قيد التجهيز',
  shipped: '🚚 تم الشحن', delivered: '✔ تم التوصيل', cancelled: '❌ ملغي'
};

export function parseProduct(p) {
  p.price = Number(p.price); p.old_price = Number(p.old_price); p.stock = Number(p.stock);
  try { p.colors = JSON.parse(p.colors || '[]'); } catch { p.colors = []; }
  try { p.sizes = JSON.parse(p.sizes || '[]'); } catch { p.sizes = []; }
  return p;
}

export function normalizePhone(phone) {
  const ar = '٠١٢٣٤٥٦٧٨٩';
  let p = String(phone || '').trim();
  p = p.replace(/[٠-٩]/g, d => ar.indexOf(d));
  p = p.replace(/[\s-]/g, '');
  if (p.startsWith('+2')) p = p.slice(1);
  if (p.startsWith('2') && p.length === 13) p = p.slice(1);
  return p;
}

// Cairo-today boundaries as UTC ISO strings
export function cairoDayRange() {
  const now = new Date();
  const cairoWall = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Cairo' }));
  const shift = cairoWall.getTime() - now.getTime();
  const start = new Date(cairoWall); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  return [new Date(start.getTime() - shift).toISOString(), new Date(end.getTime() - shift).toISOString()];
}

export function validateProductBody(b) {
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

// ---------------- base64 helpers (no Buffer — Workers-safe) ----------------
const te = new TextEncoder();
const td = new TextDecoder();

export function bytesToBase64(bytes) {
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
  }
  return btoa(s);
}

export function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlFromBytes(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function b64urlToBytes(b64url) {
  const b = b64url.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------- Password hashing (WebCrypto — fast on Workers) ----------------
// SHA-256(salt:password:pepper). The pepper (SESSION_SECRET) lives outside the DB,
// so a DB leak alone is not enough to crack passwords offline.
async function sha256Hex(s) {
  const d = await crypto.subtle.digest('SHA-256', te.encode(s));
  return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password, pepper) {
  const salt = b64urlFromBytes(crypto.getRandomValues(new Uint8Array(16)));
  const hash = await sha256Hex(`${salt}:${password}:${pepper}`);
  return `v1$${salt}$${hash}`;
}

export async function verifyPassword(password, pepper, stored) {
  try {
    const parts = String(stored).split('$');
    if (parts.length !== 3 || parts[0] !== 'v1') return false;
    const calc = await sha256Hex(`${parts[1]}:${password}:${pepper}`);
    return timingSafeEq(calc, parts[2]);
  } catch { return false; }
}

function timingSafeEq(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------------- Signed admin tokens (stateless, no sessions table) ----------------
async function hmacB64url(data, secret) {
  const key = await crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(data));
  return b64urlFromBytes(new Uint8Array(sig));
}

export async function signToken(payload, secret) {
  const body = b64urlFromBytes(te.encode(JSON.stringify(payload)));
  return `${body}.${await hmacB64url(body, secret)}`;
}

export async function verifyToken(token, secret) {
  try {
    const [body, sig] = String(token).split('.');
    if (!body || !sig) return null;
    const good = await hmacB64url(body, secret);
    if (!timingSafeEq(good, sig)) return null;
    const p = JSON.parse(td.decode(b64urlToBytes(body)));
    if (p.exp && Date.now() > p.exp) return null;
    return p;
  } catch { return null; }
}
