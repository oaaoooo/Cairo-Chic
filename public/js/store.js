// Non-blocking font load (CSP-safe: no inline handlers)
(function () {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(l);
})();
// ================= CAIRO CHIC - Storefront =================
const $ = (id) => document.getElementById(id);
let SETTINGS = null, PRODUCTS = [], CURRENT = null;
let selColor = 0, selSize = 1, qty = 1;
let CART = []; // [{pid, color, size, qty}]
let LAST_ORDER = null; // {name, phone} of just-placed order
let COUPON = null; // {code, kind, value, min_order}
let REVIEWS = [];
let myRating = 5;
let dealEnd = 0;

const DEF_FEATURES = [
  { i: '🧥', t: 'خامة ميلتون تقيلة', d: 'بطانة داخلية ناعمة تدفيك في عز البرد ومبتوبرش' },
  { i: '✂️', t: 'تلبيس أوفرسايز مظبوط', d: 'قصّة عصرية مريحة، شيك في اللبس ومناسبة لكل الأجسام' },
  { i: '🎨', t: '4 ألوان ترندي', d: 'بيج، أسود، كحلي، رمادي — اختار اللي على ذوقك' },
  { i: '🧵', t: 'تقغيل وفينيش نضيف', d: 'خياطة محترمة وتشطيب يعيش معاك مواسم مش موسم واحد' }
];
const DEF_TRUST = [
  { i: '💵', t: 'الدفع عند الاستلام', d: 'ادفع لما الأوردر يوصلك' },
  { i: '📦', t: 'معاينة قبل الاستلام', d: 'عاين المنتج براحتك' },
  { i: '🔄', t: 'استبدال سهل', d: 'لو المقاس مش مظبوط' },
  { i: '🚚', t: 'شحن لكل مصر', d: 'من 2 لـ 5 أيام عمل' }
];
const DEF_TITLES = {
  featuresTitle: 'ليه ترنج V11؟ 🤔', reviewsTitle: 'عملائنا بيقولوا إيه؟ ⭐',
  howTitle: 'هتستلم طلبك إزاي؟ 📝', faqTitle: 'أسئلة شائعة ❓', moreTitle: 'منتجات تانية هتعجبك 🛍️'
};

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function normDigits(s) {
  return String(s || '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function shade(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const t = pct < 0 ? 0 : 255, p = Math.abs(pct) / 100;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => Math.round((t - v) * p + v));
  return '#' + c.map(x => x.toString(16).padStart(2, '0')).join('');
}

async function init() {
  // Instant paint from last visit's data, then refresh in background
  try {
    const cached = JSON.parse(localStorage.getItem('cc_bootstrap') || 'null');
    if (cached && Array.isArray(cached.products)) await paintStore(cached, true);
  } catch { /* ignore corrupt cache */ }
  try {
    const s = await fetch('/api/bootstrap').then(r => r.json());
    try { localStorage.setItem('cc_bootstrap', JSON.stringify(s)); } catch { /* ignore */ }
    if (await paintStore(s, false)) return;
  } catch (e) {
    console.error(e);
  }
  startCountdown();
  bindUI();
  paintStars();
  renderCart();
  updateSummary();
}

async function paintStore(s, fromCache) {
  SETTINGS = s; PRODUCTS = s.products || [];
  loadCart(); cleanCart();
  if (SETTINGS.announcement) $('announce').textContent = SETTINGS.announcement;
  applyBrand();
  applyTheme();
  applyContent();
  applyDeal();
  applyVisibility();
  if (!fromCache && SETTINGS.maint_enabled === '1') {
    const me = await fetch('/api/admin/me').then(r => r.json()).catch(() => ({}));
    if (!me.admin) { showMaintenance(); return true; }
    showMaintAdminBar();
  }
  buildGovSelect();
  if (PRODUCTS.length) { const feat = PRODUCTS.find(p => p.featured); selectProduct(feat ? feat.id : PRODUCTS[0].id); }
  if (PRODUCTS.length > 1) renderMoreProducts();
  renderSbProducts();
  $('featuresTitle').textContent = SETTINGS.features_title || DEF_TITLES.featuresTitle;
  $('reviewsTitle').textContent = SETTINGS.reviews_title || DEF_TITLES.reviewsTitle;
  $('howTitle').textContent = SETTINGS.how_title || DEF_TITLES.howTitle;
  $('faqTitle').textContent = SETTINGS.faq_title || DEF_TITLES.faqTitle;
  $('moreTitle').textContent = SETTINGS.more_title || DEF_TITLES.moreTitle;
  if (!window.__pxDone) {
    window.__pxDone = true;
    const loadPixel = () => { loadTikTokPixel(SETTINGS.tiktok_pixel); track('ViewContent'); };
    if ('requestIdleCallback' in window) requestIdleCallback(loadPixel, { timeout: 3000 });
    else setTimeout(loadPixel, 1500);
  }
  return false;
}

function applyBrand() {
  if (SETTINGS.store_name_ar) document.querySelectorAll('.brand-ar').forEach(e => e.textContent = SETTINGS.store_name_ar);
  if (SETTINGS.store_name_en) document.querySelectorAll('.brand-en').forEach(e => e.textContent = SETTINGS.store_name_en);
  if (SETTINGS.logo_url) document.querySelectorAll('img.logo').forEach(im => { im.src = SETTINGS.logo_url; });
}

function applyTheme() {
  const root = document.documentElement.style;
  if (/^#[0-9a-fA-F]{6}$/.test(SETTINGS.theme_primary || '')) {
    root.setProperty('--orange', SETTINGS.theme_primary);
    root.setProperty('--orange-dark', shade(SETTINGS.theme_primary, -12));
  }
  if (/^#[0-9a-fA-F]{6}$/.test(SETTINGS.theme_dark || '')) {
    root.setProperty('--dark', SETTINGS.theme_dark);
    root.setProperty('--dark2', shade(SETTINGS.theme_dark, 16));
  }
}

function applyContent() {
  const s = SETTINGS;
  if (s.footer_text) $('footerText').textContent = s.footer_text;
  if (s.size_hint) $('sizeHint').textContent = s.size_hint;
  if (s.stock_line) $('stockLine').innerHTML = s.stock_line;
  if (s.cta_text) document.querySelectorAll('[data-cta]').forEach(a => a.textContent = s.cta_text);
  const feats = [1, 2, 3, 4].map(i => ({
    i: s['f' + i + 'i'] || DEF_FEATURES[i - 1].i,
    t: s['f' + i + 't'] || DEF_FEATURES[i - 1].t,
    d: s['f' + i + 'd'] || DEF_FEATURES[i - 1].d
  }));
  const fg = $('featuresGrid'); fg.innerHTML = '';
  feats.forEach(f => {
    const div = document.createElement('div');
    div.className = 'feature';
    div.innerHTML = `${esc(f.i)}<b>${esc(f.t)}</b><span>${esc(f.d)}</span>`;
    fg.appendChild(div);
  });
  const trust = [1, 2, 3, 4].map(i => ({
    i: s['t' + i + 'i'] || DEF_TRUST[i - 1].i,
    t: s['t' + i + 't'] || DEF_TRUST[i - 1].t,
    d: s['t' + i + 'd'] || DEF_TRUST[i - 1].d
  }));
  const tg = $('trustGrid'); tg.innerHTML = '';
  trust.forEach(t => {
    const div = document.createElement('div');
    div.className = 'trust-item';
    div.innerHTML = `${esc(t.i)}<b>${esc(t.t)}</b><span>${esc(t.d)}</span>`;
    tg.appendChild(div);
  });
}

function applyDeal() {
  const banner = $('dealBanner');
  banner.style.display = 'none'; dealEnd = 0;
  if (SETTINGS.deal_enabled !== '1' || !SETTINGS.deal_ends_at) return;
  const t = new Date(SETTINGS.deal_ends_at).getTime();
  if (!t || t <= Date.now()) return;
  dealEnd = t;
  if (SETTINGS.deal_title) $('dealTitle').textContent = SETTINGS.deal_title;
  if (SETTINGS.deal_sub) $('dealSub').textContent = SETTINGS.deal_sub;
  banner.style.display = '';
}

const SHOW_MAP = {
  show_reviews: ['reviewsSection', 'ratingLine'],
  show_coupon: ['couponField'],
  show_features: ['featuresSection'],
  show_trust: ['trustGrid'],
  show_how: ['howSection'],
  show_faq: ['faqSection'],
  show_countdown: ['countdownBox'],
  show_announce: ['announce'],
  show_track: ['track'],
  show_more: ['moreProducts']
};
// empty/missing = visible; '0' = hidden
function applyVisibility() {
  if (!SETTINGS) return;
  Object.entries(SHOW_MAP).forEach(([key, ids]) => {
    const on = SETTINGS[key] !== '0';
    ids.forEach(id => { const el = $(id); if (el) el.style.display = on ? '' : 'none'; });
  });
  // sidebar links follow their sections (hidden section = hidden link)
  const secOn = (id) => { const el = $(id); return el && el.style.display !== 'none'; };
  document.querySelectorAll('.side-link[data-sec]').forEach(a => {
    a.style.display = secOn(a.dataset.sec) ? '' : 'none';
  });
  // track placement: sidebar box only when track is on + place is both (default)
  const sbT = $('sbTrackSec');
  if (sbT) sbT.style.display = (SETTINGS.show_track !== '0' && (SETTINGS.track_place || 'both') === 'both') ? '' : 'none';
}

function selectProduct(id) {
  CURRENT = PRODUCTS.find(p => p.id === id) || PRODUCTS[0];
  selColor = 0;
  selSize = CURRENT.sizes.length > 1 ? 1 : 0;
  qty = 1; $('qtyVal').textContent = '1';
  renderProduct();
  updateSummary();
  loadReviews(CURRENT.id);
  updateWaFloat();
  if (SETTINGS && SETTINGS.store_name_ar) document.title = `${SETTINGS.store_name_ar} | ${CURRENT.name} — اطلب دلوقتي`;
}

function renderProduct() {
  const p = CURRENT;
  $('featBadge').style.display = p.featured ? '' : 'none';
  $('productName').textContent = p.name + ' 🔥';
  $('productDesc').textContent = p.description || '';
  $('priceNow').textContent = p.price;
  $('stickyPrice').textContent = p.price;
  const old = Number(p.old_price) || 0;
  $('priceOld').textContent = old || '';
  $('stickyOld').textContent = old || '';
  $('saveAmt').textContent = old > p.price ? (old - p.price) : 0;
  const pct = old > p.price ? Math.round((1 - p.price / old) * 100) : 0;
  $('discountBadge').textContent = pct ? `خصم ${pct}%` : 'عرض خاص';
  $('discountBadge').style.display = pct ? '' : 'none';

  // gallery
  $('mainImage').style.display = '';
  $('mainVideo').style.display = 'none';
  $('mainVideo').innerHTML = '';
  const thumbs = $('thumbs'); thumbs.innerHTML = '';
  if (p.video) {
    const vb = document.createElement('button');
    vb.type = 'button';
    vb.className = 'thumb-vid';
    vb.textContent = '🎬 فيديو';
    vb.onclick = showVideo;
    thumbs.appendChild(vb);
  }
  p.colors.forEach((c, i) => {
    const img = document.createElement('img');
    img.src = c.image || '/images/logo.jpg';
    img.alt = c.name;
    img.className = i === selColor ? 'active' : '';
    img.onclick = () => { selColor = i; renderProduct(); };
    thumbs.appendChild(img);
  });
  $('mainImage').src = (p.colors[selColor] && p.colors[selColor].image) || '/images/logo.jpg';

  // colors
  const cb = $('colorBtns'); cb.innerHTML = '';
  p.colors.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'color-btn' + (i === selColor ? ' active' : '');
    b.textContent = c.name;
    b.onclick = () => { selColor = i; renderProduct(); };
    cb.appendChild(b);
  });
  $('colorName').textContent = p.colors[selColor] ? p.colors[selColor].name : '';

  // sizes
  const sb = $('sizeBtns'); sb.innerHTML = '';
  p.sizes.forEach((s, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'size-btn' + (i === selSize ? ' active' : '');
    b.textContent = s;
    b.onclick = () => { selSize = i; renderProduct(); };
    sb.appendChild(b);
  });
  $('sizeName').textContent = p.sizes[selSize] || '';
}

