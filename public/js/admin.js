// Non-blocking font load (CSP-safe: no inline handlers)
(function () {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap';
  document.head.appendChild(l);
})();
// ================= CAIRO CHIC - Admin =================
const $ = (id) => document.getElementById(id);
let STATUS_AR = {};
let revFilter = 'pending';
let ORDERS_CACHE = [], ADMIN_PRODUCTS = [], PRINT_ORDER = null;

// Cairo time, 12-hour format: 25/10/2026 + 6:40 م
function fmtDT(iso) {
  try {
    const d = new Date(iso);
    const p = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Africa/Cairo', day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    }).formatToParts(d).reduce((a, x) => (a[x.type] = x.value, a), {});
    const ap = String(p.dayPeriod || '').toUpperCase() === 'PM' ? 'م' : 'ص';
    return `${p.day}/${p.month}/${p.year}<br><b>${Number(p.hour)}:${p.minute} ${ap}</b>`;
  } catch { return esc((iso || '').slice(0, 16)); }
}

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
const FIELD_MAP = {
  sNameAr: 'store_name_ar', sNameEn: 'store_name_en', sAnnounce: 'announcement',
  sWhatsapp: 'whatsapp', sWaMsg: 'wa_msg', sPixel: 'tiktok_pixel', sTrackPlace: 'track_place',
  sFeaturesTitle: 'features_title', sReviewsTitle: 'reviews_title', sHowTitle: 'how_title',
  sFaqTitle: 'faq_title', sMoreTitle: 'more_title',
  sFooterText: 'footer_text', sStockLine: 'stock_line', sSizeHint: 'size_hint', sCtaText: 'cta_text',
  sThemePrimary: 'theme_primary', sThemeDark: 'theme_dark',
  sDealTitle: 'deal_title', sDealSub: 'deal_sub', sDealEndsAt: 'deal_ends_at',
  sMaintMsg: 'maint_msg', sMaintEndsAt: 'maint_ends_at'
};

const VIS_MAP = {
  vReviews: 'show_reviews', vCoupon: 'show_coupon', vFeatures: 'show_features',
  vTrust: 'show_trust', vHow: 'show_how', vFaq: 'show_faq',
  vCountdown: 'show_countdown', vAnnounce: 'show_announce', vWa: 'show_wa',
  vTrack: 'show_track', vMore: 'show_more',
  vCatSuits: 'show_cat_suits', vCatJackets: 'show_cat_jackets', vCatPants: 'show_cat_pants',
  vCatShoes: 'show_cat_shoes', vCatAccess: 'show_cat_access'
};

async function api(url, method = 'GET', body) {
  const r = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  return r.json();
}

document.addEventListener('DOMContentLoaded', async () => {
  const me = await api('/api/admin/me');
  if (me.admin) showPanel();
  $('loginBtn').onclick = login;
  $('adminPass').onkeydown = (e) => { if (e.key === 'Enter') login(); };
});

async function login() {
  const j = await api('/api/admin/login', 'POST', { password: $('adminPass').value });
  if (j.ok) showPanel();
  else $('loginError').textContent = j.error || 'خطأ';
}

function showPanel() {
  $('loginView').style.display = 'none';
  $('panelView').style.display = '';
  bindPanel();
  loadStats();
  loadOrders();
  loadProducts();
  loadGovs();
  loadCoupons();
  loadReviews();
  loadRevCount();
  loadStorage();
  loadSettings();
  loadReport();
}

const SECTIONS = ['orders', 'products', 'govs', 'coupons', 'reviews', 'cleanup', 'reports', 'settings'];
const SECTION_TITLES = {
  orders: '📋 الطلبات', products: '👕 المنتجات', govs: '🗺️ المحافظات والشحن',
  coupons: '🎟️ الكوبونات', reviews: '⭐ التقييمات', cleanup: '🧹 التنظيف',
  reports: '📊 التقارير', settings: '⚙️ الإعدادات'
};
function showSection(name) {
  const home = !name || name === 'home';
  $('homeView').style.display = home ? '' : 'none';
  $('backBar').style.display = home ? 'none' : '';
  if (!home) $('pageTitle').textContent = SECTION_TITLES[name] || '';
  SECTIONS.forEach(n => $('tab-' + n).style.display = n === name ? '' : 'none');
  window.scrollTo({ top: 0 });
}

function setBadge(id, n) {
  const b = $(id);
  if (!b) return;
  n = Number(n) || 0;
  b.style.display = n > 0 ? '' : 'none';
  b.textContent = n > 99 ? '+99' : n;
}

function bindPanel() {
  document.querySelectorAll('.dash-card').forEach(c => c.onclick = () => showSection(c.dataset.tab));
  $('backHomeBtn').onclick = () => showSection('home');
  showSection('home');
  $('logoutBtn').onclick = async () => { await api('/api/admin/logout', 'POST'); location.reload(); };
  $('refreshOrders').onclick = () => loadOrders(orderPage);
  $('statusFilter').onchange = () => loadOrders(1);
  let searchT = null;
  $('orderSearch').oninput = () => { clearTimeout(searchT); searchT = setTimeout(() => loadOrders(1), 500); };
  $('delSelectedBtn').onclick = delSelected;
  $('bulkApplyBtn').onclick = bulkStatus;
  $('refreshReports').onclick = loadReport;
  $('csvBtn').onclick = exportCsv;
  $('printSlipBtn').onclick = printSlip;
  startNotify();
  $('pagePrev').onclick = () => loadOrders(orderPage - 1);
  $('pageNext').onclick = () => loadOrders(orderPage + 1);
  $('selAll').onchange = () => { document.querySelectorAll('.o-sel').forEach(x => x.checked = $('selAll').checked); updateSelCount(); };
  $('ordersBody').onchange = (e) => { if (e.target.classList && e.target.classList.contains('o-sel')) updateSelCount(); };
  $('cleanupBtn').onclick = runCleanup;
  $('modalClose').onclick = () => $('orderModal').classList.remove('show');
  $('orderModal').onclick = (e) => { if (e.target.id === 'orderModal') $('orderModal').classList.remove('show'); };
  $('addColorBtn').onclick = () => addColorRow();
  $('addSizeBtn').onclick = () => addSizeRow();
  $('saveProdBtn').onclick = saveProduct;
  $('cancelEditBtn').onclick = resetProdForm;
  $('addGovBtn').onclick = addGov;
  $('addCouponBtn').onclick = addCoupon;
  $('refreshReviews').onclick = () => { loadReviews(); loadRevCount(); };
  document.querySelectorAll('[data-revf]').forEach(b => b.onclick = () => { revFilter = b.dataset.revf; loadReviews(); });
  document.querySelectorAll('.saveSettingsBtn').forEach(b => b.onclick = saveSettings);
  $('changePwBtn').onclick = changePassword;
  $('logoFile').onchange = uploadLogo;
  $('logoRemoveBtn').onclick = removeLogo;
  $('themeResetBtn').onclick = async () => {
    $('sThemePrimary').value = '#ff7a00';
    $('sThemeDark').value = '#141419';
    await saveSettings();
  };
  buildContentFields();
}

