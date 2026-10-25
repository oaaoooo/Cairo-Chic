// ================= CAIRO CHIC - Storefront =================
const $ = (id) => document.getElementById(id);
let SETTINGS = null, PRODUCTS = [], CURRENT = null;
let selColor = 0, selSize = 1, qty = 1;
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
  try {
    const [s, p] = await Promise.all([
      fetch('/api/settings-public').then(r => r.json()),
      fetch('/api/products').then(r => r.json())
    ]);
    SETTINGS = s; PRODUCTS = p.products || [];
    if (SETTINGS.announcement) $('announce').textContent = SETTINGS.announcement;
    applyBrand();
    applyTheme();
    applyContent();
    applyDeal();
    buildGovSelect();
    if (PRODUCTS.length) selectProduct(PRODUCTS[0].id);
    if (PRODUCTS.length > 1) renderMoreProducts();
    // section titles from settings (fallback to defaults)
    $('featuresTitle').textContent = SETTINGS.features_title || DEF_TITLES.featuresTitle;
    $('reviewsTitle').textContent = SETTINGS.reviews_title || DEF_TITLES.reviewsTitle;
    $('howTitle').textContent = SETTINGS.how_title || DEF_TITLES.howTitle;
    $('faqTitle').textContent = SETTINGS.faq_title || DEF_TITLES.faqTitle;
    $('moreTitle').textContent = SETTINGS.more_title || DEF_TITLES.moreTitle;
    loadTikTokPixel(SETTINGS.tiktok_pixel);
    track('ViewContent');
  } catch (e) {
    console.error(e);
  }
  startCountdown();
  bindUI();
  paintStars();
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
  const thumbs = $('thumbs'); thumbs.innerHTML = '';
  p.colors.forEach((c, i) => {
    const img = document.createElement('img');
    img.src = c.image || '/images/logo.jpg';
    img.alt = c.name;
    img.className = i === selColor ? 'active' : '';
    img.onclick = () => { selColor = i; renderProduct(); updateSummary(); };
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
    b.onclick = () => { selColor = i; renderProduct(); updateSummary(); };
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
    b.onclick = () => { selSize = i; renderProduct(); updateSummary(); };
    sb.appendChild(b);
  });
  $('sizeName').textContent = p.sizes[selSize] || '';
}

function renderMoreProducts() {
  const wrap = $('moreProducts'), grid = $('productsGrid');
  wrap.style.display = '';
  grid.innerHTML = '';
  PRODUCTS.filter(p => p.id !== CURRENT.id).forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const old = Number(p.old_price) || 0;
    const card = document.createElement('div');
    card.className = 'pcard';
    card.innerHTML = `
      <img src="${img}" alt="${esc(p.name)}">
      <div class="pbody"><b>${esc(p.name)}</b>
        <div class="prow">
          <div class="pprice">${p.price} ج ${old > p.price ? `<small>${old} ج</small>` : ''}</div>
          <button class="btn btn-primary">اطلب ده</button>
        </div>
      </div>`;
    card.querySelector('button').onclick = () => {
      selectProduct(p.id);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      track('AddToCart');
    };
    grid.appendChild(card);
  });
}