let moreShown = 12;
function renderMoreProducts() {
  const wrap = $('moreProducts'), grid = $('productsGrid');
  wrap.style.display = (SETTINGS && SETTINGS.show_more === '0') ? 'none' : '';
  moreShown = 12;
  paintMoreProducts();
}
function paintMoreProducts() {
  const grid = $('productsGrid');
  grid.innerHTML = '';
  const rest = PRODUCTS.filter(p => p.id !== CURRENT.id).sort((a, b) => (b.featured || 0) - (a.featured || 0));
  rest.slice(0, moreShown).forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const old = Number(p.old_price) || 0;
    const card = document.createElement('div');
    card.className = 'pcard';
    card.innerHTML = `
      <div class="pcard-imgwrap"><img src="${img}" alt="${esc(p.name)}" loading="lazy" decoding="async">${p.featured ? '<span class="pcard-feat">⭐ مميز</span>' : ''}${p.video ? '<span class="pcard-vid">🎬</span>' : ''}</div>
      <div class="pbody"><b>${esc(p.name)}</b>
        <div class="prow">
          <div class="pprice">${p.price} ج ${old > p.price ? `<small>${old} ج</small>` : ''}</div>
          <button class="btn btn-primary">اطلب ده</button>
        </div>
      </div>`;
    card.querySelector('button').onclick = () => {
      selectProduct(p.id);
      renderMoreProducts();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      track('AddToCart');
    };
    grid.appendChild(card);
  });
  if (rest.length > moreShown) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn-ghost more-btn';
    b.textContent = `عرض المزيد ⬇️ (${rest.length - moreShown} منتج)`;
    b.onclick = () => { moreShown += 12; paintMoreProducts(); };
    grid.appendChild(b);
  }
}

