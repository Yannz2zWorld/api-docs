(() => {
  'use strict';
  const { $, esc, api, busy, toast, rupiah, num, date, dateTime, tierBadge, avatar } = Z;
  Z.nav(); Z.maintenanceBubble();
  const TIERS = ['free', 'basic', 'premium', 'super', 'nebula', 'freedom', 'developer'];
  const NAME = { free: 'Free', basic: 'Basic', premium: 'Premium', super: 'Super', nebula: 'Nebula', freedom: 'Freedom', developer: 'Developer' };
  const loaded = {};

  // ---------------------------------------------------------------- tabs
  function showTab(tab) {
    document.querySelectorAll('dialog[open]').forEach(d => d.close());
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.querySelectorAll('[data-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.panel !== tab));
    if (location.hash !== '#' + tab) history.replaceState(null, '', '#' + tab);
    if (!loaded[tab]) { loaded[tab] = true; LOADERS[tab]().catch(e => toast(e.message, true)); }
  }
  $('#tabs').onclick = e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); };
  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  // ---------------------------------------------------------------- overview
  async function loadOverview() {
    const d = await api('/dev/stats');
    const s = d.stats;
    $('#stats').innerHTML = [
      [num(s.users), 'user'], [num(s.paid), 'plan berbayar aktif'], [num(s.requests_today), 'request hari ini'], [num(s.pending_orders), 'pesanan menunggu'],
      [num(s.endpoints), 'endpoint aktif'], [num(s.locked), 'endpoint dikunci'], [num(s.hidden), 'endpoint disembunyikan'], [num(s.banned), 'user diban']
    ].map(([b, t]) => `<div class="stat"><b>${b}</b><span>${t}</span></div>`).join('');
    $('#mtOn').checked = Boolean(d.maintenance.on);
    $('#mtMsg').value = d.maintenance.message || '';
  }
  $('#mtSave').onclick = e => busy(e.currentTarget, async () => {
    await api('/dev/maintenance', { method: 'PUT', body: { on: $('#mtOn').checked, message: $('#mtMsg').value } });
    toast($('#mtOn').checked ? 'Maintenance AKTIF 🛠️' : 'Maintenance mati ✅');
  });

  // ---------------------------------------------------------------- users
  let USERS = [];
  async function loadUsers() {
    const d = await api('/dev/users?q=' + encodeURIComponent($('#userQ').value));
    USERS = d.users;
    $('#userTotal').textContent = `${d.total} user${d.total > USERS.length ? ` (menampilkan ${USERS.length})` : ''}`;
    $('#userRows').innerHTML = USERS.map(u => `<tr>
      <td><div class="row" style="flex-wrap:nowrap">${avatar(u)}<div><b>${esc(u.username)}</b><div class="small muted mono">${esc(u.id)}</div></div></div></td>
      <td>${tierBadge(u.tier, u.tierName)}${u.tierExpiresAt ? `<div class="small muted">s/d ${date(u.tierExpiresAt)}</div>` : ''}</td>
      <td>${rupiah(u.balance)}</td><td>${num(u.usageToday)}</td>
      <td class="small">${esc(u.email || '-')}<br>${esc(u.phone || '-')}</td>
      <td>${u.banned ? `<span class="badge bad">Diban</span>${u.banReason ? `<div class="small muted">${esc(u.banReason)}</div>` : ''}` : '<span class="badge ok">Aktif</span>'}</td>
      <td><button class="btn btn-sm" data-edit-user="${esc(u.id)}">Kelola</button></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Tidak ada user.</td></tr>';
  }
  $('#userQ').oninput = debounce(() => loadUsers().catch(e => toast(e.message, true)));

  const tierOptions = sel => TIERS.map(t => `<option value="${t}"${t === sel ? ' selected' : ''}>${NAME[t]}</option>`).join('');
  $('#addUserBtn').onclick = () => {
    $('#userBody').innerHTML = `<h2 style="padding-right:50px">+ Tambah user</h2>
      <div class="field"><label>Username</label><input id="nuName" pattern="[a-z0-9_]{3,20}"></div>
      <div class="field"><label>Sandi</label><input id="nuPass" type="text" minlength="6"></div>
      <div class="form-grid"><div class="field"><label>Email</label><input id="nuEmail" type="email"></div><div class="field"><label>No HP</label><input id="nuPhone"></div></div>
      <div class="form-grid"><div class="field"><label>Plan</label><select id="nuTier">${tierOptions('free')}</select></div><div class="field"><label>Durasi (hari)</label><input id="nuDays" type="number" value="30" min="1"></div></div>
      <button class="btn btn-pink btn-block" id="nuSave">Buat user</button>`;
    $('#nuSave').onclick = e => busy(e.currentTarget, async () => {
      await api('/dev/users', { method: 'POST', body: { username: $('#nuName').value.trim().toLowerCase(), password: $('#nuPass').value, email: $('#nuEmail').value || undefined, phone: $('#nuPhone').value || undefined, tier: $('#nuTier').value, days: $('#nuDays').value } });
      $('#userModal').close(); toast('User dibuat ✅'); loadUsers();
    });
    $('#userModal').showModal();
  };

  function editUser(u) {
    $('#userBody').innerHTML = `<div class="row">${avatar(u)}<div><h2 style="margin:0">${esc(u.username)}</h2><div class="small muted mono">${esc(u.id)} · gabung ${date(u.createdAt)}</div></div></div>
      <div class="section-title">💎 Atur plan</div>
      <div class="form-grid"><div class="field"><label>Plan</label><select id="euTier">${tierOptions(u.rawTier)}</select></div><div class="field"><label>Durasi (hari, dari sekarang)</label><input id="euDays" type="number" value="30" min="1"></div></div>
      <button class="btn btn-blue btn-sm" id="euTierSave">Simpan plan</button>
      <div class="section-title">💰 Saldo (${rupiah(u.balance)})</div>
      <div class="row"><input id="euBal" type="number" step="1000" placeholder="+10000 atau -5000" style="flex:1"><button class="btn btn-green btn-sm" id="euBalSave">Ubah saldo</button></div>
      <div class="section-title">✏️ Akun</div>
      <div class="form-grid"><div class="field"><label>Username</label><input id="euName" value="${esc(u.username)}"></div><div class="field"><label>Reset sandi</label><input id="euPass" placeholder="sandi baru"></div></div>
      <button class="btn btn-ghost btn-sm" id="euAcc">Simpan akun</button>
      <div class="section-title">⛔ Ban / blacklist</div>
      ${u.banned ? `<p class="small">Diban${u.banReason ? ': ' + esc(u.banReason) : ''}</p><button class="btn btn-green btn-sm" id="euUnban">Buka ban</button>`
        : `<div class="field"><input id="euReason" placeholder="Alasan ban"></div><label class="check small"><input type="checkbox" id="euBl"> Blacklist email, no HP &amp; username juga</label>
           <div style="margin-top:8px"><button class="btn btn-red btn-sm" id="euBan">Ban user</button></div>`}
      <div class="section-title">🗑️ Hapus</div>
      <button class="btn btn-red btn-sm" id="euDel">Hapus user permanen</button>`;
    const patch = (btn, body, msg) => busy(btn, async () => { await api('/dev/users/' + u.id, { method: 'PATCH', body }); toast(msg); $('#userModal').close(); loadUsers(); });
    $('#euTierSave').onclick = e => patch(e.currentTarget, { tier: $('#euTier').value, days: $('#euDays').value }, 'Plan diubah ✅');
    $('#euBalSave').onclick = e => patch(e.currentTarget, { balanceDelta: $('#euBal').value }, 'Saldo diubah ✅');
    $('#euAcc').onclick = e => patch(e.currentTarget, { username: $('#euName').value.trim().toLowerCase(), ...($('#euPass').value ? { password: $('#euPass').value } : {}) }, 'Akun disimpan ✅');
    if (u.banned) $('#euUnban').onclick = e => patch(e.currentTarget, { banned: false }, 'Ban dibuka ✅');
    else $('#euBan').onclick = e => confirm(`Ban ${u.username}?`) && patch(e.currentTarget, { banned: true, reason: $('#euReason').value, blacklist: $('#euBl').checked }, 'User diban ⛔');
    $('#euDel').onclick = e => confirm(`Hapus ${u.username} beserta key & riwayatnya? Tidak bisa dibatalkan.`) && busy(e.currentTarget, async () => {
      await api('/dev/users/' + u.id, { method: 'DELETE' }); toast('User dihapus.'); $('#userModal').close(); loadUsers();
    });
    $('#userModal').showModal();
  }
  $('#userRows').onclick = e => { const b = e.target.closest('[data-edit-user]'); if (b) editUser(USERS.find(u => u.id === b.dataset.editUser)); };

  // ---------------------------------------------------------------- endpoints
  let EPS = [], PLANS = [], SERVERS = [];
  async function loadEndpoints() {
    const d = await api('/dev/endpoints');
    EPS = d.endpoints; PLANS = d.plans; SERVERS = d.servers;
    $('#catList').innerHTML = [...new Set(EPS.map(e => e.category))].map(c => `<option value="${esc(c)}">`).join('');
    renderEndpoints();
  }
  function renderEndpoints() {
    const q = $('#epQ').value.trim().toLowerCase(), f = $('#epFilter').value;
    const list = EPS.filter(e => (!q || `${e.name} ${e.path} ${e.category} ${e.server} ${e.desc}`.toLowerCase().includes(q))
      && (!f || (f === 'locked' && e.locked) || (f === 'hidden' && e.hidden) || (f === 'deleted' && e.deleted) || (f === 'custom' && e.source === 'custom') || (f === 'paid' && e.plan !== 'free'))
      && (f === 'deleted' || !e.deleted));
    $('#epTotal').textContent = `${list.length} endpoint`;
    const shown = list.slice(0, 300);
    $('#epRows').innerHTML = shown.map(e => `<tr class="ep-row${e.deleted ? ' deleted' : ''}" data-path="${esc(e.path)}">
      <td><b>${esc(e.name)}</b> <span class="small muted">${esc(e.category)}</span><div class="mono small">${esc(e.path)}</div></td>
      <td><select data-act="plan">${PLANS.map(p => `<option value="${p}"${p === e.plan ? ' selected' : ''}>${NAME[p]}</option>`).join('')}</select></td>
      <td><label class="switch"><input type="checkbox" data-act="locked"${e.locked ? ' checked' : ''}><span></span></label></td>
      <td><label class="switch"><input type="checkbox" data-act="hidden"${e.hidden ? ' checked' : ''}><span></span></label></td>
      <td class="small"><span class="badge">${esc(e.server)}</span><div class="mono muted" style="max-width:220px;overflow-wrap:anywhere">${esc(e.upstream || '')}</div></td>
      <td><div class="row">${e.source === 'custom' ? '<button class="btn btn-sm" data-act="edit">Edit</button>' : ''}
        ${e.deleted ? '<button class="btn btn-sm btn-green" data-act="restore">Pulihkan</button>' : '<button class="btn btn-sm btn-red" data-act="delete">Hapus</button>'}
        <a class="btn btn-sm btn-ghost" href="/playground#${esc(e.path)}" target="_blank" rel="noopener">Coba</a></div></td></tr>`).join('')
      + (list.length > shown.length ? `<tr><td colspan="6" class="muted small">…${list.length - shown.length} lainnya, persempit pencarian.</td></tr>` : '')
      || '<tr><td colspan="6" class="empty">Tidak ada endpoint.</td></tr>';
  }
  $('#epQ').oninput = debounce(renderEndpoints, 150);
  $('#epFilter').onchange = renderEndpoints;

  async function patchEp(path, body) {
    await api('/dev/endpoints', { method: 'PATCH', body: { path, ...body } });
    Object.assign(EPS.find(e => e.path === path), body);
  }
  $('#epRows').addEventListener('change', e => {
    const el = e.target.closest('[data-act]'); if (!el) return;
    const path = el.closest('tr').dataset.path;
    const body = el.dataset.act === 'plan' ? { plan: el.value } : { [el.dataset.act]: el.checked };
    patchEp(path, body).then(() => toast('Disimpan ✅')).catch(err => { toast(err.message, true); renderEndpoints(); });
  });
  $('#epRows').addEventListener('click', e => {
    const el = e.target.closest('button[data-act]'); if (!el) return;
    const path = el.closest('tr').dataset.path;
    const ep = EPS.find(x => x.path === path);
    if (el.dataset.act === 'delete' && confirm(`Hapus ${path}?${ep.source === 'custom' ? ' (permanen)' : ' (bisa dipulihkan)'}`)) busy(el, async () => {
      await api('/dev/endpoints?path=' + encodeURIComponent(path), { method: 'DELETE' });
      if (ep.source === 'custom') EPS = EPS.filter(x => x !== ep); else ep.deleted = true;
      renderEndpoints(); toast('Endpoint dihapus.');
    });
    if (el.dataset.act === 'restore') busy(el, async () => { await patchEp(path, { deleted: false }); renderEndpoints(); toast('Endpoint dipulihkan ✅'); });
    if (el.dataset.act === 'edit') busy(el, async () => { const d = await api('/dev/endpoints/custom?path=' + encodeURIComponent(path)); openEpForm(d.spec); });
  });

  // Form tambah / edit endpoint
  let editingPath = null;
  const F = name => $('#epForm').elements[name];
  function paramRow(p = {}) {
    const div = document.createElement('div');
    div.className = 'param-row';
    div.innerHTML = `<input data-k="name" placeholder="url" value="${esc(p.name || '')}"><input data-k="placeholder" placeholder="contoh nilai / petunjuk" value="${esc(p.placeholder || '')}">
      <input data-k="options" placeholder="opsional" value="${esc((p.options || []).join(','))}"><label class="check"><input type="checkbox" data-k="required"${p.required ? ' checked' : ''}></label>
      <button type="button" class="btn btn-sm btn-red" title="Hapus">✕</button>`;
    div.querySelector('button').onclick = () => div.remove();
    $('#paramRows').appendChild(div);
  }
  $('#paramAdd').onclick = () => paramRow();
  const syncServer = () => { const c = F('server').value === 'custom'; $('#upCustom').classList.toggle('hidden', !c); $('#upProvider').classList.toggle('hidden', c); };
  F('server').onchange = syncServer;
  function openEpForm(spec = null) {
    editingPath = spec ? spec.path : null;
    $('#epTitle').textContent = spec ? 'Edit endpoint' : 'Tambah endpoint';
    $('#epPlanSel').innerHTML = PLANS.map(p => `<option value="${p}">${NAME[p]}</option>`).join('');
    $('#epServer').innerHTML = SERVERS.map(s => `<option value="${s}">${s === 'custom' ? 'custom (URL bebas)' : s}</option>`).join('');
    $('#epForm').reset();
    for (const k of ['name', 'path', 'category', 'desc', 'upstream', 'url', 'keyParam']) F(k).value = spec?.[k] || '';
    F('output').value = spec?.output || 'json'; F('plan').value = spec?.plan || 'free'; F('server').value = spec?.server || 'custom';
    F('keyMode').value = spec?.keyMode || 'query';
    F('keyValue').placeholder = spec?.hasKey ? 'tersimpan — kosongkan = tidak berubah' : 'kosongkan = tanpa key';
    F('sample').value = spec?.sample ? JSON.stringify(spec.sample) : '';
    $('#paramRows').innerHTML = '';
    (spec?.params?.length ? spec.params : [{ name: 'url', required: true }]).forEach(paramRow);
    syncServer();
    $('#epModal').showModal();
  }
  $('#addEpBtn').onclick = () => openEpForm();
  $('#epSave').onclick = e => busy(e.currentTarget, async () => {
    let sample = null;
    if (F('sample').value.trim()) { try { sample = JSON.parse(F('sample').value); } catch { throw new Error('Contoh nilai harus JSON, mis. {"url":"https://..."}'); } }
    const params = [...$('#paramRows').children].map(r => {
      const v = k => r.querySelector(`[data-k=${k}]`);
      return { name: v('name').value.trim(), placeholder: v('placeholder').value.trim(), required: v('required').checked, options: v('options').value.split(',').map(s => s.trim()).filter(Boolean) };
    }).filter(p => p.name);
    const body = { name: F('name').value, path: F('path').value.trim().toLowerCase(), category: F('category').value, desc: F('desc').value, output: F('output').value, plan: F('plan').value,
      server: F('server').value, upstream: F('upstream').value, url: F('url').value, keyValue: F('keyValue').value, keyParam: F('keyParam').value, keyMode: F('keyMode').value, params, sample };
    if (editingPath) await api('/dev/endpoints', { method: 'PUT', body: { ...body, originalPath: editingPath } });
    else await api('/dev/endpoints', { method: 'POST', body });
    $('#epModal').close(); toast('Endpoint disimpan ✅'); await loadEndpoints();
  });

  // ---------------------------------------------------------------- orders
  async function loadOrders() {
    const d = await api('/dev/orders?status=' + $('#orderStatus').value);
    const BADGE = { pending: 'wait', approved: 'ok', rejected: 'bad' };
    $('#orderRows').innerHTML = d.orders.map(o => `<tr>
      <td>${esc(o.id)}</td><td><b>${esc(o.username)}</b><div class="small mono muted">${esc(o.public_id)}</div></td>
      <td>${o.kind === 'plan' ? tierBadge(o.tier, NAME[o.tier]) : 'Top up saldo'}${o.note ? `<div class="small muted">${esc(o.note)}</div>` : ''}</td>
      <td><b>${rupiah(o.amount)}</b></td><td class="small">${esc(o.method || '-')}<br>${esc(o.sender || '')}</td><td class="small">${dateTime(o.created_at)}</td>
      <td>${o.status === 'pending' ? `<div class="row"><button class="btn btn-sm btn-green" data-order="${o.id}" data-act="approve">Terima</button><button class="btn btn-sm btn-red" data-order="${o.id}" data-act="reject">Tolak</button></div>` : `<span class="badge ${BADGE[o.status] || ''}">${esc(o.status)}</span>`}</td></tr>`).join('')
      || '<tr><td colspan="7" class="empty">Tidak ada pesanan.</td></tr>';
  }
  $('#orderStatus').onchange = () => loadOrders().catch(e => toast(e.message, true));
  $('#orderRows').onclick = e => {
    const b = e.target.closest('[data-order]'); if (!b) return;
    const approve = b.dataset.act === 'approve';
    const note = approve ? '' : prompt('Alasan ditolak (opsional):', '') ?? null;
    if (note === null) return;
    if (approve && !confirm('Pastikan uang sudah masuk. Terima pesanan ini?')) return;
    busy(b, async () => { await api(`/dev/orders/${b.dataset.order}/${b.dataset.act}`, { method: 'POST', body: { note } }); toast(approve ? 'Pesanan diterima, plan/saldo aktif ✅' : 'Pesanan ditolak.'); loadOrders(); });
  };

  // ---------------------------------------------------------------- payments
  function payRow(p = {}) {
    const div = document.createElement('div');
    div.className = 'pay-row'; div.dataset.id = p.id || '';
    div.innerHTML = `<input data-k="name" placeholder="DANA" value="${esc(p.name || '')}"><input data-k="holder" placeholder="a.n. W** N*** H***" value="${esc(p.holder || '')}">
      <input data-k="number" placeholder="0812xxxxxxxx" value="${esc(p.number || '')}"><input data-k="note" placeholder="opsional" value="${esc(p.note || '')}">
      <button type="button" class="btn btn-sm btn-red">✕</button>`;
    div.querySelector('button').onclick = () => div.remove();
    $('#payRows').appendChild(div);
  }
  async function loadPayments() {
    const d = await api('/dev/payments');
    $('#payRows').innerHTML = '';
    (d.payments.length ? d.payments : [{}]).forEach(payRow);
  }
  $('#payAdd').onclick = () => payRow();
  $('#paySave').onclick = e => busy(e.currentTarget, async () => {
    const payments = [...$('#payRows').children].map(r => ({ id: r.dataset.id, ...Object.fromEntries([...r.querySelectorAll('[data-k]')].map(i => [i.dataset.k, i.value])) }));
    await api('/dev/payments', { method: 'PUT', body: { payments } });
    toast('Metode pembayaran disimpan ✅'); loadPayments();
  });

  // ---------------------------------------------------------------- blacklist
  async function loadBlacklist() {
    const d = await api('/dev/blacklist');
    $('#blRows').innerHTML = d.items.map(i => `<tr><td class="mono">${esc(i.value)}</td><td>${esc(i.kind)}</td><td class="small">${esc(i.reason || '-')}</td><td class="small">${date(i.created_at)}</td>
      <td><button class="btn btn-sm btn-ghost" data-unbl="${esc(i.value)}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="5" class="empty">Blacklist kosong.</td></tr>';
  }
  $('#blAdd').onclick = e => busy(e.currentTarget, async () => {
    await api('/dev/blacklist', { method: 'POST', body: { kind: $('#blKind').value, value: $('#blValue').value, reason: $('#blReason').value } });
    $('#blValue').value = ''; $('#blReason').value = ''; toast('Diblokir ⛔'); loadBlacklist();
  });
  $('#blRows').onclick = e => { const b = e.target.closest('[data-unbl]'); if (b) busy(b, async () => { await api('/dev/blacklist?value=' + encodeURIComponent(b.dataset.unbl), { method: 'DELETE' }); loadBlacklist(); }); };

  const LOADERS = { overview: loadOverview, users: loadUsers, endpoints: loadEndpoints, orders: loadOrders, payments: loadPayments, blacklist: loadBlacklist };
  const fromHash = () => showTab(LOADERS[location.hash.slice(1)] ? location.hash.slice(1) : 'overview');
  window.addEventListener('hashchange', fromHash);
  fromHash();
})();
