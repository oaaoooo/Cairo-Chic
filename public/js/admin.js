// ================= CAIRO CHIC - Admin =================
const $ = (id) => document.getElementById(id);
let STATUS_AR = {};
let revFilter = 'pending';

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
  sWhatsapp: 'whatsapp', sPixel: 'tiktok_pixel',
  sFeaturesTitle: 'features_title', sReviewsTitle: 'reviews_title', sHowTitle: 'how_title',
  sFaqTitle: 'faq_title', sMoreTitle: 'more_title',
  sFooterText: 'footer_text', sStockLine: 'stock_line', sSizeHint: 'size_hint', sCtaText: 'cta_text',
  sThemePrimary: 'theme_primary', sThemeDark: 'theme_dark',
  sDealTitle: 'deal_title', sDealSub: 'deal_sub', sDealEndsAt: 'deal_ends_at'
};

const VIS_MAP = {
  vReviews: 'show_reviews', vCoupon: 'show_coupon', vFeatures: 'show_features',
  vTrust: 'show_trust', vHow: 'show_how', vFaq: 'show_faq',
  vCountdown: 'show_countdown', vAnnounce: 'show_announce', vWa: 'show_wa'
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
}

function bindPanel() {
  const tabs = ['orders', 'products', 'govs', 'coupons', 'reviews', 'cleanup', 'settings'];
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    tabs.forEach(n => $('tab-' + n).style.display = n === t.dataset.tab ? '' : 'none');
  });
  $('logoutBtn').onclick = async () => { await api('/api/admin/logout', 'POST'); location.reload(); };
  $('refreshOrders').onclick = () => loadOrders(orderPage);
  $('statusFilter').onchange = () => loadOrders(1);
  $('delSelectedBtn').onclick = delSelected;
  $('pagePrev').onclick = () => loadOrders(orderPage - 1);
  $('pageNext').onclick = () => loadOrders(orderPage + 1);
  $('selAll').onchange = () => { document.querySelectorAll('.o-sel').forEach(x => x.checked = $('selAll').checked); updateSelCount(); };
  $('ordersBody').onchange = (e) => { if (e.target.classList && e.target.classList.contains('o-sel')) updateSelCount(); };
  $('cleanupBtn').onclick = runCleanup;
  $('addColorBtn').onclick = () => addColorRow();
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
  const j = await api('/api/admin/orders?page=' + orderPage + (st ? '&status=' + st : ''));
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
      <td><input type="checkbox" class="o-sel" data-id="${o.id}"></td>
      <td><b dir="ltr">${o.order_no}</b></td>
      <td style="white-space:nowrap">${(o.created_at || '').slice(0, 16).replace('T', ' ')}</td>
      <td><b>${esc(o.name)}</b><br><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></td>
      <td>${itemsHtml}</td>
      <td><b>${o.total} ج</b><br><small class="muted">شحن: ${o.shipping}</small>${couponLine}</td>
      <td>${esc(o.governorate)}<br><small>${esc(o.address)}</small>${o.notes ? `<br><small>📝 ${esc(o.notes)}</small>` : ''}</td>
      <td><select class="status-select" data-id="${o.id}">
        ${Object.entries(STATUS_AR).map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v}</option>`).join('')}
      </select></td>
      <td style="white-space:nowrap">
        <a class="btn-mini btn-wa" target="_blank" href="https://wa.me/2${o.phone}?text=${waText}">واتساب 💬</a>
        <button class="btn-mini btn-del" data-del="${o.id}">حذف</button>
      </td>`;
    tb.appendChild(tr);
  });
  tb.querySelectorAll('.status-select').forEach(s => s.onchange = async () => {
    await api('/api/admin/orders/' + s.dataset.id, 'PATCH', { status: s.value });
    loadStats();
  });
  tb.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('تحذف الطلب ده نهائياً؟')) return;
    await api('/api/admin/orders/' + b.dataset.del, 'DELETE');
    loadOrders(orderPage); loadStats();
  });
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
  $('selCount').textContent = document.querySelectorAll('.o-sel:checked').length;
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
  $('cleanupMsg').textContent = '';
  $('cleanupMsg').style.color = '';
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
    <img src="${esc(image) || '/images/logo.jpg'}">
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