// ---------- Product video ----------
function ytId(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}
function showVideo() {
  if (!CURRENT || !CURRENT.video) return;
  const v = CURRENT.video, y = ytId(v), mv = $('mainVideo');
  if (y) {
    mv.innerHTML = `<iframe src="https://www.youtube.com/embed/${y}" title="فيديو المنتج" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
  } else if (/\.(mp4|webm|mov)(\?|#|$)/i.test(v)) {
    mv.innerHTML = `<video controls playsinline preload="metadata" src="${esc(v)}"></video>`;
  } else {
    mv.innerHTML = `<a class="btn btn-primary" href="${esc(v)}" target="_blank" rel="noopener">🎬 شوف فيديو المنتج</a>`;
  }
  thumbsResetActive();
  $('mainImage').style.display = 'none';
  mv.style.display = '';
}
function thumbsResetActive() {
  document.querySelectorAll('#thumbs img').forEach(i => i.classList.remove('active'));
}

// ---------- Cart ----------
function loadCart() {
  try { CART = JSON.parse(localStorage.getItem('cc_cart') || '[]'); } catch { CART = []; }
  if (!Array.isArray(CART)) CART = [];
}
function saveCart() {
  try { localStorage.setItem('cc_cart', JSON.stringify(CART)); } catch { /* ignore */ }
  updateCartBadge();
}
function cleanCart() {
  CART = CART.filter(l => {
    const p = PRODUCTS.find(x => x.id === l.pid);
    return p && p.colors.some(c => c.name === l.color) && p.sizes.includes(l.size);
  });
  CART.forEach(l => { l.qty = Math.max(1, Math.min(5, parseInt(l.qty) || 1)); });
  saveCart();
}
function cartDetailed() {
  return CART.map((l, i) => ({ ...l, i, p: PRODUCTS.find(x => x.id === l.pid) })).filter(x => x.p);
}
function cartSubtotal() {
  return cartDetailed().reduce((a, x) => a + x.p.price * x.qty, 0);
}
function cartCount() {
  return CART.reduce((a, l) => a + (parseInt(l.qty) || 0), 0);
}
function updateCartBadge() {
  const n = cartCount();
  const b = $('cartBadge');
  b.textContent = n;
  b.style.display = n ? '' : 'none';
  $('cartCount2').textContent = n;
}
function lineImage(x) {
  const c = (x.p.colors.find(c => c.name === x.color) || x.p.colors[0] || {}).image;
  return c || '/images/logo.jpg';
}

function addCurrentToCart(openDrawer) {
  if (!CURRENT) return;
  const color = CURRENT.colors[selColor] ? CURRENT.colors[selColor].name : '';
  const size = CURRENT.sizes[selSize] || '';
  if (!color || !size) { toast('اختار اللون والمقاس الأول'); return; }
  const ex = CART.find(l => l.pid === CURRENT.id && l.color === color && l.size === size);
  if (ex) ex.qty = Math.min(5, ex.qty + qty);
  else {
    if (CART.length >= 10) { toast('السلة مليانة (10 منتجات بحد أقصى)'); return; }
    CART.push({ pid: CURRENT.id, color, size, qty });
  }
  qty = 1; $('qtyVal').textContent = '1';
  saveCart(); renderCart(); updateSummary();
  toast('اتضاف للسلة ✅');
  if (openDrawer) openCart();
}

function changeQty(i, d) {
  if (!CART[i]) return;
  CART[i].qty = Math.max(1, Math.min(5, CART[i].qty + d));
  saveCart(); renderCart(); updateSummary();
}
function removeLine(i) {
  CART.splice(i, 1);
  saveCart(); renderCart(); updateSummary();
}

function renderCart() {
  const det = cartDetailed();
  const box = $('cartItems');
  box.innerHTML = '';
  if (!det.length) {
    box.innerHTML = '<p class="muted" style="text-align:center;padding:30px 10px">سلتك فاضية 🛒<br>ضيف منتجات واطلبهم كلهم بشحن واحد!</p>';
  }
  det.forEach(x => {
    const d = document.createElement('div');
    d.className = 'cart-item';
    d.innerHTML = `
      <img src="${lineImage(x)}" alt="" loading="lazy" decoding="async">
      <div class="grow"><b>${esc(x.p.name)}</b>
        <small>🎨 ${esc(x.color)} | 📏 ${esc(x.size)}</small>
        <div class="qty-mini"><button type="button" data-a="dec">−</button><span>${x.qty}</span><button type="button" data-a="inc">+</button></div>
      </div>
      <div class="cart-line-side"><b>${x.p.price * x.qty} ج</b><button type="button" data-a="rm" class="cart-rm">حذف 🗑</button></div>`;
    d.querySelector('[data-a=inc]').onclick = () => changeQty(x.i, 1);
    d.querySelector('[data-a=dec]').onclick = () => changeQty(x.i, -1);
    d.querySelector('[data-a=rm]').onclick = () => removeLine(x.i);
    box.appendChild(d);
  });
  $('cartSub').textContent = cartSubtotal();
  updateCartBadge();
}

function openCart() {
  renderCart();
  $('cartDrawer').classList.add('open');
  $('cartOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  $('cartDrawer').classList.remove('open');
  $('cartOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

let toastT = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 2200);
}

// ---------- Governorates & shipping ----------
function govList() {
  return (SETTINGS.governorates || []).map(g => {
    if (typeof g === 'string') {
      const ship = (SETTINGS.city_govs || []).includes(g) ? SETTINGS.shipping_cities : SETTINGS.shipping_others;
      return { name: g, shipping: Number(ship) || 0 };
    }
    return { name: g.name, shipping: Number(g.shipping) || 0 };
  });
}

function shippingFor(gov) {
  if (!gov || !SETTINGS) return 0;
  const f = govList().find(g => g.name === gov);
  return f ? f.shipping : 0;
}

function buildGovSelect() {
  const sel = $('govSelect');
  sel.querySelectorAll('option').forEach(o => { if (o.value !== '') o.remove(); });
  govList().forEach(g => {
    const o = document.createElement('option');
    o.value = g.name;
    o.textContent = `${g.name} (شحن ${g.shipping} ج)`;
    sel.appendChild(o);
  });
  sel.onchange = buildAreas;
}

function areaValue() {
  const useText = $('areaTextWrap').style.display !== 'none';
  return useText ? $('areaText').value.trim() : $('areaSelect').value;
}

function buildAreas() {
  updateSummary();
  const gov = $('govSelect').value;
  const areas = (SETTINGS.areas && SETTINGS.areas[gov]) || null;
  const selWrap = $('areaSelectWrap'), txtWrap = $('areaTextWrap');
  if (areas && areas.length) {
    selWrap.style.display = '';
    txtWrap.style.display = 'none';
    const sel = $('areaSelect');
    sel.innerHTML = '<option value="">— اختار المركز / المنطقة —</option>';
    areas.forEach(a => {
      const o = document.createElement('option');
      o.value = a; o.textContent = a;
      sel.appendChild(o);
    });
  } else {
    selWrap.style.display = 'none';
    txtWrap.style.display = '';
  }
}

// ---------- Coupon ----------
function couponDiscount(subtotal) {
  if (!COUPON) return 0;
  if (COUPON.min_order > 0 && subtotal < COUPON.min_order) return 0;
  if (COUPON.kind === 'fixed') return Math.min(subtotal, Math.round(COUPON.value));
  return Math.min(subtotal, Math.round(subtotal * Math.min(COUPON.value, 90) / 100));
}

async function applyCoupon() {
  const input = $('couponInput'), msg = $('couponMsg');
  const code = input.value.trim().toUpperCase().replace(/\s+/g, '');
  msg.textContent = ''; msg.style.color = '';
  if (!code) { COUPON = null; updateSummary(); return; }
  const sub = cartSubtotal();
  if (!sub) { msg.style.color = 'var(--red)'; msg.textContent = '❌ ضيف منتج للسلة الأول 🛒'; return; }
  msg.textContent = 'جاري التحقق... ⏳';
  try {
    const r = await fetch('/api/coupon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: sub })
    });
    const j = await r.json();
    if (!j.ok) { COUPON = null; msg.style.color = 'var(--red)'; msg.textContent = '❌ ' + (j.error || 'كود غلط'); updateSummary(); return; }
    COUPON = { code: j.code, kind: j.kind, value: j.value, min_order: j.min_order };
    msg.style.color = '#0d9b4d';
    msg.textContent = `✅ تم تطبيق الخصم — هتوفّر ${j.discount} جنيه`;
    updateSummary();
  } catch {
    msg.style.color = 'var(--red)';
    msg.textContent = '❌ مشكلة في الاتصال، حاول تاني';
  }
}

// ---------- Summary ----------
function updateSummary() {
  const det = cartDetailed();
  const box = $('sumLines');
  box.innerHTML = '';
  det.forEach(x => {
    const line = document.createElement('div');
    line.className = 'sum-item';
    line.innerHTML = `
      <img src="${lineImage(x)}" alt="" loading="lazy" decoding="async">
      <div class="grow"><b>${esc(x.p.name)}</b><small>🎨 ${esc(x.color)} | 📏 ${esc(x.size)} | × ${x.qty}</small></div>
      <b>${x.p.price * x.qty} ج</b>`;
    box.appendChild(line);
  });
  $('sumCount').textContent = det.reduce((a, x) => a + x.qty, 0);
  $('emptyCartHint').style.display = det.length ? 'none' : '';
  const sub = cartSubtotal();
  $('sumPrice').textContent = sub;
  const disc = couponDiscount(sub);
  if (COUPON && disc > 0) {
    $('discountLine').style.display = '';
    $('sumDiscount').textContent = disc;
    $('sumCoupon').textContent = COUPON.code;
  } else {
    $('discountLine').style.display = 'none';
    if (!det.length && COUPON) { COUPON = null; $('couponMsg').textContent = ''; }
    else if (COUPON && disc === 0) $('couponMsg').textContent = '⚠️ الكود مش شغال على المبلغ ده';
  }
  const gov = $('govSelect').value;
  const ship = shippingFor(gov);
  $('sumShip').textContent = gov ? ship + ' جنيه' : '— (اختار المحافظة)';
  $('sumTotal').textContent = sub - disc + (gov && det.length ? ship : 0);
}

// ---------- Reviews ----------
async function loadReviews(pid) {
  try {
    const j = await fetch(`/api/products/${pid}/reviews`).then(r => r.json());
    REVIEWS = j.reviews || [];
  } catch { REVIEWS = []; }
  renderReviews();
}

function stars(n) {
  n = Math.max(1, Math.min(5, Math.round(Number(n) || 5)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function renderReviews() {
  const g = $('reviewsGrid');
  g.innerHTML = '';
  if (!REVIEWS.length) {
    g.innerHTML = '<div class="review"><div class="stars">⭐</div><p>لسه مفيش تقييمات — كن أول واحد يقيّم المنتج ده!</p><b>— رأيك يهمنا</b></div>';
  } else {
    REVIEWS.forEach(r => {
      const div = document.createElement('div');
      div.className = 'review';
      div.innerHTML = `<div class="stars">${stars(r.rating)}</div><p>"${esc(r.comment)}"</p><b>— ${esc(r.name)}</b>`;
      g.appendChild(div);
    });
  }
  const rl = $('ratingLine');
  if (!REVIEWS.length) {
    rl.innerHTML = '⭐ <span>كن أول من يقيّم المنتج ده</span>';
  } else {
    const avg = REVIEWS.reduce((a, r) => a + Number(r.rating), 0) / REVIEWS.length;
    rl.innerHTML = `${stars(avg)} <span>${avg.toFixed(1)} | ${REVIEWS.length} تقييم من عملائنا</span>`;
  }
}

function paintStars() {
  document.querySelectorAll('#starsInput button').forEach(b => {
    b.classList.toggle('on', Number(b.dataset.r) <= myRating);
  });
}

async function submitReview() {
  const err = $('revError');
  err.textContent = ''; err.style.color = '';
  const name = $('revName').value.trim();
  const comment = $('revComment').value.trim();
  if (name.length < 2) { err.textContent = 'اكتب اسمك'; return; }
  if (comment.length < 3) { err.textContent = 'اكتب رأيك في المنتج'; return; }
  if (!CURRENT) return;
  err.textContent = 'جاري الإرسال... ⏳';
  try {
    const r = await fetch(`/api/products/${CURRENT.id}/reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, rating: myRating, comment })
    });
    const j = await r.json();
    if (!j.ok) { err.textContent = j.error || 'حصل خطأ'; return; }
    err.style.color = '#0d9b4d';
    err.textContent = 'شكراً يا بطل! تقييمك وصل وهيظهر قريب ⭐';
    $('revName').value = ''; $('revComment').value = '';
    myRating = 5; paintStars();
  } catch {
    err.textContent = 'مشكلة في الاتصال، حاول تاني';
  }
}

