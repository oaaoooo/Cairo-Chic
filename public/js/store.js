// ================= CAIRO CHIC - Storefront =================
const $ = (id) => document.getElementById(id);
let SETTINGS = null, PRODUCTS = [], CURRENT = null;
let selColor = 0, selSize = 1, qty = 1;

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
function normDigits(s) {
  return String(s || '').replace(/[٠-٩]/g, d => AR_DIGITS.indexOf(d));
}

async function init() {
  try {
    const [s, p] = await Promise.all([
      fetch('/api/settings-public').then(r => r.json()),
      fetch('/api/products').then(r => r.json())
    ]);
    SETTINGS = s; PRODUCTS = p.products || [];
    if (SETTINGS.announcement) $('announce').textContent = SETTINGS.announcement;
    buildGovSelect();
    if (PRODUCTS.length) selectProduct(PRODUCTS[0].id);
    if (PRODUCTS.length > 1) renderMoreProducts();
    loadTikTokPixel(SETTINGS.tiktok_pixel);
    track('ViewContent');
  } catch (e) {
    console.error(e);
  }
  startCountdown();
  bindUI();
}

function selectProduct(id) {
  CURRENT = PRODUCTS.find(p => p.id === id) || PRODUCTS[0];
  selColor = 0;
  selSize = CURRENT.sizes.length > 1 ? 1 : 0;
  qty = 1; $('qtyVal').textContent = '1';
  renderProduct();
  updateSummary();
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
      <img src="${img}" alt="${p.name}">
      <div class="pbody"><b>${p.name}</b>
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

function shippingFor(gov) {
  if (!gov || !SETTINGS) return 0;
  return SETTINGS.city_govs.includes(gov) ? SETTINGS.shipping_cities : SETTINGS.shipping_others;
}

function updateSummary() {
  if (!CURRENT) return;
  const img = (CURRENT.colors[selColor] && CURRENT.colors[selColor].image) || '/images/logo.jpg';
  $('sumImage').src = img;
  $('sumName').textContent = CURRENT.name;
  $('sumColor').textContent = CURRENT.colors[selColor] ? CURRENT.colors[selColor].name : '';
  $('sumSize').textContent = CURRENT.sizes[selSize] || '';
  $('sumQty').textContent = qty;
  $('sumPrice').textContent = CURRENT.price * qty;
  const gov = $('govSelect').value;
  const ship = shippingFor(gov);
  $('sumShip').textContent = gov ? ship + ' جنيه' : '— (اختار المحافظة)';
  $('sumTotal').textContent = CURRENT.price * qty + (gov ? ship : 0);
}

function buildGovSelect() {
  const sel = $('govSelect');
  SETTINGS.governorates.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    sel.appendChild(o);
  });
  sel.onchange = updateSummary;
}

function startCountdown() {
  function tick() {
    const now = new Date(), end = new Date();
    end.setHours(23, 59, 59, 999);
    let s = Math.max(0, Math.floor((end - now) / 1000));
    $('cdH').textContent = String(Math.floor(s / 3600)).padStart(2, '0');
    $('cdM').textContent = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    $('cdS').textContent = String(s % 60).padStart(2, '0');
  }
  tick(); setInterval(tick, 1000);
}

function bindUI() {
  $('qtyPlus').onclick = () => { if (qty < 5) { qty++; $('qtyVal').textContent = qty; updateSummary(); } };
  $('qtyMinus').onclick = () => { if (qty > 1) { qty--; $('qtyVal').textContent = qty; updateSummary(); } };
  document.querySelectorAll('[data-cta]').forEach(a => a.addEventListener('click', () => track('AddToCart')));
  document.querySelectorAll('.faq-q').forEach(q => q.onclick = () => q.parentElement.classList.toggle('open'));
  $('govSelect').addEventListener('change', updateSummary);
  $('orderForm').addEventListener('submit', submitOrder);
  $('newOrderBtn').onclick = () => {
    $('orderSuccess').style.display = 'none';
    $('orderForm').style.display = '';
    $('orderForm').reset();
    updateSummary();
  };
  // WhatsApp float
  if (SETTINGS && SETTINGS.whatsapp) {
    const wa = $('waFloat');
    wa.style.display = 'flex';
    wa.href = `https://wa.me/${SETTINGS.whatsapp}?text=${encodeURIComponent('أهلاً كايرو شيك، عندي استفسار عن ترنج V11')}`;
  }
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