function buildContentFields() {
  const ff = $('featFields'); ff.innerHTML = '';
  DEF_FEATURES.forEach((d, idx) => {
    const i = idx + 1;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h4 style="margin:10px 0 2px">مربع ${i}</h4>
      <div class="grid3">
        <label>الأيقونة<input id="ff${i}i" placeholder="${esc(d.i)}"></label>
        <label>العنوان<input id="ff${i}t" placeholder="${esc(d.t)}"></label>
        <label>الوصف<input id="ff${i}d" placeholder="${esc(d.d)}"></label>
      </div>`;
    ff.appendChild(wrap);
  });
  const tf = $('trustFields'); tf.innerHTML = '';
  DEF_TRUST.forEach((d, idx) => {
    const i = idx + 1;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h4 style="margin:10px 0 2px">مربع ${i}</h4>
      <div class="grid3">
        <label>الأيقونة<input id="tf${i}i" placeholder="${esc(d.i)}"></label>
        <label>العنوان<input id="tf${i}t" placeholder="${esc(d.t)}"></label>
        <label>الوصف<input id="tf${i}d" placeholder="${esc(d.d)}"></label>
      </div>`;
    tf.appendChild(wrap);
  });
}

// ---------- Stats & Orders ----------
async function loadStats() {
  const j = await api('/api/admin/stats');
  if (!j.ok) return;
  STATUS_AR = j.statusAr;
  $('stToday').textContent = j.today;
  $('stNew').textContent = j.byStatus.new || 0;
  setBadge('badgeOrders', j.byStatus.new);
  $('stTotal').textContent = j.total;
  $('stRevenue').textContent = Number(j.revenue).toLocaleString('en');
  const f = $('statusFilter');
  if (f.options.length <= 1) {
    Object.entries(STATUS_AR).forEach(([k, v]) => {
      const o = document.createElement('option');
      o.value = k; o.textContent = v;
      f.appendChild(o);
    });
  }
}