// ---------- Countdown (daily + deal) ----------
function startCountdown() {
  function tick() {
    const now = new Date(), end = new Date();
    end.setHours(23, 59, 59, 999);
    let s = Math.max(0, Math.floor((end - now) / 1000));
    $('cdH').textContent = String(Math.floor(s / 3600)).padStart(2, '0');
    $('cdM').textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    $('cdS').textContent = String(s % 60).padStart(2, '0');
    if (dealEnd) {
      let d = Math.floor((dealEnd - Date.now()) / 1000);
      if (d <= 0) { dealEnd = 0; $('dealBanner').style.display = 'none'; }
      else {
        $('dealH').textContent = String(Math.floor(d / 3600)).padStart(2, '0');
        $('dealM').textContent = String(Math.floor((d % 3600) / 60)).padStart(2, '0');
        $('dealS').textContent = String(d % 60).padStart(2, '0');
      }
    }
  }
  tick(); setInterval(tick, 1000);
}

// ---------- UI ----------
function updateWaFloat() {
  if (!SETTINGS || !SETTINGS.whatsapp || !CURRENT || SETTINGS.show_wa === '0') { $('waFloat').style.display = 'none'; $('sbWaSec').style.display = 'none'; return; }
  const wa = $('waFloat');
  wa.style.display = 'flex';
  const waTpl = SETTINGS.wa_msg || 'أهلاً {store}، عندي استفسار عن {product}';
  const waMsg = waTpl.split('{store}').join(SETTINGS.store_name_ar || 'كايرو شيك').split('{product}').join(CURRENT.name);
  wa.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(waMsg)}`;
  $('sbWaSec').style.display = '';
  $('sbWa').href = wa.href;
}

function bindUI() {
  $('qtyPlus').onclick = () => { if (qty < 5) { qty++; $('qtyVal').textContent = qty; } };
  $('qtyMinus').onclick = () => { if (qty > 1) { qty--; $('qtyVal').textContent = qty; } };
  document.querySelectorAll('[data-cta]').forEach(a => a.addEventListener('click', () => track('AddToCart')));
  $('expressBtn').addEventListener('click', () => addCurrentToCart(false));
  $('addCartBtn').onclick = () => addCurrentToCart(true);
  $('cartOpen').onclick = openCart;
  $('cartClose').onclick = closeCart;
  $('cartOverlay').onclick = closeCart;
  $('cartContinue').onclick = closeCart;
  $('cartCheckout').addEventListener('click', closeCart);
  document.querySelectorAll('.faq-q').forEach(q => q.onclick = () => q.parentElement.classList.toggle('open'));
  $('govSelect').addEventListener('change', buildAreas);
  $('couponBtn').onclick = applyCoupon;
  $('couponInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });
  $('orderForm').addEventListener('submit', submitOrder);
  document.querySelectorAll('#starsInput button').forEach(b => b.onclick = () => { myRating = Number(b.dataset.r); paintStars(); });
  $('revSubmit').onclick = submitReview;
  $('trackBtn').onclick = doTrack;
  $('menuOpen').onclick = openSide;
  $('sideClose').onclick = closeSide;
  $('sideOverlay').onclick = closeSide;
  document.querySelectorAll('.side-link').forEach(a => a.addEventListener('click', closeSide));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); closeSide(); } });
  $('sbTrackBtn').onclick = doSbTrack;
  $('sbPhone').addEventListener('input', () => {
    $('sbPhone').value = normDigits($('sbPhone').value).replace(/\D/g, '').slice(0, 11);
  });
  $('trackPhone').addEventListener('input', () => {
    $('trackPhone').value = normDigits($('trackPhone').value).replace(/\D/g, '').slice(0, 11);
  });
  $('trackOrderBtn').onclick = () => {
    openSide();
    if (LAST_ORDER) {
      $('sbName').value = LAST_ORDER.name;
      $('sbPhone').value = LAST_ORDER.phone;
      doSbTrack();
    }
  };
  $('newOrderBtn').onclick = () => {
    $('orderSuccess').style.display = 'none';
    $('orderForm').style.display = '';
    $('orderForm').reset();
    COUPON = null; $('couponMsg').textContent = '';
    updateSummary();
  };
  updateWaFloat();
  // numeric phone only
  const phone = document.querySelector('input[name=phone]');
  phone.addEventListener('input', () => {
    phone.value = normDigits(phone.value).replace(/\D/g, '').slice(0, 11);
  });
}

async function submitOrder(e) {
  e.preventDefault();
  const err = $('formError'), btn = $('submitBtn');
  err.textContent = '';
  const det = cartDetailed();
  if (!det.length) { err.textContent = 'السلة فاضية — ضيف منتج الأول 🛒'; return; }
  const fd = new FormData(e.target);
  const payload = {
    items: CART.map(l => ({ product_id: l.pid, color: l.color, size: l.size, qty: l.qty })),
    coupon_code: COUPON ? COUPON.code : '',
    name: fd.get('name').trim(),
    phone: normDigits(fd.get('phone')),
    governorate: fd.get('governorate'),
    area: areaValue(),
    address: fd.get('address').trim(),
    notes: (fd.get('notes') || '').trim()
  };
  if (payload.name.length < 3) { err.textContent = 'اكتب الاسم بالكامل'; return; }
  if (!/^01[0125][0-9]{8}$/.test(payload.phone)) { err.textContent = 'رقم الموبايل غلط — لازم يبدأ بـ 01 و11 رقم'; return; }
  if (!payload.governorate) { err.textContent = 'اختار المحافظة'; return; }
  if (!payload.area || payload.area.length < 2) { err.textContent = 'اختار المركز / المنطقة'; return; }
  if (payload.address.length < 5) { err.textContent = 'اكتب العنوان بالتفصيل'; return; }

  btn.disabled = true; btn.textContent = 'جاري تسجيل طلبك... ⏳';
  track('InitiateCheckout');
  try {
    const r = await fetch('/api/order', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const j = await r.json();
    if (!j.ok) { err.textContent = j.error || 'حصل خطأ'; btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅'; return; }
    track('CompletePayment', j.total, j.order_no);
    LAST_ORDER = { name: payload.name, phone: payload.phone };
    $('orderForm').style.display = 'none';
    $('orderSuccess').style.display = '';
    $('okOrderNo').textContent = j.order_no;
    $('okTotal').textContent = j.total;
    if (SETTINGS.whatsapp) {
      const itemsTxt = det.map(x => `${x.p.name} (${x.color}/${x.size} ×${x.qty})`).join(' + ');
      const w = $('waConfirm');
      w.style.display = '';
      w.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(`أهلاً، أنا سجلت طلب ${j.order_no} (${itemsTxt}) وعايز أأكده`)}`;
    }
    CART = []; COUPON = null;
    saveCart(); renderCart(); updateSummary();
    $('couponMsg').textContent = '';
    $('orderSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    err.textContent = 'مشكلة في الاتصال، حاول تاني';
    btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅';
  }
}

