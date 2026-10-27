// ============================================================
// lib.js — Pure shared helpers (Node + Cloudflare Workers)
// No Node-only imports allowed in this file!
// ============================================================

export const GOVERNORATES = [
  'القاهرة', 'الجيزة', 'الأسكندرية', 'القليوبية', 'الدقهلية', 'الشرقية',
  'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط', 'بورسعيد',
  'الإسماعيلية', 'السويس', 'الفيوم', 'بني سويف', 'المنيا', 'أسيوط',
  'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر', 'مطروح', 'الوادي الجديد'
];
// NOTE: شمال/جنوب سيناء removed — no delivery there (deleted from DB in init too).
export const CITY_GOVS = ['القاهرة', 'الجيزة', 'القليوبية', 'الأسكندرية'];
export const ORDER_STATUSES = ['new', 'confirmed', 'preparing', 'shipped', 'delivered', 'cancelled'];

// المراكز/الأحياء لكل محافظة (ماعدا سيناء — مش بنوصلها).
// Keys MUST match governorate names exactly.
export const AREAS = {
'القاهرة': ['مدينة نصر', 'مصر الجديدة', 'النزهة', 'عين شمس', 'المرج', 'عزبة النخل', 'السلام', 'المطرية', 'الزيتون', 'حدائق القبة', 'الشرابية', 'الزاوية الحمراء', 'الساحل', 'روض الفرج', 'شبرا', 'الوايلي', 'العباسية', 'الظاهر', 'الأزبكية', 'عابدين', 'وسط البلد', 'الموسكي', 'باب الشعرية', 'الجمالية', 'الدرب الأحمر', 'منشية ناصر', 'الخليفة', 'المقطم', 'السيدة زينب', 'مصر القديمة', 'الفسطاط', 'دار السلام', 'البساتين', 'المعادي', 'زهراء المعادي', 'طرة', 'المعصرة', 'حلوان', 'التبين', '15 مايو', 'التجمع الأول', 'التجمع الثالث', 'التجمع الخامس', 'الرحاب', 'مدينتي', 'الشروق', 'بدر', 'العاصمة الإدارية', 'القاهرة الجديدة', 'الزمالك', 'قصر النيل', 'جاردن سيتي', 'بولاق أبو العلا'],
'الجيزة': ['الدقي', 'العجوزة', 'المهندسين', 'ميت عقبة', 'بولاق الدكرور', 'فيصل', 'الهرم', 'العمرانية', 'الطالبية', 'المنيب', 'الجيزة', 'ساقية مكي', 'إمبابة', 'الوراق', 'أوسيم', 'كرداسة', 'منشأة القناطر', 'أبو النمرس', 'الحوامدية', 'البدرشين', 'دهشور', 'العياط', 'الصف', 'أطفيح', '6 أكتوبر', 'حدائق أكتوبر', 'الشيخ زايد', 'الواحات البحرية'],
'الأسكندرية': ['سيدي بشر', 'العصافرة', 'ميامي', 'المندرة', 'المنتزه', 'أبو قير', 'المعمورة', 'لوران', 'سان ستيفانو', 'جليم', 'سيدي جابر', 'سموحة', 'الإبراهيمية', 'سبورتنج', 'كليوباترا', 'كامب شيزار', 'الشاطبي', 'الأزاريطة', 'محطة الرمل', 'المنشية', 'بحري', 'رأس التين', 'الجمرك', 'اللبان', 'العطارين', 'كرموز', 'محرم بك', 'الحضرة', 'باكوس', 'الرمل', 'فيكتوريا', 'السيوف', 'الفلكي', 'القباري', 'مينا البصل', 'الورديان', 'الدخيلة', 'العجمي', 'العامرية', 'النهضة', 'برج العرب', 'برج العرب الجديدة', 'أبيس'],
'القليوبية': ['بنها', 'طوخ', 'قها', 'كفر شكر', 'شبين القناطر', 'الخانكة', 'الخصوص', 'العبور', 'قليوب', 'شبرا الخيمة', 'بهتيم', 'مسطرد', 'القناطر الخيرية'],
'الدقهلية': ['المنصورة', 'حي الجامعة', 'طلخا', 'ميت غمر', 'دكرنس', 'أجا', 'السنبلاوين', 'بني عبيد', 'المنزلة', 'المطرية', 'الجمالية', 'ميت سلسيل', 'منية النصر', 'الكردي', 'شربين', 'بلقاس', 'جمصة', 'نبروه', 'محلة دمنة', 'تمي الأمديد'],
'الشرقية': ['الزقازيق', 'العاشر من رمضان', 'بلبيس', 'مشتول السوق', 'منيا القمح', 'القنايات', 'القرين', 'ههيا', 'الإبراهيمية', 'ديرب نجم', 'أبو كبير', 'كفر صقر', 'أولاد صقر', 'فاقوس', 'الحسينية', 'صان الحجر', 'منشأة أبو عمر', 'أبو حماد', 'الصالحية الجديدة'],
'الغربية': ['طنطا', 'المحلة الكبرى', 'كفر الزيات', 'زفتى', 'السنطة', 'سمنود', 'بسيون', 'قطور'],
'المنوفية': ['شبين الكوم', 'قويسنا', 'بركة السبع', 'الباجور', 'منوف', 'سرس الليان', 'أشمون', 'السادات', 'الشهداء', 'تلا'],
'البحيرة': ['دمنهور', 'كفر الدوار', 'رشيد', 'إدكو', 'أبو المطامير', 'حوش عيسى', 'الدلنجات', 'كوم حمادة', 'بدر', 'وادي النطرون', 'النوبارية الجديدة', 'إيتاي البارود', 'شبراخيت', 'الرحمانية', 'المحمودية', 'أبو حمص'],
'كفر الشيخ': ['كفر الشيخ', 'دسوق', 'فوه', 'مطوبس', 'بلطيم', 'مصيف بلطيم', 'البرلس', 'الحامول', 'بيلا', 'الرياض', 'سيدي سالم', 'قلين'],
'دمياط': ['دمياط', 'دمياط الجديدة', 'رأس البر', 'عزبة البرج', 'فارسكور', 'الروضة', 'كفر سعد', 'كفر البطيخ', 'ميت أبو غالب', 'الزرقا', 'السرو'],
'بورسعيد': ['حي الشرق', 'حي العرب', 'حي المناخ', 'حي الضواحي', 'حي الزهور', 'حي الجنوب', 'بورفؤاد', 'الكاب', 'أم خلف'],
'الإسماعيلية': ['الإسماعيلية', 'فايد', 'سرابيوم', 'القنطرة شرق', 'القنطرة غرب', 'التل الكبير', 'أبو صوير', 'القصاصين'],
'السويس': ['حي السويس', 'حي الأربعين', 'حي فيصل', 'حي الجناين', 'عتاقة', 'الأدبية', 'العين السخنة', 'قرية عامر'],
'الفيوم': ['الفيوم', 'سنورس', 'طامية', 'إطسا', 'إبشواي', 'يوسف الصديق', 'قرية تونس', 'الفيوم الجديدة'],
'بني سويف': ['بني سويف', 'الواسطى', 'ناصر', 'إهناسيا', 'ببا', 'سمسطا', 'الفشن', 'بني سويف الجديدة'],
'المنيا': ['المنيا', 'العدوة', 'مغاغة', 'بني مزار', 'مطاي', 'سمالوط', 'أبو قرقاص', 'ملوي', 'دير مواس', 'المنيا الجديدة'],
'أسيوط': ['أسيوط', 'ديروط', 'القوصية', 'أبنوب', 'منفلوط', 'أبو تيج', 'الغنايم', 'ساحل سليم', 'البداري', 'صدفا', 'الفتح', 'أسيوط الجديدة', 'الهضبة'],
'سوهاج': ['سوهاج', 'حي شرق', 'حي غرب', 'أخميم', 'ساقلتة', 'طهطا', 'طما', 'المراغة', 'جزيرة شندويل', 'جهينة', 'المنشاة', 'جرجا', 'البلينا', 'دار السلام', 'سوهاج الجديدة', 'الكوامل'],
'قنا': ['قنا', 'أبو تشت', 'فرشوط', 'نجع حمادي', 'الوقف', 'دشنا', 'قفط', 'قوص', 'نقادة', 'قنا الجديدة'],
'الأقصر': ['الأقصر', 'البياضية', 'القرنة', 'الطود', 'إسنا', 'أرمنت', 'الزينية'],
'أسوان': ['أسوان', 'دراو', 'كوم أمبو', 'نصر النوبة', 'كلابشة', 'إدفو', 'الرديسية', 'أبو سمبل', 'أسوان الجديدة'],
'البحر الأحمر': ['الغردقة', 'الجونة', 'مكادي', 'سهل حشيش', 'رأس غارب', 'سفاجا', 'القصير', 'مرسى علم', 'الشلاتين', 'حلايب', 'أبو رماد'],
'مطروح': ['مرسى مطروح', 'الحمام', 'العلمين', 'مارينا', 'سيدي عبد الرحمن', 'الضبعة', 'رأس الحكمة', 'النجيلة', 'سيدي براني', 'السلوم', 'سيوة'],
'الوادي الجديد': ['الخارجة', 'الداخلة', 'الفرافرة', 'باريس', 'بلاط']
};
export const STATUS_AR = {
  new: '🆕 جديد', confirmed: '✅ تم التأكيد', preparing: '📦 قيد التجهيز',
  shipped: '🚚 تم الشحن', delivered: '✔ تم التوصيل', cancelled: '❌ ملغي'
};