let orderPage = 1, orderPages = 1;
async function loadOrders(page = 1) {
  orderPage = Math.max(1, page);
  const st = $('statusFilter').value;
  const q = ($('orderSearch').value || '').trim();
  const j = await api('/api/admin/orders?page=' + orderPage + (st ? '&status=' + st : '') + (q ? '&q=' + encodeURIComponent(q) : ''));
  if (!j.ok) return;
  if (!j.orders.length && orderPage > 1) return loadOrders(orderPage - 1);
  STATUS_AR = j.statusAr;
  orderPage = j.page; orderPages = j.pages;
  $('pageInfo').textContent = `صفحة ${j.page} من ${j.pages} (الإجمالي: ${j.total})`;
  $('pagePrev').disabled = j.page <= 1;
  $('pageNext').disabled = j.page >= j.pages;
  $('selAll').checked = false;
  updateSelCount();
  const tb = $('ordersBody');
  tb.innerHTML = '';
  ORDERS_CACHE = j.orders;
  if (!j.orders.length) {
    tb.innerHTML = '<tr><td colspan="9" style="text-align:center;color:#999">مفيش طلبات هنا لسه</td></tr>';
    return;
  }
  j.orders.forEach(o => {
    const tr = document.createElement('tr');
    const items = (o.items && o.items.length ? o.items : [{ name: o.product_name, color: o.color, size: o.size, qty: o.qty }]);
    const itemsHtml = items.map(l => `${esc(l.name)}<br>🎨 ${esc(l.color)} | 📏 ${esc(l.size)} | × ${l.qty}`).join('<hr style="margin:4px 0;border:none;border-top:1px dashed #ddd">');
    const itemsTxt = items.map(l => `${l.name} (${l.color}/${l.size} ×${l.qty})`).join(' + ');
    const waText = encodeURIComponent(`أهلاً ${o.name}، معاك كايرو شيك 🦅 بخصوص طلبك رقم ${o.order_no} (${itemsTxt}) بإجمالي ${o.total} جنيه. نأكد الطلب؟`);
    const couponLine = o.coupon_code ? `<br><small>🎟 <b dir="ltr">${esc(o.coupon_code)}</b> (خصم ${o.discount})</small>` : '';
    tr.innerHTML = `
      <td class="no-l"><input type="checkbox" class="o-sel" data-id="${o.id}"></td>
      <td data-l="رقم الطلب"><b dir="ltr">${o.order_no}</b></td>
      <td data-l="التاريخ" style="white-space:nowrap">${fmtDT(o.created_at)}</td>
      <td data-l="العميل"><b>${esc(o.name)}</b><br><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></td>
      <td data-l="الطلب">${itemsHtml}</td>
      <td data-l="الإجمالي"><b>${o.total} ج</b><br><small class="muted">شحن: ${o.shipping}</small>${couponLine}</td>
      <td data-l="العنوان">${esc(o.governorate)}${o.area ? ' — ' + esc(o.area) : ''}<br><small>${esc(o.address)}</small>${o.notes ? `<br><small>📝 ${esc(o.notes)}</small>` : ''}</td>
      <td data-l="الحالة"><select class="status-select" data-id="${o.id}">
        ${Object.entries(STATUS_AR).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select></td>
      <td data-l="إجراءات" style="white-space:nowrap">
        <button class="btn-mini btn-edit" data-view="${o.id}">👁 عرض</button>
        <a class="btn-mini btn-wa" target="_blank" href="https://wa.me/2${o.phone}?text=${waText}">واتساب 💬</a>
        <button class="btn-mini btn-ok" data-copy="${o.id}" title="نسخ بيانات العميل والعنوان">📋 نسخ</button>
        <button class="btn-mini btn-del" data-del="${o.id}">حذف</button>
      </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('.status-select').forEach(s => s.onchange = async () => {
    await api('/api/admin/orders/' + s.dataset.id, 'PATCH', { status: s.value });
    loadStats();
  });
  tb.querySelectorAll('[data-view]').forEach(b => b.onclick = () => openOrder(Number(b.dataset.view)));
  tb.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
    const o = ORDERS_CACHE.find(x => x.id === Number(b.dataset.copy));
    if (!o) return;
    const items = (o.items && o.items.length ? o.items : [{ name: o.product_name, color: o.color, size: o.size, qty: o.qty }]);
    const txt = `طلب ${o.order_no}\nالاسم: ${o.name}\nالتليفون: ${o.phone}\nالعنوان: ${o.governorate}${o.area ? ' — ' + o.area : ''} — ${o.address}\nالطلب: ${items.map(l => `${l.name} (${l.color}/${l.size} ×${l.qty})`).join(' + ')}\nالإجمالي: ${o.total} جنيه (شحن ${o.shipping})`;
    try { await navigator.clipboard.writeText(txt); b.textContent = '✅ اتنسخ'; setTimeout(() => b.textContent = '📋 نسخ', 1500); }
    catch { alert('تعذر النسخ — انسخ يدوياً'); }
  });
  tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('تحذف الطلب ده نهائياً؟')) return;
    await api('/api/admin/orders/' + b.dataset.del, 'DELETE');
    loadOrders(orderPage); loadStats();
  });
}

function prodImage(pid, color) {
  const p = ADMIN_PRODUCTS.find(x => x.id === pid);
  if (!p || !p.colors || !p.colors.length) return '/images/logo.jpg';
  const c = p.colors.find(c => c.name === color) || p.colors[0];
  return (c && c.image) || '/images/logo.jpg';
}

function openOrder(id) {
  const o = ORDERS_CACHE.find(x => x.id === id);
  if (!o) return;
  PRINT_ORDER = o;
  $('mOrderNo').textContent = o.order_no;
  const items = (o.items && o.items.length ? o.items : [{ pid: o.product_id, name: o.product_name, color: o.color, size: o.size, qty: o.qty, unit: o.unit_price }]);
  const itemsHtml = items.map(l => `
    <div class="d-item">
      <img src="${prodImage(l.pid, l.color)}" alt="" loading="lazy" decoding="async">
      <div class="grow"><b>${esc(l.name)}</b><br><small>🎨 ${esc(l.color)} | 📏 ${esc(l.size)} | × ${l.qty}</small></div>
      <b>${(Number(l.unit) || 0) * l.qty} ج</b>
    </div>`).join('');
  $('modalBody').innerHTML = `
    <div class="d-row"><b>📅 التاريخ</b><span style="text-align:left">${fmtDT(o.created_at)}</span></div>
    <div class="d-row"><b>📌 الحالة</b><span>${esc(STATUS_AR[o.status] || o.status)}</span></div>
    <div class="d-row"><b>👤 العميل</b><span>${esc(o.name)}</span></div>
    <div class="d-row"><b>📞 الموبايل</b><span><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></span></div>
    <div class="d-row"><b>📍 المحافظة</b><span>${esc(o.governorate)}${o.area ? ' — ' + esc(o.area) : ''}</span></div>
    <div class="d-row"><b>🏠 العنوان</b><span>${esc(o.address)}</span></div>
    ${o.notes ? `<div class="d-row"><b>📝 ملاحظات</b><span>${esc(o.notes)}</span></div>` : ''}
    <h4 style="margin:12px 0 4px">🛍 المنتجات (${items.reduce((a, l) => a + (Number(l.qty) || 0), 0)} قطع)</h4>
    ${itemsHtml}
    <div class="d-row"><b>🚚 الشحن</b><span>${o.shipping} ج</span></div>
    ${o.coupon_code ? `<div class="d-row"><b>🎟 الكوبون</b><span><b dir="ltr">${esc(o.coupon_code)}</b> (خصم ${o.discount} ج)</span></div>` : ''}
    <div class="d-row" style="font-size:16px;border:none"><b>💰 الإجمالي</b><span><b>${o.total} جنيه</b></span></div>`;
  $('orderModal').classList.add('show');
}

async function exportCsv() {
  const btn = $('csvBtn');
  btn.disabled = true;
  const old = btn.textContent;
  btn.textContent = '⏳ جاري التصدير...';
  try {
    const st = $('statusFilter').value;
    let page = 1, pages = 1;
    const all = [];
    do {
      const j = await api('/api/admin/orders?page=' + page + (st ? '&status=' + st : ''));
      if (!j.ok) throw new Error(j.error || 'خطأ');
      pages = j.pages || 1;
      (j.orders || []).forEach(o => all.push(o));
      page++;
    } while (page <= pages);
    if (!all.length) { alert('مفيش طلبات للتصدير'); return; }
    const q = (v) => '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"';
    const head = ['رقم الطلب', 'التاريخ', 'الاسم', 'الموبايل', 'المحافظة', 'المنطقة', 'العنوان', 'المنتجات', 'الإجمالي', 'الشحن', 'الكوبون', 'الحالة'];
    const rows = all.map(o => {
      const items = (o.items && o.items.length ? o.items : [{ name: o.product_name, color: o.color, size: o.size, qty: o.qty }]);
      const txt = items.map(l => `${l.name} (${l.color}/${l.size} ×${l.qty})`).join(' + ');
      return [o.order_no, String(o.created_at || '').slice(0, 16).replace('T', ' '), o.name, o.phone, o.governorate, o.area, o.address, txt, o.total, o.shipping, o.coupon_code || '', STATUS_AR[o.status] || o.status].map(q).join(',');
    });
    const blob = new Blob(['\ufeff' + head.map(q).join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'cairo-chic-orders.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (e) { alert(e.message); }
  btn.disabled = false;
  btn.textContent = old;
}

function printSlip() {
  const o = PRINT_ORDER;
  if (!o) return;
  const store = ($('sNameAr') && $('sNameAr').value) || 'كايرو شيك';
  const items = (o.items && o.items.length ? o.items : [{ name: o.product_name, color: o.color, size: o.size, qty: o.qty, unit: o.unit_price }]);
  const rows = items.map(l => `<tr><td>${esc(l.name)}<br><small>${esc(l.color)} / ${esc(l.size)}</small></td><td>${l.qty}</td><td>${(Number(l.unit) || 0) * l.qty} ج</td></tr>`).join('');
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) { alert('المتصفح منع النافذة — اسمح بالنوافذ المنبثقة وحاول تاني'); return; }
  w.document.write(`<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بوليصة ${esc(o.order_no)}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;padding:18px;color:#111}h2{margin:0 0 2px}table{width:100%;border-collapse:collapse;margin:10px 0}td,th{border:1px solid #999;padding:6px;text-align:right;font-size:14px}.tot{font-size:18px;font-weight:bold}.c{text-align:center}.mut{color:#555;font-size:12px}</style>
</head><body>
<div class="c"><h2>🦅 ${esc(store)}</h2><div class="mut">بوليصة شحن</div>
<h3 dir="ltr">${esc(o.order_no)}</h3><div>${fmtDT(o.created_at)}</div></div><hr>
<b>👤 ${esc(o.name)}</b> — <span dir="ltr">${esc(o.phone)}</span><br>
📍 ${esc(o.governorate)}${o.area ? ' — ' + esc(o.area) : ''}<br>🏠 ${esc(o.address)}
${o.notes ? '<br>📝 ' + esc(o.notes) : ''}
<table><tr><th>المنتج</th><th>عدد</th><th>سعر</th></tr>${rows}</table>
<div>🚚 الشحن: ${o.shipping} ج${o.coupon_code ? ` &nbsp; 🎟 ${esc(o.coupon_code)} (خصم ${o.discount} ج)` : ''}</div>
<div class="tot">💰 الإجمالي: ${o.total} جنيه</div>
<hr><div class="c mut">شكراً لثقتكم 🙏</div>
<script>window.onload=()=>{window.print()}<\/script></body></html>`);
  w.document.close();
  w.focus();
}

let lastTotal = null, muted = localStorage.getItem('cc_mute') === '1', titleTimer = null;
const origTitle = document.title;
function beep() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880; o.type = 'sine';
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.start(); o.stop(ctx.currentTime + 0.55);
  } catch (e) { /* needs a click first */ }
}
function flashTitle(n) {
  clearInterval(titleTimer);
  let on = false;
  titleTimer = setInterval(() => { document.title = on ? origTitle : `(${n}) طلب جديد! 🛎`; on = !on; }, 900);
  setTimeout(() => { clearInterval(titleTimer); document.title = origTitle; }, 30000);
}
async function pollOrders() {
  const j = await api('/api/admin/stats');
  if (!j.ok) return;
  if (lastTotal === null) { lastTotal = j.total; return; }
  if (Number(j.total) > Number(lastTotal)) {
    const n = Number(j.total) - Number(lastTotal);
    lastTotal = j.total;
    if (!muted) beep();
    flashTitle(n);
    loadOrders(1);
    loadStats();
  } else lastTotal = j.total;
}
function startNotify() {
  lastTotal = null;
  setInterval(pollOrders, 30000);
  const mb = $('muteBtn');
  const paint = () => { mb.textContent = muted ? '🔕 صامت' : '🔔 تنبيه'; };
  mb.onclick = () => { muted = !muted; localStorage.setItem('cc_mute', muted ? '1' : '0'); paint(); };
  paint();
}

async function delSelected() {
  const ids = [...document.querySelectorAll('.o-sel:checked')].map(x => Number(x.dataset.id));
  if (!ids.length) { alert('حدد طلب واحد على الأقل الأول ✅'); return; }
  if (!confirm(`تحذف ${ids.length} طلب نهائياً؟`)) return;
  const j = await api('/api/admin/orders', 'DELETE', { ids });
  if (!j.ok) { alert(j.error || 'خطأ'); return; }
  loadOrders(orderPage); loadStats();
}

function updateSelCount() {
  const n = document.querySelectorAll('.o-sel:checked').length;
  $('selCount').textContent = n;
  $('selCount2').textContent = n;
  $('bulkBar').style.display = n ? '' : 'none';
  const bs = $('bulkStatus');
  if (!bs.options.length) Object.entries(STATUS_AR).forEach(([k, v]) => {
    const o = document.createElement('option'); o.value = k; o.textContent = v; bs.appendChild(o);
  });
}

async function bulkStatus() {
  const ids = [...document.querySelectorAll('.o-sel:checked')].map(x => Number(x.dataset.id));
  if (!ids.length) return;
  const st = $('bulkStatus').value;
  if (!confirm(`تغيّر حالة ${ids.length} طلب إلى "${STATUS_AR[st]}"؟`)) return;
  for (const id of ids) await api('/api/admin/orders/' + id, 'PATCH', { status: st });
  loadOrders(orderPage); loadStats();
}

// ---------- Storage & cleanup ----------
async function loadStorage() {
  const j = await api('/api/admin/storage');
  if (!j.ok) return;
  const s = j.stats;
  $('stProducts').textContent = s.products;
  $('stOrders').textContent = s.orders;
  $('stImages').textContent = `${s.images.count} (${s.images.kb} KB)`;
  $('stSiteImages').textContent = `${s.siteImages.count} (${s.siteImages.kb} KB)`;
  $('stReviews').textContent = s.reviews;
  $('stOrphans').textContent = s.orphans.count ? `${s.orphans.count} صورة (~${s.orphans.kb} KB) 🗑` : 'مفيش — كله نضيف ✨';
  $('cleanupBtn').disabled = !s.orphans.count;
  setBadge('badgeOrphans', s.orphans.count);
  $('cleanupMsg').textContent = '';
  $('cleanupMsg').style.color = '';
  // quota meter (Neon free = 1 GB)
  const QUOTA_KB = 1024 * 1024;
  const usedKB = s.dbKB || 0;
  const pct = Math.min(100, usedKB / QUOTA_KB * 100);
  const fmtMB = (kb) => kb >= 1024 ? (kb / 1024).toFixed(1) + ' ميجا' : kb + ' كيلو';
  $('quotaFill').style.width = Math.max(pct, 0.5) + '%';
  $('quotaFill').className = 'quota-fill' + (pct >= 80 ? ' danger' : pct >= 50 ? ' warn' : '');
  $('quotaUsed').textContent = `مستخدم: ${fmtMB(usedKB)} من 1 جيجا`;
  $('quotaPct').textContent = pct < 0.1 ? 'أقل من 0.1%' : pct.toFixed(1) + '%';
  $('quotaWarn').style.display = pct >= 80 ? '' : 'none';
  $('quotaNote').textContent = j.dbKind === 'neon'
    ? 'الخطة المجانية = 1 جيجا. العدّاد ده قراءة فقط ومش بيستهلك أي مساحة.'
    : 'سيرفر محلي (SQLite) — حجم ملف قاعدة البيانات على جهازك. على الموقع الحقيقي الكوتا = 1 جيجا مجانًا.';
}

async function runCleanup() {
  if (!confirm('تمسح الصور اليتيمة (غير مستخدمة في أي منتج) نهائياً؟')) return;
  const j = await api('/api/admin/cleanup-images', 'DELETE');
  if (!j.ok) { alert(j.error || 'خطأ'); return; }
  $('cleanupMsg').textContent = `تم مسح ${j.deleted} صورة وتوفير ~${j.freedKB} KB ✅`;
  $('cleanupMsg').style.color = '#0d9b4d';
  loadStorage();
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Downscale huge phone photos in the browser before upload (JPEG)
function resizeImage(file, max = 1200) {
  return new Promise((resolve) => {
    try {
      createImageBitmap(file).then((bmp) => {
        const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(bmp.width * scale));
        cv.height = Math.max(1, Math.round(bmp.height * scale));
        cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
        cv.toBlob((blob) => resolve(blob || file), 'image/jpeg', 0.82);
      }).catch(() => resolve(file));
    } catch { resolve(file); }
  });
}

// ---------- Products ----------
function addColorRow(name = '', image = '') {
  const div = document.createElement('div');
  div.className = 'color-row';
  div.innerHTML = `
    <input placeholder="اسم اللون" value="${esc(name)}" class="c-name">
    <input placeholder="رابط الصورة" value="${esc(image)}" class="c-img" dir="ltr">
    <img src="${esc(image) || '/images/logo.jpg'}" loading="lazy" decoding="async">
    <span><label class="btn-mini btn-edit" style="cursor:pointer">📤 رفع<input type="file" accept="image/*" class="c-file" style="display:none"></label>
    <button class="btn-mini btn-del c-remove" type="button">✕</button></span>`;
  const imgPrev = div.querySelector('img');
  div.querySelector('.c-img').oninput = (e) => { imgPrev.src = e.target.value || '/images/logo.jpg'; };
  div.querySelector('.c-remove').onclick = () => div.remove();
  div.querySelector('.c-file').onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('image', await resizeImage(f), f.name || 'photo.jpg');
    const r = await fetch('/api/admin/upload', { method: 'POST', body: fd });
    const j = await r.json();
    if (j.ok) { div.querySelector('.c-img').value = j.url; imgPrev.src = j.url; }
    else alert(j.error || 'فشل الرفع');
  };
  $('colorRows').appendChild(div);
}

function addSizeRow(size = '', from = '', to = '') {
  const div = document.createElement('div');
  div.className = 'size-row';
  div.innerHTML = `
    <input placeholder="المقاس (L)" value="${esc(size)}" class="s-size">
    <input placeholder="الوزن من (كجم)" value="${esc(from)}" class="s-from" type="number" min="0" inputmode="numeric">
    <input placeholder="الوزن إلى (كجم)" value="${esc(to)}" class="s-to" type="number" min="0" inputmode="numeric">
    <button class="btn-mini btn-del s-remove" type="button">✕</button>`;
  div.querySelector('.s-remove').onclick = () => div.remove();
  $('sizeRows').appendChild(div);
}

function resetProdForm() {
  $('pId').value = '';
  $('pName').value = ''; $('pDesc').value = ''; $('pVideo').value = ''; $('pPrice').value = '';
  $('pOld').value = ''; $('pSizes').value = ''; $('pStock').value = '100';
  $('pActive').checked = true;
  $('pFeatured').checked = false;
  $('colorRows').innerHTML = '';
  addColorRow();
  $('sizeRows').innerHTML = '';
  addSizeRow();
  $('prodFormTitle').textContent = '➕ إضافة منتج جديد';
  $('cancelEditBtn').style.display = 'none';
  $('prodError').textContent = '';
}

async function saveProduct() {
  const colors = [...$('colorRows').querySelectorAll('.color-row')].map(r => ({
    name: r.querySelector('.c-name').value.trim(),
    image: r.querySelector('.c-img').value.trim()
  })).filter(c => c.name);
  const size_guide = [...$('sizeRows').querySelectorAll('.size-row')].map(r => ({
    size: r.querySelector('.s-size').value.trim(),
    from: Number(r.querySelector('.s-from').value || 0),
    to: Number(r.querySelector('.s-to').value || 0)
  })).filter(r => r.size && r.to > 0);
  const body = {
    name: $('pName').value.trim(),
    description: $('pDesc').value.trim(),
    video: $('pVideo').value.trim(),
    price: Number($('pPrice').value),
    old_price: Number($('pOld').value || 0),
    sizes: $('pSizes').value.split(',').map(s => s.trim()).filter(Boolean),
    size_guide,
    stock: Number($('pStock').value || 0),
    active: $('pActive').checked,
    featured: $('pFeatured').checked,
    colors
  };
  const id = $('pId').value;
  const j = await api(id ? '/api/admin/products/' + id : '/api/admin/products', id ? 'PUT' : 'POST', body);
  if (!j.ok) { $('prodError').textContent = j.error; return; }
  resetProdForm();
  loadProducts();
  alert('تم الحفظ بنجاح ✅');
}

// ---------- Reports (client-side aggregation, zero storage) ----------
async function loadReport() {
  const j = await api('/api/admin/report');
  if (!j.ok) return;
  const orders = j.orders || [];
  STATUS_AR = j.statusAr || STATUS_AR;
  const live = orders.filter(o => o.status !== 'cancelled');
  const fmt = (n) => Number(n).toLocaleString('en');
  // summary
  const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const weekRev = live.filter(o => o.day >= weekAgo).reduce((a, o) => a + o.total, 0);
  $('repWeek').textContent = fmt(weekRev) + ' ج';
  $('repAvg').textContent = fmt(live.length ? Math.round(live.reduce((a, o) => a + o.total, 0) / live.length) : 0) + ' ج';
  const doneStatuses = ['delivered', 'shipped'];
  $('repDone').textContent = (orders.length ? Math.round(orders.filter(o => doneStatuses.includes(o.status)).length / orders.length * 100) : 0) + '%';
  $('repCancel').textContent = (orders.length ? Math.round(orders.filter(o => o.status === 'cancelled').length / orders.length * 100) : 0) + '%';
  // daily revenue 14 days
  const days = [];
  for (let i = 13; i >= 0; i--) days.push(new Date(Date.now() - i * 864e5).toISOString().slice(0, 10));
  const byDay = {};
  live.forEach(o => { byDay[o.day] = (byDay[o.day] || 0) + o.total; });
  const maxD = Math.max(1, ...days.map(d => byDay[d] || 0));
  $('repDaily').innerHTML = days.map(d => {
    const v = byDay[d] || 0;
    return `<div class="bar-col" title="${d}: ${fmt(v)} جنيه"><b>${v ? fmt(v) : ''}</b><div class="bar${v ? '' : ' zero'}" style="height:${Math.max(v ? v / maxD * 100 : 2, 2)}%"></div><small>${d.slice(5)}</small></div>`;
  }).join('');
  // by status
  const bySt = {};
  orders.forEach(o => { bySt[o.status] = (bySt[o.status] || 0) + 1; });
  const maxS = Math.max(1, ...Object.values(bySt));
  const stColor = (k) => k === 'cancelled' ? 'red' : (doneStatuses.includes(k) ? 'green' : k === 'new' ? 'blue' : '');
  $('repStatus').innerHTML = Object.keys(STATUS_AR).filter(k => bySt[k]).map(k =>
    `<div class="hbar-row"><span>${STATUS_AR[k]}</span><div class="hbar-track"><div class="hbar-fill ${stColor(k)}" style="width:${bySt[k] / maxS * 100}%"></div></div><b>${bySt[k]}</b></div>`
  ).join('') || '<p class="hint">مفيش طلبات لسه</p>';
  // by governorate
  const byG = {};
  live.forEach(o => { byG[o.gov] = (byG[o.gov] || 0) + 1; });
  const govs = Object.entries(byG).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxG = Math.max(1, ...govs.map(g => g[1]));
  $('repGovs').innerHTML = govs.map(([g, n]) =>
    `<div class="hbar-row"><span>${esc(g)}</span><div class="hbar-track"><div class="hbar-fill blue" style="width:${n / maxG * 100}%"></div></div><b>${n}</b></div>`
  ).join('') || '<p class="hint">مفيش طلبات لسه</p>';
  // top products
  const byP = {};
  live.forEach(o => o.items.forEach(l => { byP[l.name] = (byP[l.name] || 0) + l.qty; }));
  const tops = Object.entries(byP).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxP = Math.max(1, ...tops.map(t => t[1]));
  $('repTop').innerHTML = tops.map(([n, q], i) =>
    `<div class="hbar-row"><span>${i < 3 ? ['🥇', '🥈', '🥉'][i] + ' ' : ''}${esc(n)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${q / maxP * 100}%"></div></div><b>${q} قطعة</b></div>`
  ).join('') || '<p class="hint">مفيش مبيعات لسه</p>';
}

async function loadProducts() {
  const j = await api('/api/admin/products');
  if (!j.ok) return;
  ADMIN_PRODUCTS = j.products;
  const list = $('productsList');
  list.innerHTML = '';
  j.products.forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const div = document.createElement('div');
    const low = Number(p.stock) <= 5;
    div.className = 'prod-item' + (low ? ' low-stock' : '');
    div.innerHTML = `
      <img src="${img}" loading="lazy" decoding="async">
      <div class="grow"><b>${esc(p.name)}</b> ${low ? `<span class=\"badge-low\">⚠️ مخزون (${p.stock})</span>` : ``} ${p.featured ? '<span class="badge-feat">⭐ مميز</span>' : ''} ${p.video ? '<span class="badge-feat">🎬 فيديو</span>' : ''} ${p.active ? '' : '<span class="badge-off">مخفي</span>'}
        <div class="muted" style="font-size:13px">${p.price} ج ${p.old_price > p.price ? `(قبل: ${p.old_price})` : ''} | 🎨 ${p.colors.length} ألوان | 📏 ${p.sizes.join('، ')}</div>
      </div>
      <button class="btn-mini btn-ok f-feat" title="منتج مميز (يظهر أول واحد)">⭐</button>
      <button class="btn-mini btn-edit">تعديل ✏️</button>
      <button class="btn-mini btn-del">حذف 🗑</button>`;
    div.querySelector('.btn-edit').onclick = () => {
      $('pId').value = p.id;
      $('pName').value = p.name; $('pDesc').value = p.description || ''; $('pVideo').value = p.video || '';
      $('pPrice').value = p.price; $('pOld').value = p.old_price || '';
      $('pSizes').value = p.sizes.join(',');
      $('pStock').value = p.stock; $('pActive').checked = !!p.active; $('pFeatured').checked = !!p.featured;
      $('colorRows').innerHTML = '';
      p.colors.forEach(c => addColorRow(c.name, c.image));
      if (!p.colors.length) addColorRow();
      $('sizeRows').innerHTML = '';
      (p.size_guide || []).forEach(r => addSizeRow(r.size, r.from, r.to));
      if (!(p.size_guide || []).length) addSizeRow();
      $('prodFormTitle').textContent = '✏️ تعديل: ' + p.name;
      $('cancelEditBtn').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    div.querySelector('.f-feat').onclick = async () => {
      await api('/api/admin/products/' + p.id, 'PUT', {
        name: p.name, description: p.description || '', video: p.video || '', price: p.price, old_price: p.old_price || 0,
        sizes: p.sizes, stock: p.stock, active: !!p.active, featured: !p.featured, colors: p.colors,
        size_guide: p.size_guide || []
      });
      loadProducts();
    };
    div.querySelector('.btn-del').onclick = async () => {
      if (!confirm(`تحذف "${p.name}" نهائياً؟`)) return;
      await api('/api/admin/products/' + p.id, 'DELETE');
      loadProducts();
    };
    list.appendChild(div);
  });
  setBadge('badgeStock', document.querySelectorAll('#productsList .low-stock').length);
  if ($('colorRows').children.length === 0) addColorRow();
  if ($('sizeRows').children.length === 0) addSizeRow();
}

// ---------- Governorates ----------
async function loadGovs() {
  const j = await api('/api/admin/governorates');
  if (!j.ok) return;
  $('govCount').textContent = j.governorates.length;
  const tb = $('govsBody');
  tb.innerHTML = '';
  j.governorates.forEach(g => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td data-l="المحافظة"><b>${esc(g.name)}</b></td>
      <td data-l="سعر الشحن"><input type="number" min="0" value="${g.shipping}" class="g-ship" style="max-width:120px"></td>
      <td><button class="btn-mini btn-ok g-save">حفظ 💾</button></td>
      <td><button class="btn-mini btn-del g-del">حذف 🗑</button></td>`;
    tr.querySelector('.g-save').onclick = async () => {
      const ship = tr.querySelector('.g-ship').value;
      const r = await api('/api/admin/governorates/' + encodeURIComponent(g.name), 'PUT', { shipping: Number(ship) });
      if (!r.ok) alert(r.error || 'خطأ');
      else { loadGovs(); }
    };
    tr.querySelector('.g-del').onclick = async () => {
      if (!confirm(`تحذف محافظة "${g.name}"؟ العملاء مش هيقدروا يختاروها بعد كده.`)) return;
      await api('/api/admin/governorates/' + encodeURIComponent(g.name), 'DELETE');
      loadGovs();
    };
    tb.appendChild(tr);
  });
}