// ---------- Order tracking (phone + name -> all orders) ----------
function trackOrderHtml(o) {
  if (o.status === 'cancelled') {
    return `<div class="track-card"><h3>طلبك رقم <b dir="ltr">${esc(o.order_no)}</b></h3>
      <p style="font-size:18px;font-weight:800">❌ الطلب ده ملغي</p>
      <p class="muted">لو شايف إن ده غلط كلمنا واتساب وهنساعدك 🙏</p></div>`;
  }
  const steps = o.steps.map(s => `<div class="tstep ${s.done ? 'done' : ''} ${s.now ? 'now' : ''}">${s.done ? '✅' : '⬜'} ${esc(s.t)}</div>`).join('');
  const items = o.items.map(l => `<div class="sum-line">🧾 ${esc(l.name)} — 🎨 ${esc(l.color)} | 📏 ${esc(l.size)} | × ${l.qty}</div>`).join('');
  return `<div class="track-card"><h3>طلبك رقم <b dir="ltr">${esc(o.order_no)}</b></h3>
    <div class="track-status">${esc(o.statusAr)}</div>
    <div class="tsteps">${steps}</div>
    ${items}
    <div class="sum-line">📍 ${esc(o.governorate)}${o.area ? ' — ' + esc(o.area) : ''}</div>
    <div class="sum-total">الإجمالي: <b>${o.total} جنيه</b></div></div>`;
}