function resetProdForm() {
  $('pId').value = '';
  $('pName').value = ''; $('pDesc').value = ''; $('pPrice').value = '';
  $('pOld').value = ''; $('pSizes').value = ''; $('pStock').value = '100';
  $('pActive').checked = true;
  $('colorRows').innerHTML = '';
  addColorRow();
  $('prodFormTitle').textContent = '➕ إضافة منتج جديد';
  $('cancelEditBtn').style.display = 'none';
  $('prodError').textContent = '';
}

async function saveProduct() {
  const colors = [...$('colorRows').querySelectorAll('.color-row')].map(r => ({
    name: r.querySelector('.c-name').value.trim(),
    image: r.querySelector('.c-img').value.trim()
  })).filter(c => c.name);
  const body = {
    name: $('pName').value.trim(),
    description: $('pDesc').value.trim(),
    price: Number($('pPrice').value),
    old_price: Number($('pOld').value || 0),
    sizes: $('pSizes').value.split(',').map(s => s.trim()).filter(Boolean),
    stock: Number($('pStock').value || 0),
    active: $('pActive').checked,
    colors
  };
  const id = $('pId').value;
  const j = await api(id ? '/api/admin/products/' + id : '/api/admin/products', id ? 'PUT' : 'POST', body);
  if (!j.ok) { $('prodError').textContent = j.error; return; }
  resetProdForm();
  loadProducts();
  alert('تم الحفظ بنجاح ✅');
}

async function loadProducts() {
  const j = await api('/api/admin/products');
  if (!j.ok) return;
  const list = $('productsList');
  list.innerHTML = '';
  j.products.forEach(p => {
    const img = (p.colors[0] && p.colors[0].image) || '/images/logo.jpg';
    const div = document.createElement('div');
    div.className = 'prod-item';
    div.innerHTML = `
      <img src="${img}">
      <div class="grow"><b>${esc(p.name)}</b> ${p.active ? '' : '<span class="badge-off">مخفي</span>'}
        <div class="muted" style="font-size:13px">${p.price} ج ${p.old_price > p.price ? `(قبل: ${p.old_price})` : ''} | 🎨 ${p.colors.length} ألوان | 📏 ${p.sizes.join('، ')}</div>
      </div>
      <button class="btn-mini btn-edit">تعديل ✏️</button>
      <button class="btn-mini btn-del">حذف 🗑</button>`;
    div.querySelector('.btn-edit').onclick = () => {
      $('pId').value = p.id;
      $('pName').value = p.name; $('pDesc').value = p.description || '';
      $('pPrice').value = p.price; $('pOld').value = p.old_price || '';
      $('pSizes').value = p.sizes.join(',');
      $('pStock').value = p.stock; $('pActive').checked = !!p.active;
      $('colorRows').innerHTML = '';
      p.colors.forEach(c => addColorRow(c.name, c.image));
      if (!p.colors.length) addColorRow();
      $('prodFormTitle').textContent = '✏️ تعديل: ' + p.name;
      $('cancelEditBtn').style.display = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    div.querySelector('.btn-del').onclick = async () => {
      if (!confirm(`تحذف "${p.name}" نهائياً؟`)) return;
      await api('/api/admin/products/' + p.id, 'DELETE');
      loadProducts();
    };
    list.appendChild(div);
  });
  if ($('colorRows').children.length === 0) addColorRow();
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
      <td><b>${esc(g.name)}</b></td>
      <td><input type="number" min="0" value="${g.shipping}" class="g-ship" style="max-width:120px"></td>
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
  if (j.ok) $('revPendCount').textContent = j.reviews.length;
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
      <div class="meta">— ${esc(r.name)} | 🛍 ${esc(r.product_name || 'منتج محذوف')} | ${(r.created_at || '').slice(0, 16).replace('T', ' ')}</div>
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
  $('setError').textContent = msg;
  $('setError2').textContent = msg;
  if (j.ok) setTimeout(() => { $('setError').textContent = ''; $('setError2').textContent = ''; }, 2500);
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
