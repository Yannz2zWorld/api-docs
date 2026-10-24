'use strict';
// Dashboard YannAjahNew. Semua data dirender lewat textContent / node DOM (tidak ada innerHTML dengan data),
// jadi nama/alasan berisi HTML tidak bisa menjalankan script. Tombol disembunyikan sesuai permission
// hanya demi kenyamanan — backend tetap memeriksa permission, cakupan, dan kuota di setiap request.
(function () {
  let ME = null;
  const $ = id => document.getElementById(id);

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : String(v));
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) n.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    return n;
  }
  const can = p => ME && ME.permissions.includes(p);
  const fmt = d => (d ? new Date(d).toLocaleString('id-ID') : '—');

  let toastTimer;
  function toast(msg, err = false) {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast' + (err ? ' err' : '');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 4500);
  }

  async function api(method, path, body) {
    const res = await fetch(path, {
      method, credentials: 'same-origin',
      headers: { ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(method !== 'GET' && ME ? { 'x-csrf-token': ME.csrfToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let json = {};
    try { json = await res.json(); } catch {}
    if (res.status === 401) { location.replace('/'); throw new Error('Sesi berakhir'); }
    if (!res.ok || json.success === false) { const e = new Error(json.message || `HTTP ${res.status}`); e.code = json.error; throw e; }
    return json;
  }
  const run = async (fn, okMsg) => { try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { toast(e.message, true); return null; } };

  // Dialog form generik: fields = [{name, label, type, options, required, value}] -> Promise<values|null>
  function ask(title, fields, submitLabel = 'Simpan') {
    return new Promise(resolve => {
      const d = $('dialog'), f = $('dialog-form');
      f.replaceChildren(el('h2', {}, title));
      const inputs = {};
      for (const fd of fields) {
        let input;
        if (fd.type === 'select') input = el('select', { name: fd.name }, fd.options.map(o => el('option', { value: o.value, selected: o.value === fd.value }, o.label)));
        else if (fd.type === 'textarea') input = el('textarea', { name: fd.name, required: fd.required, maxlength: fd.max || 500 }, fd.value || '');
        else input = el('input', { name: fd.name, type: fd.type || 'text', required: fd.required, value: fd.value ?? '', minlength: fd.min, maxlength: fd.max, autocomplete: fd.type === 'password' ? 'new-password' : 'off', placeholder: fd.placeholder, readonly: fd.readonly || undefined });
        if (fd.readonly) { input.type = 'text'; input.onclick = () => input.select(); }
        inputs[fd.name] = input;
        f.append(el('label', {}, fd.label, input), fd.hint ? el('small', { class: 'muted' }, fd.hint) : null);
      }
      f.append(el('div', { class: 'actions' }, el('button', { class: 'btn primary', value: 'ok' }, submitLabel), el('button', { class: 'btn', value: 'cancel', formnovalidate: true }, 'Batal')));
      d.onclose = () => {
        if (d.returnValue !== 'ok') return resolve(null);
        resolve(Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value])));
      };
      d.returnValue = '';
      d.showModal();
    });
  }

  const statusBadge = s => el('span', { class: 'badge ' + ({ active: 'ok', connected: 'ok', connecting: 'warn', disconnected: '', disabled: 'warn', suspended: 'warn', banned: 'bad' }[s] || '') }, s);

  // ------------------------------------------------------------------ views
  const VIEWS = {
    ringkasan: { label: 'Ringkasan', show: () => true, render: renderSummary },
    akun: { label: 'Akun', show: () => can('user.view') || can('user.view_all'), render: renderAccounts },
    bot: { label: 'Bot', show: () => can('bot.view'), render: renderBots },
    maintenance: { label: 'Maintenance', show: () => can('maintenance.manage'), render: renderMaintenance },
    audit: { label: 'Audit', show: () => can('audit.view') || can('audit.view_all'), render: renderAudit },
    keamanan: { label: 'Keamanan', show: () => can('security.view'), render: renderSecurity },
    sistem: { label: 'Sistem', show: () => can('system.view'), render: renderSystem }
  };

  async function renderSummary(view) {
    const stats = await api('GET', '/api/dash/stats');
    const q = ME.quota;
    view.append(
      el('section', { class: 'panel' }, el('h2', {}, `Halo, ${ME.account.display_name || ME.account.username}`),
        el('p', {}, 'Rank kamu: ', el('span', { class: 'badge accent' }, ME.account.rank), ' · status ', statusBadge(ME.account.status)),
        el('div', { class: 'grid' },
          el('div', { class: 'stat' }, el('b', {}, q.numbers.label), el('span', {}, 'Kuota nomor bot')),
          el('div', { class: 'stat' }, el('b', {}, q.users.label), el('span', {}, 'Kuota user yang dikelola')),
          ...Object.entries(stats.stats).map(([k, v]) => el('div', { class: 'stat' }, el('b', {}, v), el('span', {}, k.replace(/_/g, ' ')))))),
      el('section', { class: 'panel' }, el('h2', {}, 'Permission kamu'), el('div', { class: 'chips' }, ME.permissions.map(p => el('span', { class: 'badge' }, p)))),
      el('section', { class: 'panel' }, el('h2', {}, 'Sesi'), el('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await run(() => api('POST', '/api/dash/sessions/revoke-all'), 'Semua sesi dicabut')) location.replace('/'); } }, 'Keluar dari semua perangkat'))
    );
  }

  // Sama dengan server/services/accessControl.js. Server tetap yang memutuskan; ini hanya menyaring tombol.
  const RANK_CREATE = { RESELLER: 'reseller.create', SUKI: 'suki.create', RAJA: 'raja.create', DEWA: 'dewa.create' };
  const RANK_DELETE = { RESELLER: 'reseller.delete', SUKI: 'suki.delete', RAJA: 'raja.delete', DEWA: 'dewa.delete' };

  async function renderAccounts(view) {
    const [{ accounts }, { ranks }] = await Promise.all([api('GET', '/api/dash/accounts'), api('GET', '/api/dash/ranks')]);
    const creatable = Object.entries(RANK_CREATE).filter(([, p]) => can(p)).map(([r]) => ({ value: r, label: r }));
    const head = el('section', { class: 'panel' }, el('h2', {}, `Akun (${accounts.length})`));
    if (creatable.length) head.append(el('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const v = await ask('Tambah akun', [
        { name: 'username', label: 'Username', required: true, min: 3, max: 32, hint: 'huruf kecil, angka, . _ -' },
        { name: 'display_name', label: 'Nama tampilan', max: 80 },
        { name: 'email', label: 'Email (untuk login website)', type: 'email' },
        { name: 'password', label: 'Password website', type: 'password', min: 10, max: 72, hint: 'Berikan email + password ini ke pembeli. Minimal 10 karakter, huruf & angka. Hanya reseller ke atas yang bisa masuk website.' },
        { name: 'rank', label: 'Rank', type: 'select', options: creatable, value: (creatable[0] || {}).value }
      ], 'Buat');
      if (v && await run(() => api('POST', '/api/dash/accounts', { ...v, email: v.email || undefined, password: v.password || undefined }), 'Akun dibuat')) show('akun');
    } }, '+ Tambah akun'));
    const rows = accounts.map(a => el('tr', {},
      el('td', {}, el('b', {}, a.username), el('div', { class: 'muted' }, a.display_name || ''), el('div', { class: 'muted mono' }, a.email || ''),
        el('div', { class: 'muted' }, a.password_set ? 'login website: aktif' : 'belum ada password website')),
      el('td', {}, el('span', { class: 'badge accent' }, a.rank_code)),
      el('td', {}, statusBadge(a.status), a.status_reason ? el('div', { class: 'muted' }, a.status_reason) : null),
      el('td', {}, a.quota ? [el('div', {}, 'nomor ', a.quota.numbers), el('div', {}, 'user ', a.quota.users)] : '—'),
      el('td', {}, (a.bots || []).map(b => el('div', {}, b.bot_name))),
      el('td', {}, a.manager_username || '—'),
      el('td', {}, a.id === ME.account.id ? el('span', { class: 'muted' }, 'kamu') : accountActions(a, ranks))
    ));
    view.append(head, el('section', { class: 'panel table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Akun', 'Rank', 'Status', 'Kuota', 'Bot', 'Manager', 'Aksi'].map(h => el('th', {}, h)))), el('tbody', {}, rows))));
  }

  function accountActions(a, ranks) {
    const box = el('div', { class: 'actions' });
    const myLevel = ranks.find(x => x.code === ME.account.rank).level;
    const cur = ranks.find(x => x.code === a.rank_code);
    // Naik ke rank X butuh izin tambah X; turun butuh izin hapus rank asal.
    const opts = !cur || cur.level >= myLevel ? [] : ranks.filter(r => r.assignable && r.level < myLevel && r.code !== a.rank_code && (r.level > cur.level ? can(RANK_CREATE[r.code]) : can(RANK_DELETE[a.rank_code])))
      .map(r => ({ value: r.code, label: `${r.code} (nomor ${r.max_numbers ?? '∞'}, user ${r.max_managed_users ?? '∞'})` }));
    if (can('role.assign') && opts.length) box.append(el('button', { class: 'btn small', type: 'button', onclick: async () => {
      const v = await ask(`Ubah rank ${a.username}`, [{ name: 'rank', label: 'Rank baru', type: 'select', options: opts, value: a.rank_code }]);
      if (v) { const r = await run(() => api('POST', `/api/dash/accounts/${a.id}/rank`, v), 'Rank diubah'); if (r?.over_quota) toast('Catatan: pemakaian sudah melebihi kuota rank baru. Data lama tidak dihapus; penambahan diblokir.'); show('akun'); }
    } }, 'Rank'));
    if (a.status === 'active' && can('user.ban')) box.append(el('button', { class: 'btn small danger', type: 'button', onclick: async () => {
      const v = await ask(`Batasi akun ${a.username}`, [
        { name: 'status', label: 'Status', type: 'select', options: ['banned', 'suspended', 'disabled'].map(s => ({ value: s, label: s })), value: 'banned' },
        { name: 'reason', label: 'Alasan (wajib, tercatat di audit)', type: 'textarea', required: true }]);
      if (v && await run(() => api('POST', `/api/dash/accounts/${a.id}/status`, v), 'Status diubah')) show('akun');
    } }, 'Ban/Suspend'));
    if (a.status !== 'active' && can('user.unban')) box.append(el('button', { class: 'btn small', type: 'button', onclick: async () => {
      if (await run(() => api('POST', `/api/dash/accounts/${a.id}/status`, { status: 'active' }), 'Akun diaktifkan')) show('akun');
    } }, 'Aktifkan'));
    if (can('user.update') && cur && cur.level < myLevel) box.append(el('button', { class: 'btn small', type: 'button', onclick: async () => {
      const v = await ask(`Password website ${a.username}`, [{ name: 'password', label: 'Password baru', type: 'password', required: true, min: 10, max: 72, hint: 'Sesi login akun ini akan dicabut; dia perlu login ulang dengan password baru.' }]);
      if (v && await run(() => api('POST', `/api/dash/accounts/${a.id}/password`, v), 'Password akun diatur')) show('akun');
    } }, 'Password'));
    if (can('user.update')) box.append(el('button', { class: 'btn small', type: 'button', onclick: async () => {
      const v = await ask(`Ubah ${a.username}`, [{ name: 'display_name', label: 'Nama tampilan', value: a.display_name, max: 80 }, { name: 'email', label: 'Email', type: 'email', value: a.email || '' }]);
      if (v && await run(() => api('PATCH', `/api/dash/accounts/${a.id}`, { display_name: v.display_name, email: v.email || null }), 'Akun diperbarui')) show('akun');
    } }, 'Edit'));
    if (can(RANK_DELETE[a.rank_code]) && cur && cur.level < myLevel) box.append(el('button', { class: 'btn small danger', type: 'button', onclick: async () => {
      const v = await ask(`Hapus ${a.username}?`, [{ name: 'confirm', label: `Ketik "${a.username}" untuk konfirmasi`, required: true }], 'Hapus');
      if (v && v.confirm === a.username && await run(() => api('DELETE', `/api/dash/accounts/${a.id}`), 'Akun dihapus')) show('akun');
    } }, 'Hapus'));
    return box;
  }

  async function renderBots(view) {
    const { bots } = await api('GET', '/api/dash/bots');
    const head = el('section', { class: 'panel' }, el('h2', {}, `Bot / nomor (${bots.length})`), el('p', { class: 'muted' }, `Kuota nomor kamu: ${ME.quota.numbers.label}`));
    if (can('number.create')) head.append(el('button', { class: 'btn primary', type: 'button', onclick: async () => {
      const fields = [
        { name: 'bot_name', label: 'Nama bot', required: true, max: 60 },
        { name: 'phone_number', label: 'Nomor WhatsApp bot (dari pembeli)', required: true, placeholder: '6281234567890' }
      ];
      // Password bot hanya bisa dibuat DEVELOPER. Rank lain cuma mendaftarkan nomor;
      // bot belum bisa jalan sampai developer menetapkan passwordnya (tombol "Password").
      if (can('bot.credential.reset')) fields.push({ name: 'password', label: 'Password bot (opsional — bisa diatur nanti)', type: 'password', min: 10, max: 72, hint: 'Kosongkan kalau mau mengaturnya belakangan. Hanya developer yang bisa membuat/mengganti password bot.' });
      const v = await ask('Tambah bot', fields, 'Tambah');
      if (!v) return;
      if (!v.password) delete v.password;
      const res = await run(() => api('POST', '/api/dash/bots', v), 'Nomor bot ditambahkan');
      if (res) { ME = await api('GET', '/api/dash/me'); show('bot'); }
    } }, '+ Tambah bot'));
    const rows = bots.map(b => el('tr', {},
      el('td', {}, el('b', {}, b.bot_name), el('div', { class: 'mono muted' }, b.phone_number)),
      el('td', {}, b.owner_username, el('div', { class: 'muted' }, b.owner_rank)),
      el('td', {}, b.user_username || '—'),
      el('td', {}, statusBadge(b.status), el('div', { class: 'muted' }, 'koneksi: ', b.connection_status)),
      el('td', {}, b.banned ? [el('span', { class: 'badge bad' }, 'banned'), el('div', { class: 'muted' }, b.ban_reason || '')] : b.enabled ? el('span', { class: 'badge ok' }, 'enabled') : [el('span', { class: 'badge warn' }, 'disabled'), el('div', { class: 'muted' }, b.disabled_reason || '')]),
      el('td', {}, b.maintenance_enabled ? el('span', { class: 'badge warn' }, 'maintenance') : '—'),
      el('td', {}, b.password_set ? 'diset' : el('span', { class: 'badge warn' }, 'belum'), el('div', { class: 'muted' }, `${b.active_sessions} sesi`)),
      el('td', {}, fmt(b.last_seen_at)),
      el('td', {}, botActions(b))
    ));
    view.append(head, el('section', { class: 'panel table-wrap' }, el('table', {},
      el('thead', {}, el('tr', {}, ['Bot', 'Pemilik', 'Pemakai', 'Status', 'Enabled/Ban', 'Maint.', 'Password', 'Terakhir aktif', 'Aksi'].map(h => el('th', {}, h)))), el('tbody', {}, rows))));
  }

  function botActions(b) {
    const box = el('div', { class: 'actions' });
    const act = (label, fn, cls = '') => box.append(el('button', { class: 'btn small ' + cls, type: 'button', onclick: fn }, label));
    if (can('bot.credential.reset')) act('Password', async () => {
      const v = await ask(`Password bot ${b.bot_name}`, [{ name: 'password', label: 'Password baru', type: 'password', required: true, min: 10, max: 72, hint: 'Sesi bot yang sedang jalan akan dicabut; bot perlu login ulang.' }]);
      if (v && await run(() => api('POST', `/api/dash/bots/${b.id}/password`, v), 'Password bot diperbarui')) show('bot');
    });
    if (can('bot.manage')) act(b.enabled ? 'Disable' : 'Enable', async () => {
      const v = b.enabled ? await ask(`Nonaktifkan ${b.bot_name}`, [{ name: 'reason', label: 'Alasan', type: 'textarea', required: true }]) : {};
      if (v && await run(() => api('POST', `/api/dash/bots/${b.id}/enabled`, { enabled: !b.enabled, reason: v.reason }), 'Status bot diubah')) show('bot');
    });
    if (!b.banned && can('bot.ban')) act('Ban', async () => {
      const v = await ask(`Ban ${b.bot_name}`, [{ name: 'reason', label: 'Alasan ban (tercatat)', type: 'textarea', required: true }]);
      if (v && await run(() => api('POST', `/api/dash/bots/${b.id}/ban`, { banned: true, reason: v.reason }), 'Bot diban')) show('bot');
    }, 'danger');
    if (b.banned && can('bot.unban')) act('Unban', async () => { if (await run(() => api('POST', `/api/dash/bots/${b.id}/ban`, { banned: false }), 'Bot di-unban')) show('bot'); });
    if (can('bot.maintenance')) act('Maint.', async () => {
      const v = await ask(`Maintenance ${b.bot_name}`, [
        { name: 'enabled', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Mati' }], value: String(!b.maintenance_enabled) },
        { name: 'message', label: 'Pesan maintenance', type: 'textarea', value: b.maintenance_message || 'Bot sedang maintenance.' }]);
      if (v && await run(() => api('POST', `/api/dash/bots/${b.id}/maintenance`, { enabled: v.enabled === 'true', message: v.message }), 'Maintenance bot diubah')) show('bot');
    });
    if (can('bot.session.revoke')) act('Cabut sesi', async () => { if (await run(() => api('POST', `/api/dash/bots/${b.id}/revoke`), 'Sesi bot dicabut')) show('bot'); });
    if (can('number.delete')) act('Hapus', async () => {
      const v = await ask(`Hapus ${b.bot_name}?`, [{ name: 'confirm', label: `Ketik "${b.phone_number}" untuk konfirmasi`, required: true }], 'Hapus');
      if (v && v.confirm === b.phone_number && await run(() => api('DELETE', `/api/dash/bots/${b.id}`), 'Bot dihapus')) { ME = await api('GET', '/api/dash/me'); show('bot'); }
    }, 'danger');
    return box;
  }

  async function renderMaintenance(view) {
    const { maintenance: m } = await api('GET', '/api/dash/maintenance');
    view.append(el('section', { class: 'panel' }, el('h2', {}, 'Maintenance global'),
      el('p', {}, 'Status: ', m.enabled ? el('span', { class: 'badge warn' }, 'AKTIF') : el('span', { class: 'badge ok' }, 'mati'), ` · diubah ${fmt(m.updated_at)}`),
      el('p', { class: 'muted' }, 'Pengecualian (bot milik rank ini tetap jalan): ', m.exempt_ranks.join(', ') || '—'),
      el('button', { class: 'btn primary', type: 'button', onclick: async () => {
        const v = await ask('Maintenance global', [
          { name: 'enabled', label: 'Status', type: 'select', options: [{ value: 'true', label: 'Aktif' }, { value: 'false', label: 'Mati' }], value: String(!m.enabled) },
          { name: 'message', label: 'Pesan untuk pengguna bot', type: 'textarea', value: m.message, required: true },
          { name: 'exempt', label: 'Rank dikecualikan (pisah koma)', value: m.exempt_ranks.join(',') }]);
        if (v && await run(() => api('PUT', '/api/dash/maintenance', { enabled: v.enabled === 'true', message: v.message, exempt_ranks: v.exempt.split(',').map(s => s.trim()).filter(Boolean) }), 'Maintenance diperbarui')) { ME = await api('GET', '/api/dash/me'); banner(); show('maintenance'); }
      } }, 'Ubah')));
  }

  async function renderAudit(view) {
    const { logs } = await api('GET', '/api/dash/audit?limit=100');
    view.append(el('section', { class: 'panel table-wrap' }, el('h2', {}, 'Audit log'), el('table', {},
      el('thead', {}, el('tr', {}, ['Waktu', 'Pelaku', 'Aksi', 'Target', 'Detail'].map(h => el('th', {}, h)))),
      el('tbody', {}, logs.map(l => el('tr', {}, el('td', {}, fmt(l.created_at)), el('td', {}, l.actor_username || `${l.actor_type}${l.actor_id ? ' #' + l.actor_id : ''}`),
        el('td', { class: 'mono' }, l.action), el('td', {}, l.target_type ? `${l.target_type} #${l.target_id}` : '—'), el('td', { class: 'mono' }, JSON.stringify(l.details))))))));
  }

  async function renderSecurity(view) {
    const { attempts } = await api('GET', '/api/dash/login-attempts?limit=100');
    view.append(el('section', { class: 'panel table-wrap' }, el('h2', {}, 'Percobaan login (bot)'), el('table', {},
      el('thead', {}, el('tr', {}, ['Waktu', 'Jenis', 'Hasil', 'Alasan', 'IP'].map(h => el('th', {}, h)))),
      el('tbody', {}, attempts.map(a => el('tr', {}, el('td', {}, fmt(a.created_at)), el('td', {}, a.kind), el('td', {}, a.success ? el('span', { class: 'badge ok' }, 'sukses') : el('span', { class: 'badge bad' }, 'gagal')), el('td', {}, a.reason || '—'), el('td', { class: 'mono' }, a.ip || '—')))))));
  }

  async function renderSystem(view) {
    const hlt = await api('GET', '/api/dash/health');
    view.append(el('section', { class: 'panel' }, el('h2', {}, 'Kesehatan sistem'), el('div', { class: 'grid' },
      el('div', { class: 'stat' }, el('b', {}, hlt.database.ok ? 'OK' : 'GAGAL'), el('span', {}, `database ${hlt.database.ms ?? '?'} ms`)),
      el('div', { class: 'stat' }, el('b', {}, hlt.pending_migrations ? hlt.pending_migrations.length : 0), el('span', {}, 'migrasi tertunda')),
      el('div', { class: 'stat' }, el('b', {}, `${hlt.memory_mb} MB`), el('span', {}, 'memori proses')),
      el('div', { class: 'stat' }, el('b', {}, Math.round(hlt.uptime_s / 60) + ' m'), el('span', {}, `uptime · ${hlt.node}`))),
      can('backup.manage') ? el('p', {}, el('a', { class: 'btn', href: '/api/dash/backup' }, 'Unduh backup terenkripsi')) : null));
  }

  function banner() {
    const b = $('maintenance-banner');
    if (ME.maintenance?.enabled) { b.textContent = `Maintenance global aktif: ${ME.maintenance.message}`; b.classList.remove('hidden'); }
    else b.classList.add('hidden');
  }

  async function show(name) {
    const v = VIEWS[name] && VIEWS[name].show() ? name : 'ringkasan';
    for (const b of $('nav').children) {
      if (b.dataset.view === v) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    const view = $('view');
    view.replaceChildren(el('p', { class: 'muted' }, 'Memuat…'));
    const frag = el('div');
    try { await VIEWS[v].render(frag); view.replaceChildren(frag); }
    catch (e) { view.replaceChildren(el('section', { class: 'panel' }, el('h2', {}, 'Gagal memuat'), el('p', {}, e.message))); }
    history.replaceState(null, '', '#' + v);
  }

  async function init() {
    try { ME = await api('GET', '/api/dash/me'); } catch { return; }
    $('who').textContent = `${ME.account.username} · ${ME.account.rank}`;
    $('nav').replaceChildren(...Object.entries(VIEWS).filter(([, x]) => x.show()).map(([k, x]) => el('button', { type: 'button', 'data-view': k, onclick: () => show(k) }, x.label)));
    $('logout').addEventListener('click', async () => { await run(() => api('POST', '/auth/logout')); location.replace('/'); });
    $('mypass').addEventListener('click', async () => {
      const v = await ask('Ganti password kamu', [
        { name: 'current_password', label: 'Password lama', type: 'password', hint: 'Kosongkan kalau akun ini belum pernah punya password.' },
        { name: 'new_password', label: 'Password baru', type: 'password', required: true, min: 10, max: 72, hint: 'Minimal 10 karakter, huruf & angka. Sesi di perangkat lain akan dikeluarkan.' }]);
      if (v) await run(() => api('POST', '/api/dash/me/password', v), 'Password diganti');
    });
    banner();
    show(location.hash.slice(1) || 'ringkasan');
  }
  init();
})();