async function doTrackSearch(phone, name, err, box) {
  err.textContent = '';
  box.style.display = 'none';
  box.innerHTML = '';
  phone = normDigits(phone).replace(/\D/g, '');
  name = String(name || '').trim().replace(/\s+/g, ' ');
  if (!phone || name.length < 3) { err.textContent = 'اكتب الاسم ورقم الموبايل اللي سجلت بيهم'; return; }
  err.textContent = 'جاري البحث... ⏳';
  try {
    const r = await fetch(`/api/track2?phone=${encodeURIComponent(phone)}&name=${encodeURIComponent(name)}`);
    const j = await r.json();
    if (!j.ok) { err.textContent = j.error || 'حصل خطأ'; return; }
    err.textContent = '';
    const head = j.orders.length > 1 ? `<p class="muted" style="text-align:center">لقينا <b>${j.orders.length}</b> طلبات باسمك 👇</p>` : '';
    box.innerHTML = head + j.orders.map(trackOrderHtml).join('');
    box.style.display = '';
  } catch {
    err.textContent = 'مشكلة في الاتصال، حاول تاني';
  }
}

function doTrack() {
  doTrackSearch($('trackPhone').value, $('trackName').value, $('trackError'), $('trackResult'));
}
function doSbTrack() {
  doTrackSearch($('sbPhone').value, $('sbName').value, $('sbTrackError'), $('sbTrackResult'));
}

