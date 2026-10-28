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
  loadFavs();
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
  initChat();
  initAppBanner();
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
  if (PRODUCTS.length) {
    const qp = Number(new URLSearchParams(location.search).get('p')) || 0;
    const shared = qp && PRODUCTS.find(p => p.id === qp);
    const feat = PRODUCTS.find(p => p.featured);
    selectProduct(shared ? shared.id : (feat ? feat.id : PRODUCTS[0].id));
  }
  if (PRODUCTS.length > 1) renderMoreProducts();
  paintFavs();
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
  pushRecent(CURRENT.id);
  updateFavBtn();
  if (SETTINGS && SETTINGS.store_name_ar) document.title = `${SETTINGS.store_name_ar} | ${CURRENT.name} — اطلب دلوقتي`;
  try {
    const u = new URL(location.href);
    u.searchParams.set('p', CURRENT.id);
    history.replaceState(null, '', u.pathname + u.search);
  } catch { /* ignore */ }
}

function renderProduct() {
  const p = CURRENT;
  $('featBadge').style.display = p.featured ? '' : 'none';
  $('productName').textContent = p.name + ' 🔥';
  { const cb = $('catBadge'); const ck = catOf(p); if (cb) { cb.style.display = (ck && CATS[ck]) ? '' : 'none'; if (ck && CATS[ck]) cb.textContent = '📂 ' + CAT_ICON[ck] + ' ' + CATS[ck].t; } }
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

  // real stock (falls back to static stock_line when untracked)
  const stk = (p.stock === null || p.stock === undefined || p.stock === '') ? null : Math.max(0, Number(p.stock) || 0);
  const sl = $('stockLine');
  if (stk === null) { if (SETTINGS.stock_line) sl.innerHTML = SETTINGS.stock_line; }
  else if (stk === 0) { sl.innerHTML = '😔 نفد المخزون — كلمنا واتساب نحجزلك أول ما يوصل'; }
  else { sl.innerHTML = `🔥 باقي <b>${stk}</b> قطع بس — اطلب قبل ما يخلص`; }
  const sold = stk === 0;
  ['expressBtn', 'addCartBtn'].forEach(id => {
    const b = $(id);
    if (b) { b.style.opacity = sold ? '.45' : ''; b.style.pointerEvents = sold ? 'none' : ''; }
  });
  if (sold && qty > 0) { qty = 0; $('qtyVal').textContent = '0'; }
  if (!sold && qty < 1) { qty = 1; $('qtyVal').textContent = '1'; }

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

let moreMode = 'row'; // 'row' = single moving row, 'all' = show-all grid

// ---------- v4.6: categories (zero storage: id map + name fallback) ----------
const CATS = {
  suits: { t: 'ترنجات وسويت شيرتات', ids: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14] },
  jackets: { t: 'جواكت وفيستات', ids: [2, 13] },
  pants: { t: 'بناطيل', ids: [15, 16, 17, 18] },
  shoes: { t: 'كوتشيات وأحذية', ids: [] },
  access: { t: 'إكسسوارات وأحزمة', ids: [] }
};
const CAT_ICON = { suits: '🧥', jackets: '🧣', pants: '👖', shoes: '👟', access: '🕶️' };
let catTab = 'all';
try { catTab = localStorage.getItem('cc_cat') || 'all'; } catch (e) { /* ignore */ }
function catOf(p) {
  if (!p) return null;
  for (const k of Object.keys(CATS)) if (CATS[k].ids.includes(p.id)) return k;
  const n = p.name || '';
  if (/بنطلون|بانتس|جينز/.test(n)) return 'pants';
  if (/جاكت|بامب|فيست/.test(n)) return 'jackets';
  if (/كوتشي|سنيكرز|حذاء|شوز/.test(n)) return 'shoes';
  if (/حزام|ساعة|نظارة|اكسسوار|شنطة|محفظة|كاب/.test(n)) return 'access';
  return null;
}
function catHidden(k) { return !k || !!(SETTINGS && SETTINGS['show_cat_' + k] === '0'); }
function catCount(k) { return PRODUCTS.filter(x => x.id !== (CURRENT && CURRENT.id) && catOf(x) === k).length; }
function paintCatTabs() {
  const bar = $('catTabs');
  if (!bar) return;
  bar.innerHTML = '';
  if (!PRODUCTS.length) return;
  if (catTab !== 'all' && (catHidden(catTab) || !catCount(catTab))) catTab = 'all';
  const mk = (key, label) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'cat-tab' + (catTab === key ? ' on' : '');
    b.innerHTML = label;
    b.onclick = () => { catTab = key; try { localStorage.setItem('cc_cat', key); } catch (e) {} paintCatTabs(); paintMoreProducts(); };
    bar.appendChild(b);
  };
  const visCount = PRODUCTS.filter(x => x.id !== (CURRENT && CURRENT.id) && !catHidden(catOf(x))).length;
  mk('all', 'الكل <small>(' + visCount + ')</small>');
  Object.keys(CATS).forEach(k => {
    if (catHidden(k)) return;
    const n = catCount(k);
    if (!n) return;
    mk(k, CAT_ICON[k] + ' ' + CATS[k].t + ' <small>(' + n + ')</small>');
  });
  bar.style.display = bar.children.length > 1 ? '' : 'none';
}