async function addGov() {
  const j = await api('/api/admin/governorates', 'POST', {
    name: $('gName').value.trim(),
    shipping: Number($('gShip').value)
  });
  if (!j.ok) { $('govError').textContent = j.error; return; }
  $('govError').textContent = '';
  $('gName').value = ''; $('gShip').value = '';
  loadGovs();
}

// ---------- Coupons ----------
function couponDesc(c) {
  const d = c.kind === 'pct' ? `خصم ${c.value}%` : `خصم ${c.value} جنيه`;
  return c.min_order > 0 ? `${d} (أقل طلب: ${c.min_order} ج)` : d;
}

async function loadCoupons() {
  const j = await api('/api/admin/coupons');
  if (!j.ok) return;
  const list = $('couponsList');
  list.innerHTML = '';
  if (!j.coupons.length) {
    list.innerHTML = '<p class="hint">مفيش كوبونات لسه — ضيف أول كوبون من فوق 🎟️</p>';
    return;
  }
  j.coupons.forEach(c => {
    const div = document.createElement('div');
    div.className = 'prod-item';
    div.innerHTML = `
      <div class="grow"><b dir="ltr" style="font-size:18px">${esc(c.code)}</b>
        ${c.active ? '' : '<span class="badge-off">موقوف</span>'}
        <div class="muted" style="font-size:13px">${esc(couponDesc(c))}</div>
      </div>
      <button class="btn-mini ${c.active ? 'btn-del' : 'btn-ok'} c-toggle">${c.active ? 'إيقاف ⏸' : 'تشغيل ▶'}</button>
      <button class="btn-mini btn-del c-del">حذف 🗑</button>`;
    div.querySelector('.c-toggle').onclick = async () => {
      await api('/api/admin/coupons/' + c.id, 'PUT', {
        code: c.code, kind: c.kind, value: c.value, min_order: c.min_order, active: !c.active
      });
      loadCoupons();
    };
    div.querySelector('.c-del').onclick = async () => {
      if (!confirm(`تحذف كوبون "${c.code}"؟`)) return;
      await api('/api/admin/coupons/' + c.id, 'DELETE');
      loadCoupons();
    };
    list.appendChild(div);
  });
}