// ---------- Sidebar ----------
function openSide() {
  renderSbProducts();
  $('sideDrawer').classList.add('open');
  $('sideOverlay').classList.add('show');
  document.body.style.overflow = 'hidden';
}
function closeSide() {
  $('sideDrawer').classList.remove('open');
  $('sideOverlay').classList.remove('show');
  document.body.style.overflow = '';
}
function renderSbProducts() {
  const box = $('sbProducts');
  if (!box) return;
  box.innerHTML = '';
  PRODUCTS.forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const d = document.createElement('div');
    d.className = 'sb-prod';
    d.innerHTML = `<img src="${img}" alt="" loading="lazy" decoding="async"><div class="grow"><b>${esc(p.name)}</b><small>${p.price} جنيه</small></div>${p.video ? '<span>🎬</span>' : ''}`;
    d.onclick = () => {
      selectProduct(p.id);
      renderMoreProducts();
      closeSide();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    box.appendChild(d);
  });
}

// ---------- Maintenance mode ----------
// 'YYYY-MM-DDTHH:mm' wall time in Cairo -> ms (Egypt DST: last Fri Apr -> last Thu Oct)
function cairoWallToMs(s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return 0;
  const Y = +m[1], Mo = +m[2], D = +m[3], H = +m[4], Mi = +m[5];
  const lastWeekday = (y, mi, wd) => {
    const d = new Date(Date.UTC(y, mi + 1, 0));
    while (d.getUTCDay() !== wd) d.setUTCDate(d.getUTCDate() - 1);
    return d.getUTCDate();
  };
  const wall = Date.UTC(Y, Mo - 1, D, H, Mi);
  const dstStart = Date.UTC(Y, 3, lastWeekday(Y, 3, 5));
  const dstEnd = Date.UTC(Y, 9, lastWeekday(Y, 9, 4), 24);
  const off = (wall >= dstStart && wall < dstEnd) ? 3 : 2;
  return wall - off * 3600e3;
}