export function parseProduct(p) {
  p.price = Number(p.price); p.old_price = Number(p.old_price); p.stock = Number(p.stock);
  p.featured = Number(p.featured) || 0;
  try { p.colors = JSON.parse(p.colors || '[]'); } catch { p.colors = []; }
  try { p.sizes = JSON.parse(p.sizes || '[]'); } catch { p.sizes = []; }
  try { p.size_guide = JSON.parse(p.size_guide || '[]'); } catch { p.size_guide = []; }
  if (!Array.isArray(p.size_guide)) p.size_guide = [];
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
  const video = String(b.video || '').trim().slice(0, 500);
  if (video && !/^https?:\/\/\S+\.\S+/.test(video)) return { error: 'رابط الفيديو غلط — لازم يبدأ بـ http' };
  // per-product size/weight guide: [{size, from, to}] — null = absent (keep existing on update)
  let size_guide = null;
  if (Array.isArray(b.size_guide)) {
    size_guide = JSON.stringify(b.size_guide.map(r => ({
      size: String(r.size || '').trim().slice(0, 10),
      from: Math.max(0, Number(r.from) || 0),
      to: Math.max(0, Number(r.to) || 0)
    })).filter(r => r.size && r.to > 0).slice(0, 12));
  }
  return {
    data: {
      name, price, old_price, description: String(b.description || ''),
      colors: JSON.stringify(colors), sizes: JSON.stringify(sizes),
      stock: parseInt(b.stock) || 0, active: b.active ? 1 : 0, featured: b.featured ? 1 : 0, video, size_guide
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

// ---------------- Coupons & reviews ----------------
export function calcDiscount(kind, value, subtotal) {
  subtotal = Math.max(0, Number(subtotal) || 0);
  value = Number(value) || 0;
  if (!(value > 0)) return 0;
  if (kind === 'pct') return Math.min(subtotal, Math.round(subtotal * Math.min(value, 90) / 100));
  if (kind === 'fixed') return Math.min(subtotal, Math.round(value));
  return 0;
}

export function validateCouponBody(b) {
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  const kind = b.kind === 'fixed' ? 'fixed' : 'pct';
  const value = Number(b.value);
  const min_order = Math.max(0, Number(b.min_order || 0));
  if (code.length < 2) return { error: 'كود الخصم لازم حرفين على الأقل' };
  if (!(value > 0)) return { error: 'قيمة الخصم لازم أكبر من صفر' };
  if (kind === 'pct' && value > 90) return { error: 'نسبة الخصم بحد أقصى 90%' };
  return { data: { code, kind, value, min_order, active: (b.active === false || b.active === 0 || b.active === '0') ? 0 : 1 } };
}

export function validateReviewBody(b) {
  const name = String(b.name || '').trim();
  const rating = parseInt(b.rating);
  const comment = String(b.comment || '').trim();
  if (name.length < 2) return { error: 'اكتب اسمك' };
  if (!(rating >= 1 && rating <= 5)) return { error: 'اختار التقييم بالنجوم ⭐' };
  if (comment.length < 3) return { error: 'اكتب تعليقك (3 حروف على الأقل)' };
  if (comment.length > 500) return { error: 'التعليق طويل أوي — اختصره شوية' };
  return { data: { name: name.slice(0, 60), rating, comment: comment.slice(0, 500) } };
}