async function addCoupon() {
  const j = await api('/api/admin/coupons', 'POST', {
    code: $('cCode').value,
    kind: $('cKind').value,
    value: Number($('cValue').value),
    min_order: Number($('cMin').value || 0),
    active: $('cActive').checked
  });
  if (!j.ok) { $('couponError').textContent = j.error; return; }
  $('couponError').textContent = '';
  $('cCode').value = ''; $('cValue').value = ''; $('cMin').value = '';
  $('cActive').checked = true;
  loadCoupons();
}

// ---------- Reviews ----------
function starStr(n) {
  n = Math.max(1, Math.min(5, Math.round(Number(n) || 5)));
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

async function loadRevCount() {
  const j = await api('/api/admin/reviews?filter=pending');
  if (!j.ok) return;
  $('revPendCount').textContent = j.reviews.length;
  setBadge('badgeReviews', j.reviews.length);
}

async function loadReviews() {
  const j = await api('/api/admin/reviews?filter=' + revFilter);
  if (!j.ok) return;
  const list = $('reviewsList');
  list.innerHTML = '';
  if (!j.reviews.length) {
    list.innerHTML = `<p class="hint">${revFilter === 'pending' ? 'مفيش تقييمات مستنية — كله تمام ✅' : 'مفيش تقييمات منشورة لسه'}</p>`;
    return;
  }
  j.reviews.forEach(r => {
    const div = document.createElement('div');
    div.className = 'rev-card';
    div.innerHTML = `
      <div class="stars">${starStr(r.rating)}</div>
      <p>"${esc(r.comment)}"</p>
      <div class="meta">— ${esc(r.name)} | 🛍 ${esc(r.product_name || 'منتج محذوف')} | ${fmtDT(r.created_at).replace('<br>', ' ')}</div>
      <div style="margin-top:8px">
        ${revFilter === 'pending' ? '<button class="btn-mini btn-ok r-ok">نشر ✅</button>' : '<button class="btn-mini btn-edit r-hide">إخفاء 🙈</button>'}
        <button class="btn-mini btn-del r-del">حذف 🗑</button>
      </div>`;
    const okBtn = div.querySelector('.r-ok');
    if (okBtn) okBtn.onclick = async () => {
      await api('/api/admin/reviews/' + r.id, 'PATCH', { approved: true });
      loadReviews(); loadRevCount();
    };
    const hideBtn = div.querySelector('.r-hide');
    if (hideBtn) hideBtn.onclick = async () => {
      await api('/api/admin/reviews/' + r.id, 'PATCH', { approved: false });
      loadReviews(); loadRevCount();
    };
    div.querySelector('.r-del').onclick = async () => {
      if (!confirm('تحذف التقييم ده نهائياً؟')) return;
      await api('/api/admin/reviews/' + r.id, 'DELETE');
      loadReviews(); loadRevCount();
    };
    list.appendChild(div);
  });
}

// ---------- Settings ----------
async function loadSettings() {
  const j = await api('/api/admin/settings');
  if (!j.ok) return;
  const s = j.settings;
  Object.entries(FIELD_MAP).forEach(([id, key]) => {
    const el = $(id);
    if (el) el.value = s[key] || '';
  });
  if (!s.theme_primary) $('sThemePrimary').value = '#ff7a00';
  if (!s.theme_dark) $('sThemeDark').value = '#141419';
  $('sDealEnabled').checked = s.deal_enabled === '1';
  $('sMaintEnabled').checked = s.maint_enabled === '1';
  Object.entries(VIS_MAP).forEach(([id, key]) => { $(id).checked = s[key] !== '0'; });
  for (let i = 1; i <= 4; i++) {
    $('ff' + i + 'i').value = s['f' + i + 'i'] || '';
    $('ff' + i + 't').value = s['f' + i + 't'] || '';
    $('ff' + i + 'd').value = s['f' + i + 'd'] || '';
    $('tf' + i + 'i').value = s['t' + i + 'i'] || '';
    $('tf' + i + 't').value = s['t' + i + 't'] || '';
    $('tf' + i + 'd').value = s['t' + i + 'd'] || '';
  }
  $('logoPrev').src = s.logo_url || '/images/logo.jpg';
}

async function saveSettings() {
  const body = {};
  Object.entries(FIELD_MAP).forEach(([id, key]) => {
    const el = $(id);
    if (el) body[key] = el.value;
  });
  // empty color = default theme (don't force a value)
  body.deal_enabled = $('sDealEnabled').checked ? '1' : '';
  body.maint_enabled = $('sMaintEnabled').checked ? '1' : '';
  Object.entries(VIS_MAP).forEach(([id, key]) => { body[key] = $(id).checked ? '1' : '0'; });
  for (let i = 1; i <= 4; i++) {
    body['f' + i + 'i'] = $('ff' + i + 'i').value;
    body['f' + i + 't'] = $('ff' + i + 't').value;
    body['f' + i + 'd'] = $('ff' + i + 'd').value;
    body['t' + i + 'i'] = $('tf' + i + 'i').value;
    body['t' + i + 't'] = $('tf' + i + 't').value;
    body['t' + i + 'd'] = $('tf' + i + 'd').value;
  }
  const j = await api('/api/admin/settings', 'PUT', body);
  const msg = j.ok ? 'تم الحفظ ✅' : (j.error || 'خطأ');
  ['setError', 'setError2', 'setError3'].forEach(id => { const e = $(id); if (e) e.textContent = msg; });
  if (j.ok) setTimeout(() => ['setError', 'setError2', 'setError3'].forEach(id => { const e = $(id); if (e) e.textContent = ''; }), 2500);
}

async function uploadLogo() {
  const f = $('logoFile').files[0];
  if (!f) return;
  const fd = new FormData();
  fd.append('key', 'logo');
  fd.append('image', await resizeImage(f, 500), f.name || 'logo.jpg');
  const r = await fetch('/api/admin/site-image', { method: 'POST', body: fd });
  const j = await r.json();
  if (j.ok) { $('logoPrev').src = j.url; alert('تم تحديث اللوجو ✅'); }
  else alert(j.error || 'فشل الرفع');
  $('logoFile').value = '';
}

async function removeLogo() {
  if (!confirm('ترجع للوجو الافتراضي؟')) return;
  const r = await fetch('/api/admin/site-image/logo', { method: 'DELETE' });
  const j = await r.json();
  if (j.ok) $('logoPrev').src = '/images/logo.jpg';
}

async function changePassword() {
  const j = await api('/api/admin/password', 'POST', { current: $('pwCur').value, next: $('pwNew').value });
  $('pwError').textContent = j.ok ? 'تم تغيير الباسورد ✅' : (j.error || 'خطأ');
  if (j.ok) { $('pwCur').value = ''; $('pwNew').value = ''; }
}