function showMaintenance() {
  document.title = 'المتجر تحت التحديث 🛠';
  const msg = SETTINGS.maint_msg || '🛠 بنحدّث المتجر دلوقتي — راجعين خلال وقت قصير 🙏';
  const endMs = cairoWallToMs(SETTINGS.maint_ends_at);
  const showCd = endMs > Date.now();
  const wa = SETTINGS.whatsapp
    ? `<a class="btn btn-whatsapp" style="max-width:320px;margin:14px auto 0" href="https://wa.me/${SETTINGS.whatsapp}" target="_blank">لو مستعجل كلمنا واتساب 💬</a>` : '';
  document.body.innerHTML = `<div class="maint-wrap">
    <img src="${esc(SETTINGS.logo_url || '/images/logo.jpg')}" class="maint-logo" alt="">
    <div class="maint-emoji">🛠</div>
    <h1>${esc(SETTINGS.store_name_ar || 'كايرو شيك')}</h1>
    <p>${esc(msg)}</p>
    ${showCd ? '<div class="maint-cd"><div><b id="mH">00</b><span>ساعة</span></div><div><b id="mM">00</b><span>دقيقة</span></div><div><b id="mS">00</b><span>ثانية</span></div></div>' : ''}
    ${wa}
  </div>`;
  if (!showCd) return;
  const tick = () => {
    const s = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
    $('mH').textContent = String(Math.floor(s / 3600)).padStart(2, '0');
    $('mM').textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    $('mS').textContent = String(s % 60).padStart(2, '0');
    if (s <= 0) location.reload();
  };
  tick(); setInterval(tick, 1000);
}

function showMaintAdminBar() {
  const b = document.createElement('div');
  b.className = 'maint-adminbar';
  b.textContent = '🛠 وضع الصيانة شغال — العملاء شايفين صفحة التحديث (انت بس شايف المتجر)';
  document.body.appendChild(b);
}

// ---------- TikTok Pixel ----------
function loadTikTokPixel(pixelId) {
  if (!pixelId) return;
  try {
    !function (w, d, t) {
      w.TiktokAnalyticsObject = t;
      var ttq = w[t] = w[t] || [];
      ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "hold", "reveal", "load"];
      ttq.setAndDefer = function (t, e) { t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))) } };
      for (var i = 0; i < ttq.methods.length; i++) ttq.setAndDefer(ttq, ttq.methods[i]);
      ttq.load = function (e) {
        var n = "https://analytics.tiktok.com/i18n/pixel/events.js", o = "ttq";
        ttq._i = ttq._i || {}, ttq._i[e] = [], ttq._i[e]._u = n, ttq._t = ttq._t || {}, ttq._t[e] = +new Date,
          ttq._o = ttq._o || {}, ttq._o[e] = o; var a = document.createElement("script");
        a.type = "text/javascript", a.async = !0, a.src = n + "?sdkid=" + e + "&lib=" + t;
        var e = document.getElementsByTagName("script")[0]; e.parentNode.insertBefore(a, e)
      };
    }(window, document, 'ttq');
    ttq.load(pixelId);
    ttq.page();
  } catch (e) { console.warn('pixel failed', e); }
}
function track(ev, value, orderId) {
  try {
    if (typeof ttq === 'undefined') return;
    const props = { currency: 'EGP' };
    if (CURRENT) { props.content_id = String(CURRENT.id); props.content_name = CURRENT.name; }
    if (value) props.value = value;
    if (orderId) props.order_id = orderId;
    ttq.track(ev, props);
  } catch { /* ignore */ }
}

document.addEventListener('DOMContentLoaded', init);