function renderMoreProducts() {
  const wrap = $('moreProducts');
  wrap.style.display = (SETTINGS && SETTINGS.show_more === '0') ? 'none' : '';
  paintMoreProducts();
  paintCatTabs();
}
function moreList() {
  let rest = PRODUCTS.filter(p => p.id !== CURRENT.id);
  rest = rest.filter(p => !catHidden(catOf(p)));
  if (catTab !== 'all') rest = rest.filter(p => catOf(p) === catTab);
  if (moreMode === 'all') {
    const q = (($('allSearch') && $('allSearch').value) || '').trim();
    const sort = ($('allSort') && $('allSort').value) || 'feat';
    if (q) rest = rest.filter(p => p.name.includes(q));
    const disc = (p) => { const o = Number(p.old_price) || 0; return o > p.price ? o - p.price : 0; };
    if (sort === 'cheap') rest = [...rest].sort((a, b) => a.price - b.price);
    else if (sort === 'disc') rest = [...rest].sort((a, b) => disc(b) - disc(a));
    else rest = [...rest].sort((a, b) => (b.featured || 0) - (a.featured || 0));
  } else {
    rest = [...rest].sort((a, b) => (b.featured || 0) - (a.featured || 0) || a.id - b.id);
  }
  return rest;
}
function paintMoreProducts() {
  const grid = $('productsGrid');
  grid.innerHTML = '';
  grid.className = moreMode === 'all' ? 'products-grid' : 'products-carousel';
  $('allToolbar').style.display = moreMode === 'all' ? '' : 'none';
  $('prowNav').style.display = moreMode === 'all' ? 'none' : '';
  const sb = $('showAllBtn');
  sb.textContent = moreMode === 'all' ? '⬅️ رجوع للصف' : 'عرض الكل 🛍️';
  sb.classList.toggle('on', moreMode === 'all');
  const rest = moreList();
  if (!rest.length) {
    grid.innerHTML = '<p class="muted" style="text-align:center;grid-column:1/-1">لا توجد منتجات مطابقة 🔍</p>';
  }
  rest.forEach(p => grid.appendChild(buildCard(p, 'اطلب ده', () => {
    selectProduct(p.id);
    renderMoreProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    track('AddToCart');
  })));
  $('prowCount').textContent = rest.length ? `${rest.length} منتج` : '';
  paintRecent();
}
// auto-slide the single row (pauses 8s after user interaction)
let prowTimer = null, prowLastTouch = 0;
function startProwSlider() {
  if (prowTimer) return;
  const grid = $('productsGrid');
  ['pointerdown', 'wheel', 'touchstart'].forEach(ev =>
    grid.addEventListener(ev, () => { prowLastTouch = Date.now(); }, { passive: true }));
  prowTimer = setInterval(() => {
    if (document.hidden || moreMode !== 'row' || Date.now() - prowLastTouch < 8000) return;
    const g = $('productsGrid');
    const cards = g.querySelectorAll('.pcard');
    if (cards.length < 2 || g.scrollWidth <= g.clientWidth + 10) return;
    const w = cards[0].offsetWidth + 12;
    const cur = Math.round(Math.abs(g.scrollLeft) / w);
    const next = (cur + 1 > cards.length - 1) ? 0 : cur + 1;
    g.scrollTo({ left: -(next * w), behavior: 'smooth' });
  }, 3500);
}
function prowStep(dir) {
  const g = $('productsGrid');
  const card = g.querySelector('.pcard');
  if (!card) return;
  prowLastTouch = Date.now();
  g.scrollBy({ left: dir * (card.offsetWidth + 12), behavior: 'smooth' });
}

