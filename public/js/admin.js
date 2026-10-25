// ================= CAIRO CHIC - Admin =================
const $ = (id) => document.getElementById(id);
let STATUS_AR = {};

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
  loadSettings();
}

function bindPanel() {
  document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    ['orders', 'products', 'settings'].forEach(n => $('tab-' + n).style.display = n === t.dataset.tab ? '' : 'none');
  });
  $('logoutBtn').onclick = async () => { await api('/api/admin/logout', 'POST'); location.reload(); };
  $('refreshOrders').onclick = loadOrders;
  $('statusFilter').onchange = loadOrders;
  $('addColorBtn').onclick = () => addColorRow();
  $('saveProdBtn').onclick = saveProduct;
  $('cancelEditBtn').onclick = resetProdForm;
  $('saveSettingsBtn').onclick = saveSettings;
  $('changePwBtn').onclick = changePassword;
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

async function loadOrders() {
  const st = $('statusFilter').value;
  const j = await api('/api/admin/orders' + (st ? '?status=' + st : ''));
  if (!j.ok) return;
  STATUS_AR = j.statusAr;
  const tb = $('ordersBody');
  tb.innerHTML = '';
  if (!j.orders.length) {
    tb.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#999">مفيش طلبات هنا لسه</td></tr>';
    return;
  }
  j.orders.forEach(o => {
    const tr = document.createElement('tr');
    const waText = encodeURIComponent(`أهلاً ${o.name}، معاك كايرو شيك 🦅 بخصوص طلبك رقم ${o.order_no} (${o.product_name} - ${o.color} - ${o.size}) بإجمالي ${o.total} جنيه. نأكد الطلب؟`);
    tr.innerHTML = `
      <td><b dir="ltr">${o.order_no}</b></td>
      <td style="white-space:nowrap">${(o.created_at || '').slice(0, 16).replace('T', ' ')}</td>
      <td><b>${esc(o.name)}</b><br><a href="tel:${o.phone}" dir="ltr">${o.phone}</a></td>
      <td>${esc(o.product_name)}<br>🎨 ${esc(o.color)} | 📏 ${esc(o.size)} | × ${o.qty}</td>
      <td><b>${o.total} ج</b><br><small class="muted">شحن: ${o.shipping}</small></td>
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
    loadOrders(); loadStats();
  });
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
    fd.append('image', f);
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

// ---------- Settings ----------
async function loadSettings() {
  const j = await api('/api/admin/settings');
  if (!j.ok) return;
  const s = j.settings;
  $('sNameAr').value = s.store_name_ar || '';
  $('sNameEn').value = s.store_name_en || '';
  $('sAnnounce').value = s.announcement || '';
  $('sWhatsapp').value = s.whatsapp || '';
  $('sPixel').value = s.tiktok_pixel || '';
  $('sShipCities').value = s.shipping_cities || '50';
  $('sShipOthers').value = s.shipping_others || '70';
}

async function saveSettings() {
  const j = await api('/api/admin/settings', 'PUT', {
    store_name_ar: $('sNameAr').value,
    store_name_en: $('sNameEn').value,
    announcement: $('sAnnounce').value,
    whatsapp: $('sWhatsapp').value,
    tiktok_pixel: $('sPixel').value,
    shipping_cities: $('sShipCities').value,
    shipping_others: $('sShipOthers').value
  });
  $('setError').textContent = j.ok ? 'تم الحفظ ✅' : (j.error || 'خطأ');
  if (j.ok) setTimeout(() => $('setError').textContent = '', 2500);
}

async function changePassword() {
  const j = await api('/api/admin/password', 'POST', { current: $('pwCur').value, next: $('pwNew').value });
  $('pwError').textContent = j.ok ? 'تم تغيير الباسورد ✅' : (j.error || 'خطأ');
  if (j.ok) { $('pwCur').value = ''; $('pwNew').value = ''; }
}