// ---------- Governorates & shipping ----------
function govList() {
  // supports new [{name,shipping}] and legacy [names] shapes
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
  govList().forEach(g => {
    const o = document.createElement('option');
    o.value = g.name;
    o.textContent = `${g.name} (شحن ${g.shipping} ج)`;
    sel.appendChild(o);
  });
  sel.onchange = updateSummary;
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
  if (!CURRENT) return;
  msg.textContent = 'جاري التحقق... ⏳';
  try {
    const r = await fetch('/api/coupon', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, subtotal: CURRENT.price * qty })
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
  if (!CURRENT) return;
  const img = (CURRENT.colors[selColor] && CURRENT.colors[selColor].image) || '/images/logo.jpg';
  $('sumImage').src = img;
  $('sumName').textContent = CURRENT.name;
  $('sumColor').textContent = CURRENT.colors[selColor] ? CURRENT.colors[selColor].name : '';
  $('sumSize').textContent = CURRENT.sizes[selSize] || '';
  $('sumQty').textContent = qty;
  const sub = CURRENT.price * qty;
  $('sumPrice').textContent = sub;
  const disc = couponDiscount(sub);
  if (COUPON && disc > 0) {
    $('discountLine').style.display = '';
    $('sumDiscount').textContent = disc;
    $('sumCoupon').textContent = COUPON.code;
  } else {
    $('discountLine').style.display = 'none';
    if (COUPON && disc === 0) $('couponMsg').textContent = '⚠️ الكود مش شغال على المبلغ ده';
  }
  const gov = $('govSelect').value;
  const ship = shippingFor(gov);
  $('sumShip').textContent = gov ? ship + ' جنيه' : '— (اختار المحافظة)';
  $('sumTotal').textContent = sub - disc + (gov ? ship : 0);
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
    err.textContent = 'شكراً! تقييمك هيظهر بعد المراجعة 🙏';
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
  if (!SETTINGS || !SETTINGS.whatsapp || !CURRENT) return;
  const wa = $('waFloat');
  wa.style.display = 'flex';
  wa.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(`أهلاً ${SETTINGS.store_name_ar || 'كايرو شيك'}، عندي استفسار عن ${CURRENT.name}`)}`;
}

function bindUI() {
  $('qtyPlus').onclick = () => { if (qty < 5) { qty++; $('qtyVal').textContent = qty; updateSummary(); } };
  $('qtyMinus').onclick = () => { if (qty > 1) { qty--; $('qtyVal').textContent = qty; updateSummary(); } };
  document.querySelectorAll('[data-cta]').forEach(a => a.addEventListener('click', () => track('AddToCart')));
  document.querySelectorAll('.faq-q').forEach(q => q.onclick = () => q.parentElement.classList.toggle('open'));
  $('govSelect').addEventListener('change', updateSummary);
  $('couponBtn').onclick = applyCoupon;
  $('couponInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyCoupon(); } });
  $('orderForm').addEventListener('submit', submitOrder);
  document.querySelectorAll('#starsInput button').forEach(b => b.onclick = () => { myRating = Number(b.dataset.r); paintStars(); });
  $('revSubmit').onclick = submitReview;
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
  const fd = new FormData(e.target);
  const payload = {
    product_id: CURRENT.id,
    color: CURRENT.colors[selColor] ? CURRENT.colors[selColor].name : '',
    size: CURRENT.sizes[selSize] || '',
    qty,
    coupon_code: COUPON ? COUPON.code : '',
    name: fd.get('name').trim(),
    phone: normDigits(fd.get('phone')),
    governorate: fd.get('governorate'),
    address: fd.get('address').trim(),
    notes: (fd.get('notes') || '').trim()
  };
  if (payload.name.length < 3) { err.textContent = 'اكتب الاسم بالكامل'; return; }
  if (!/^01[0125][0-9]{8}$/.test(payload.phone)) { err.textContent = 'رقم الموبايل غلط — لازم يبدأ بـ 01 و11 رقم'; return; }
  if (!payload.governorate) { err.textContent = 'اختار المحافظة'; return; }
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
    $('orderForm').style.display = 'none';
    $('orderSuccess').style.display = '';
    $('okOrderNo').textContent = j.order_no;
    $('okTotal').textContent = j.total;
    if (SETTINGS.whatsapp) {
      const w = $('waConfirm');
      w.style.display = '';
      w.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent(`أهلاً، أنا سجلت طلب ${j.order_no} (${CURRENT.name} - ${payload.color} - ${payload.size}) وعايز أأكده`)}`;
    }
    $('orderSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch {
    err.textContent = 'مشكلة في الاتصال، حاول تاني';
    btn.disabled = false; btn.textContent = 'تأكيد الطلب ✅';
  }
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