// ---------- v4.3: size finder + wishlist + quick-view + recent (localStorage only) ----------
function guideRows() {
  return (CURRENT && CURRENT.size_guide && CURRENT.size_guide.length) ? CURRENT.size_guide : DEFAULT_GUIDE;
}
function normSize(s) {
  return String(s || '').trim().toUpperCase().replace('XXXL', '3XL').replace('XXL', '2XL');
}
function findMySize() {
  const w = Number(normDigits($('myWeight').value));
  const box = $('sizeSuggest');
  box.style.display = '';
  document.querySelectorAll('#sizeRows tr').forEach(tr => tr.classList.remove('hit'));
  if (!w || w < 30 || w > 250) { box.textContent = 'اكتب وزنك بالكيلو (من 30 لـ 250) ⚖️'; return; }
  const g = guideRows();
  let hit = g.find(r => w >= Number(r.from) && w <= Number(r.to));
  let note = '';
  if (!hit) {
    const sorted = [...g].sort((a, b) => Number(a.from) - Number(b.from));
    hit = w < Number(sorted[0].from) ? sorted[0] : sorted[sorted.length - 1];
    note = w < Number(sorted[0].from) ? ' (أصغر مقاس عندنا)' : ' (أكبر مقاس عندنا — ولو بين مقاسين خد الأكبر)';
  }
  [...document.querySelectorAll('#sizeRows tr')].forEach(tr => {
    if (tr.cells[0] && normSize(tr.cells[0].textContent) === normSize(hit.size)) tr.classList.add('hit');
  });
  const idx = (CURRENT.sizes || []).findIndex(s => normSize(s) === normSize(hit.size));
  if (idx >= 0) { selSize = idx; renderProduct(); }
  box.textContent = `مقاسك المقترح: ${hit.size} ✨${note}`;
}
// wishlist
let FAVS = [];
function loadFavs() { try { FAVS = JSON.parse(localStorage.getItem('cc_fav') || '[]'); } catch { FAVS = []; } }
function saveFavs() { try { localStorage.setItem('cc_fav', JSON.stringify(FAVS)); } catch { /* ignore */ } }
function updateFavBtn() {
  const on = CURRENT && FAVS.includes(CURRENT.id);
  $('favBtn').textContent = on ? '❤️' : '🤍';
  $('favBtn').classList.toggle('on', !!on);
  const b = $('favBadge');
  b.style.display = FAVS.length ? '' : 'none';
  b.textContent = FAVS.length > 99 ? '+99' : FAVS.length;
}
function toggleFav() {
  if (!CURRENT) return;
  FAVS = FAVS.includes(CURRENT.id) ? FAVS.filter(id => id !== CURRENT.id) : [...FAVS, CURRENT.id];
  saveFavs(); updateFavBtn(); paintFavs();
  toast(FAVS.includes(CURRENT.id) ? 'اتضافت للمفضلة ❤️' : 'اتشالت من المفضلة 🤍');
}
function paintFavs() {
  updateFavBtn();
  const grid = $('favGrid');
  grid.innerHTML = '';
  const list = FAVS.map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean);
  $('favSection').style.display = list.length ? '' : 'none';
  list.forEach(p => grid.appendChild(buildCard(p, 'شوفه 👀', () => {
    selectProduct(p.id); renderMoreProducts(); window.scrollTo({ top: 0, behavior: 'smooth' });
  })));
}
function buildCard(p, btnLabel, onBtn) {
  const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
  const old = Number(p.old_price) || 0;
  const card = document.createElement('div');
  card.className = 'pcard';
  card.innerHTML = `
    <div class="pcard-imgwrap"><img src="${img}" alt="${esc(p.name)}" loading="lazy" decoding="async">${p.featured ? '<span class="pcard-feat">⭐ مميز</span>' : ''}${p.video ? '<span class="pcard-vid">🎬</span>' : ''}</div>
    <div class="pbody"><b>${esc(p.name)}</b>
      <div class="prow">
        <div class="pprice">${p.price} ج ${old > p.price ? `<small>${old} ج</small>` : ''}</div>
        <button class="btn btn-primary">${esc(btnLabel)}</button>
      </div>
    </div>`;
  card.querySelector('.pcard-imgwrap').onclick = () => openQV(p.id);
  card.querySelector('.prow button').onclick = onBtn;
  return card;
}
// quick view
let QV_ID = 0;
function openQV(pid) {
  const p = PRODUCTS.find(x => x.id === pid);
  if (!p) return;
  QV_ID = pid;
  $('qvImg').src = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
  $('qvImg').alt = p.name;
  $('qvName').textContent = p.name;
  $('qvPrice').textContent = p.price + ' جنيه';
  const old = Number(p.old_price) || 0;
  $('qvOld').textContent = old > p.price ? old + ' جنيه' : '';
  $('qvMeta').textContent = `🎨 ${p.colors.length} ألوان | 📏 ${(p.sizes || []).join('، ')}` + (p.stock <= 5 ? ` | ⚡ باقي ${p.stock} بس` : '');
  $('qvModal').classList.add('show');
}
function closeQV() { $('qvModal').classList.remove('show'); }
// recently viewed
function pushRecent(pid) {
  try {
    let r = JSON.parse(localStorage.getItem('cc_recent') || '[]').filter(id => id !== pid);
    r.unshift(pid);
    localStorage.setItem('cc_recent', JSON.stringify(r.slice(0, 8)));
  } catch { /* ignore */ }
}
function paintRecent() {
  let r = [];
  try { r = JSON.parse(localStorage.getItem('cc_recent') || '[]'); } catch { /* ignore */ }
  const list = r.filter(id => !CURRENT || id !== CURRENT.id).map(id => PRODUCTS.find(p => p.id === id)).filter(Boolean).slice(0, 6);
  $('recentStrip').style.display = (moreMode === 'row' && list.length) ? '' : 'none';
  $('recentItems').innerHTML = '';
  list.forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'recent-chip';
    b.innerHTML = `<img src="${img}" alt="" loading="lazy"><span>${esc(p.name)}</span>`;
    b.onclick = () => { selectProduct(p.id); renderMoreProducts(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    $('recentItems').appendChild(b);
  });
}



// ---------- v4.4: smart chat (localStorage only, handoff to WhatsApp) ----------
let CHAT = { msgs: [], name: '', phone: '' };
function loadChat() {
  try {
    const c = JSON.parse(localStorage.getItem('cc_chat') || 'null');
    if (c && Array.isArray(c.msgs)) CHAT = { msgs: c.msgs.slice(-40), name: c.name || '', phone: c.phone || '' };
  } catch { /* ignore */ }
}
function saveChat() {
  try { localStorage.setItem('cc_chat', JSON.stringify({ msgs: CHAT.msgs.slice(-40), name: CHAT.name, phone: CHAT.phone })); } catch { /* ignore */ }
}
function chatScroll() { const m = $('chatMsgs'); m.scrollTop = m.scrollHeight; }
function chatBubble(text, who) {
  CHAT.msgs.push({ t: text, w: who });
  saveChat();
  const d = document.createElement('div');
  d.className = 'chat-bubble ' + who;
  d.textContent = text;
  $('chatMsgs').appendChild(d);
  chatScroll();
}
function chatWaBtn(label) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'chat-wa';
  b.textContent = label || 'كمّل المحادثة على واتساب 💬';
  b.onclick = () => {
    const first = (CHAT.msgs.find(m => m.w === 'me') || {}).t || '';
    const prod = CURRENT ? `${CURRENT.name} (${CURRENT.price} جنيه)` : '';
    openWhatsApp(SETTINGS.whatsapp || '', `أهلاً كايرو شيك 🦅\nالاسم: ${CHAT.name}\nالتليفون: ${CHAT.phone}\nالرسالة: ${first}\nالمنتج: ${prod}`);
  };
  $('chatMsgs').appendChild(b);
  chatScroll();
}
const CHAT_QUICK = ['🚚 الشحن بياخد قد إيه؟', '💵 الدفع إزاي؟', '📏 إزاي أختار مقاسي؟', '🎁 في خصم؟'];
function paintChatQuick() {
  const q = $('chatQuick');
  q.innerHTML = '';
  if ($('chatLead').style.display !== 'none') return;
  CHAT_QUICK.forEach(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t;
    b.onclick = () => chatSend(t);
    q.appendChild(b);
  });
}
function openChat() {
  $('chatPanel').style.display = 'flex';
  $('chatDot').style.display = 'none';
  try { localStorage.setItem('cc_chat_seen', '1'); } catch { /* ignore */ }
  if (!CHAT.msgs.length) {
    chatBubble(`أهلاً بيك في كايرو شيك 🦅\nأنا المساعد الذكي — اسألني عن الشحن أو الدفع أو المقاسات، أو اكتب رسالتك وهحوّلك لموظف خدمة العملاء 👌\nمستعجل؟ دوس 📲 فوق للواتساب المباشر`, 'bot');
  }
  paintChatQuick();
  chatScroll();
}
function closeChat() { $('chatPanel').style.display = 'none'; }
function shipRange() {
  const govs = (SETTINGS && SETTINGS.governorates) || [];
  if (!govs.length) return '';
  const fees = govs.map(g => Number(g.shipping) || 0);
  return ` (من ${Math.min(...fees)} لـ ${Math.max(...fees)} جنيه حسب المحافظة)`;
}
function chatBotAnswer(text) {
  const t = text.replace(/[؟?]/g, '');
  if (/شحن|توصيل|يوصل|امتى|فين|محافظ|استلم/.test(t)) return `الشحن سريع لكل محافظات مصر 🇪🇬 (ماعدا سيناء) من 2 لـ 5 أيام عمل${shipRange()} 🚚\nلو عايز تطلب، دوس «اطلب دلوقتي» واكتب بياناتك والدفع عند الاستلام 💵`;
  if (/دفع|فلوس|كاش|فيزا|مقدم|عربون/.test(t)) return 'الدفع كاش عند الاستلام 💵 — مفيش أي دفع مقدم، وبتعاين المنتج قبل ما تدفع 📦';
  if (/مقاس|سايز|يلبس|وزن|كبير|صغير/.test(t)) { setTimeout(openSizeGuide, 900); return 'عندنا دليل مقاسات لكل منتج 📏 — هفتحهولك دلوقتي، اكتب وزنك وهيقترحلك مقاسك ✨'; }
  if (/سعر|بكام|بكم|خصم|عرض|غالي/.test(t)) {
    if (!CURRENT) return 'عندنا عروض وخصومات مستمرة 🎁 — ابعتلي اسم المنتج اللي عاجبك وأقولك سعره!';
    const old = Number(CURRENT.old_price) || 0;
    return `${CURRENT.name} بسعر ${CURRENT.price} جنيه${old > CURRENT.price ? ` بدل ${old} (وفّر ${old - CURRENT.price} جنيه 🏷️)` : ''} 🔥`;
  }
  if (/طلب|اوردر|اشتر|عايز |اطلب/.test(t)) return 'تطلب في دقيقة واحدة 📝: اختار اللون والمقاس ودوس «اطلب دلوقتي» واكتب اسمك ورقمك وعنوانك — وهنكلمك نأكد الطلب 📞';
  if (/موظف|بشري|حد يكلمني|خدمة عمل|رقم التليفون|اتصل/.test(t)) return null; // -> handoff
  if (/سلام|اهلا|أهلا|ازيك|صباح|مساء|هاي/.test(t) && t.length < 20) return 'أهلاً أهلاً 🌟 اسألني عن أي حاجة (شحن، دفع، مقاسات، أسعار) أو اكتب رسالتك وهوصّلك بموظف 👌';
  return null; // -> handoff
}
function chatHandoff() {
  if (CHAT.name && CHAT.phone) {
    chatBubble('تمام، بياناتك متسجلة عندنا ✅ دوس الزرار ده وكمّل مع موظف خدمة العملاء على واتساب 👇', 'bot');
    chatWaBtn();
    return;
  }
  chatBubble('تمام ✅ عشان أحد ممثلي خدمة عملاء كايرو شيك 🦅 يتواصل معاك، اكتب اسمك ورقم موبايلك تحت 👇', 'bot');
  $('chatLead').style.display = 'flex';
  paintChatQuick();
}
function chatLeadSubmit() {
  const name = ($('chatName').value || '').trim();
  const phone = normDigits($('chatPhone').value || '').replace(/[^0-9]/g, '');
  if (name.length < 2) { toast('اكتب اسمك الأول 📝'); return; }
  if (!/^01[0125][0-9]{8}$/.test(phone)) { toast('رقم الموبايل غلط — لازم يبدأ بـ 01 ومن 11 رقم 📱'); return; }
  CHAT.name = name; CHAT.phone = phone; saveChat();
  $('chatLead').style.display = 'none';
  paintChatQuick();
  chatBubble(`تمام يا ${name}! 🌟\nرسالتك وصلتنا، وجاري تحويلك دلوقتي لأحد ممثلي خدمة عملاء كايرو شيك 🦅\nهيتواصل معاك في أقرب وقت على ${phone} 📱`, 'bot');
  chatWaBtn();
}
function chatSend(text) {
  text = (text || $('chatText').value || '').trim();
  if (!text) return;
  $('chatText').value = '';
  chatBubble(text, 'me');
  setTimeout(() => {
    const ans = chatBotAnswer(text);
    if (ans) chatBubble(ans, 'bot');
    else chatHandoff();
  }, 600);
}
function paintChatHistory() {
  $('chatMsgs').innerHTML = '';
  CHAT.msgs.forEach(m => {
    const d = document.createElement('div');
    d.className = 'chat-bubble ' + m.w;
    d.textContent = m.t;
    $('chatMsgs').appendChild(d);
  });
}
function initChat() {
  loadChat();
  paintChatHistory();
  if (CHAT.name) { $('chatName').value = CHAT.name; $('chatPhone').value = CHAT.phone; }
  $('chatFab').onclick = () => ($('chatPanel').style.display === 'none' ? openChat() : closeChat());
  $('chatX').onclick = closeChat;
  $('chatWaBtn').onclick = () => openWhatsApp(SETTINGS.whatsapp || '', waInquiryMsg());
  $('chatWaTop').onclick = () => openWhatsApp(SETTINGS.whatsapp || '', waInquiryMsg());
  $('chatSend').onclick = () => chatSend();
  $('chatText').addEventListener('keydown', (e) => { if (e.key === 'Enter') chatSend(); });
  $('chatLeadGo').onclick = chatLeadSubmit;
  // gentle nudge after 30s for first-time visitors
  setTimeout(() => {
    try {
      if (!localStorage.getItem('cc_chat_seen') && $('chatPanel').style.display === 'none') $('chatDot').style.display = '';
    } catch { /* ignore */ }
  }, 30000);
}
function initAppBanner() {
  if (!isInAppBrowser()) return;
  try { if (localStorage.getItem('cc_nobanner')) return; } catch { /* ignore */ }
  $('appBannerTxt').textContent = `📱 فاتح من ${inAppName()}؟ لأحسن تجربة دوس ⋯ فوق واختار «فتح في المتصفح» عشان الواتساب والطلب يشتغلوا تمام 🌐`;
  $('appBanner').style.display = '';
  $('appBannerX').onclick = () => {
    $('appBanner').style.display = 'none';
    try { localStorage.setItem('cc_nobanner', '1'); } catch { /* ignore */ }
  };
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

function stockCap(p) {
  if (!p || p.stock === null || p.stock === undefined || p.stock === '') return 5;
  return Math.max(0, Math.min(5, Number(p.stock) || 0));
}
function addCurrentToCart(openDrawer) {
  if (!CURRENT) return;
  if (stockCap(CURRENT) < 1) { toast('نفد المخزون 😔'); return; }
  const color = CURRENT.colors[selColor] ? CURRENT.colors[selColor].name : '';
  const size = CURRENT.sizes[selSize] || '';
  if (!color || !size) { toast('اختار اللون والمقاس الأول'); return; }
  const ex = CART.find(l => l.pid === CURRENT.id && l.color === color && l.size === size);
  if (ex) ex.qty = Math.min(stockCap(CURRENT), ex.qty + qty);
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
  const cp = (typeof PRODUCTS !== 'undefined' ? PRODUCTS : []).find(p => p.id === CART[i].pid);
  CART[i].qty = Math.max(1, Math.min(stockCap(cp), CART[i].qty + d));
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
  const wa = $('cartWa');
  if (wa) {
    if (!det.length || !SETTINGS.whatsapp) { wa.style.display = 'none'; }
    else {
      wa.style.display = '';
      const lines = det.map((x, i) => `${i + 1}) ${x.p.name} — ${x.color} / ${x.size} × ${x.qty} = ${x.p.price * x.qty}ج`);
      const msg = `سلام عليكم 🦅 عايز أطلب من *${SETTINGS.store_name_ar || 'كايرو شيك'}*:\n\n${lines.join('\n')}\n\nالإجمالي (بدون الشحن): ${cartSubtotal()}ج`;
      wa.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(msg)}`;
    }
  }
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
function waInquiryMsg() {
  const waTpl = (SETTINGS && SETTINGS.wa_msg) || 'أهلاً {store}، عندي استفسار عن {product}';
  return waTpl.split('{store}').join((SETTINGS && SETTINGS.store_name_ar) || 'كايرو شيك').split('{product}').join(CURRENT ? CURRENT.name : '');
}
function updateWaFloat() {
  const off = !SETTINGS || !SETTINGS.whatsapp || !CURRENT || SETTINGS.show_wa === '0';
  $('sbWaSec').style.display = off ? 'none' : '';
  $('chatWaBtn').style.display = off ? 'none' : '';
  $('chatWaTop').style.display = off ? 'none' : '';
  if (off) return;
  $('sbWa').href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(waInquiryMsg())}`;
}

// v4.4: open WhatsApp reliably incl. TikTok/FB in-app browsers (zero storage)
function isInAppBrowser() {
  const ua = (navigator.userAgent || '').toLowerCase();
  return /tiktok|musical_ly|musically|bytedance|fban\/|fbav\/|fb_iab|instagram|snapchat|micromessenger|line\//.test(ua);
}
function inAppName() {
  const ua = (navigator.userAgent || '').toLowerCase();
  if (/tiktok|musical_ly|musically|bytedance/.test(ua)) return 'تيك توك';
  if (/instagram/.test(ua)) return 'انستجرام';
  if (/fban\/|fbav\/|fb_iab/.test(ua)) return 'فيسبوك';
  if (/snapchat/.test(ua)) return 'سناب شات';
  return 'التطبيق';
}
function openWhatsApp(phone, text) {
  phone = String(phone || '').replace(/[^0-9]/g, '');
  const enc = encodeURIComponent(text || '');
  // 1) try the app directly (deep link works in most webviews incl. TikTok)
  try { window.location.href = phone ? `whatsapp://send?phone=${phone}&text=${enc}` : `whatsapp://send?text=${enc}`; } catch { /* ignore */ }
  // 2) fallback to web page only if the app didn't open (browser still visible)
  setTimeout(() => {
    if (document.hidden) return;
    window.open(`https://api.whatsapp.com/send?${phone ? 'phone=' + phone + '&' : ''}text=${enc}`, '_blank');
    if (isInAppBrowser()) setTimeout(() => toast(`لو الواتساب مفتحش: دوس ⋯ فوق واختار «فتح في المتصفح» 🌐`), 700);
  }, 1600);
}

let revTimer = null, revLastTouch = 0;
function startReviewsSlider() {
  if (revTimer) return;
  const grid = $('reviewsGrid');
  if (grid) {
    ['pointerdown', 'wheel', 'touchstart'].forEach(ev =>
      grid.addEventListener(ev, () => { revLastTouch = Date.now(); }, { passive: true }));
  }
  revTimer = setInterval(() => {
    if (document.hidden || Date.now() - revLastTouch < 8000) return;
    const g = $('reviewsGrid');
    if (!g) return;
    const cards = g.querySelectorAll('.review');
    if (cards.length < 2 || g.scrollWidth <= g.clientWidth + 10) return;
    const w = cards[0].offsetWidth + 10;
    const cur = Math.round(Math.abs(g.scrollLeft) / w);
    const next = (cur + 1 > cards.length - 1) ? 0 : cur + 1;
    g.scrollTo({ left: -(next * w), behavior: 'smooth' });
  }, 3200);
}

const DEFAULT_GUIDE = [
  { size: 'M', from: 60, to: 75 },
  { size: 'L', from: 75, to: 90 },
  { size: 'XL', from: 90, to: 105 },
  { size: 'XXL', from: 105, to: 120 }
];
function openSizeGuide() {
  const g = (CURRENT && CURRENT.size_guide && CURRENT.size_guide.length) ? CURRENT.size_guide : DEFAULT_GUIDE;
  $('sizeRows').innerHTML = g.map(r => `<tr><td><b>${esc(r.size)}</b></td><td>${esc(r.from)} – ${esc(r.to)} كجم</td></tr>`).join('');
  $('sizeProdName').textContent = CURRENT ? CURRENT.name : '';
  $('sizeSuggest').style.display = 'none';
  $('myWeight').value = '';
  $('sizeModal').classList.add('show');
}
function closeSizeGuide() { $('sizeModal').classList.remove('show'); }

let lastSwipe = 0;
function bindUI() {
  $('qtyPlus').onclick = () => { const cap = stockCap(CURRENT); if (qty < cap) { qty++; $('qtyVal').textContent = qty; } };
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
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeCart(); closeSide(); closeQV(); closeChat(); $('lightbox').classList.remove('show'); } });
  // route every wa.me link through the deep-link opener (TikTok webview fix)
  document.addEventListener('click', (e) => {
    const a = e.target && e.target.closest ? e.target.closest('a[href*="wa.me/"]') : null;
    if (!a) return;
    e.preventDefault();
    try {
      const u = new URL(a.href);
      openWhatsApp(u.pathname.replace(/[^0-9]/g, ''), u.searchParams.get('text') || '');
    } catch { window.open(a.href, '_blank'); }
  });
  $('sbTrackBtn').onclick = doSbTrack;
  startReviewsSlider();
  startProwSlider();
  if ($('sizeGuideBtn')) $('sizeGuideBtn').onclick = openSizeGuide;
  if ($('sizeClose')) $('sizeClose').onclick = closeSizeGuide;
  if ($('sizeModal')) $('sizeModal').addEventListener('click', (e) => { if (e.target.id === 'sizeModal') closeSizeGuide(); });
  // v4.2: carousel + show-all + share + lightbox + back-to-top
  $('showAllBtn').onclick = () => { moreMode = moreMode === 'all' ? 'row' : 'all'; paintMoreProducts(); };
  $('allSearch').oninput = paintMoreProducts;
  $('allSort').onchange = paintMoreProducts;
  $('prowNext').onclick = () => prowStep(-1);
  $('prowPrev').onclick = () => prowStep(1);
  $('shareWa').onclick = () => {
    if (!CURRENT) return;
    const link = location.origin + location.pathname + '?p=' + CURRENT.id;
    const msg = `شوف ${CURRENT.name} بسعر ${CURRENT.price} جنيه من ${SETTINGS.store_name_ar || 'كايرو شيك'} 🔥\n${link}`;
    openWhatsApp('', msg);
  };
  $('shareCopy').onclick = async () => {
    if (!CURRENT) return;
    const link = location.origin + location.pathname + '?p=' + CURRENT.id;
    try { await navigator.clipboard.writeText(link); toast('اتنسخ رابط المنتج 📋'); }
    catch { toast('انسخ الرابط من شريط المتصفح 📋'); }
  };
  $('mainImage').onclick = () => { if (Date.now() - lastSwipe < 400) return; $('lightboxImg').src = $('mainImage').src; $('lightbox').classList.add('show'); };
  $('lightbox').onclick = () => $('lightbox').classList.remove('show');
  window.addEventListener('scroll', () => { $('topFloat').classList.toggle('show', window.scrollY > 600); }, { passive: true });
  $('topFloat').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  // v4.3: size finder + wishlist + quick-view + gallery swipe
  $('findSizeBtn').onclick = findMySize;
  $('myWeight').addEventListener('keydown', (e) => { if (e.key === 'Enter') findMySize(); });
  $('favBtn').onclick = toggleFav;
  $('favOpen').onclick = () => {
    if (!FAVS.length) { toast('مفيش مفضلة لسه — دوس 🤍 على أي منتج يعجبك'); return; }
    $('favSection').scrollIntoView({ behavior: 'smooth' });
  };
  $('favClear').onclick = () => {
    if (!FAVS.length || !confirm('تمسح كل المفضلة؟')) return;
    FAVS = []; saveFavs(); paintFavs();
  };
  $('qvClose').onclick = closeQV;
  $('qvModal').addEventListener('click', (e) => { if (e.target.id === 'qvModal') closeQV(); });
  $('qvGo').onclick = () => {
    closeQV(); selectProduct(QV_ID); renderMoreProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  let swipeX = null;
  const mi = $('mainImage');
  mi.addEventListener('touchstart', (e) => { swipeX = e.touches[0].clientX; }, { passive: true });
  mi.addEventListener('touchend', (e) => {
    if (swipeX === null || !CURRENT || !CURRENT.colors || CURRENT.colors.length < 2) return;
    const dx = e.changedTouches[0].clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) < 40) return;
    lastSwipe = Date.now();
    selColor = (selColor + (dx < 0 ? 1 : -1) + CURRENT.colors.length) % CURRENT.colors.length;
    renderProduct();
  }, { passive: true });
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
    const sb = $('submitBtn');
    if (sb) { sb.disabled = false; sb.textContent = 'تأكيد الطلب ✅'; }
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
