// Shared helpers for every page: nav, toast, copy, API calls, maintenance bubble, theme.
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  // ---------------------------------------------------------------- theme
  function applyTheme() {
    const t = store.get('az-theme');
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
  }
  applyTheme();
  const isDark = () => document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  function toggleTheme() { store.set('az-theme', isDark() ? 'light' : 'dark'); applyTheme(); document.querySelectorAll('[data-theme-btn]').forEach(b => { b.textContent = isDark() ? '☀️' : '🌙'; }); }

  // ---------------------------------------------------------------- toast + copy
  let toastTimer;
  function toast(msg, err = false) {
    let t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    const host = document.querySelector('dialog[open]') || document.body;
    if (t.parentNode !== host) host.appendChild(t);
    t.textContent = msg; t.classList.toggle('err', err); t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      (document.querySelector('dialog[open]') || document.body).appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch {} ta.remove();
    }
    toast('Tersalin! ✨');
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-copy]'); if (a) { copy(a.dataset.copy); return; }
    const b = e.target.closest('[data-copy-target]'); if (b) { const el = document.getElementById(b.dataset.copyTarget); copy(el.dataset.raw || el.value || el.textContent); }
  });

  // ---------------------------------------------------------------- API
  async function api(url, { method = 'GET', body } = {}) {
    const opt = { method, headers: { Accept: 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let res, data;
    try { res = await fetch(url, opt); } catch { throw new Error('Koneksi gagal. Cek internet kamu.'); }
    try { data = await res.json(); } catch { data = null; }
    if (res.status === 401 && data?.error === 'LOGIN_REQUIRED') { location.href = '/login?next=' + encodeURIComponent(location.pathname); throw new Error('Silakan login dulu.'); }
    if (!res.ok || !data || data.status === false) throw Object.assign(new Error(data?.message || `Gagal (HTTP ${res.status}).`), { code: data?.error, data });
    return data;
  }
  // Run an async action from a button: disables it, shows errors as toast.
  async function busy(btn, fn) {
    if (btn) { btn.disabled = true; btn.dataset.label = btn.innerHTML; btn.innerHTML = '⏳ …'; }
    try { return await fn(); }
    catch (e) { toast(e.message, true); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.label; } }
  }

  // ---------------------------------------------------------------- helpers
  const rupiah = n => 'Rp' + Number(n || 0).toLocaleString('id-ID');
  const num = n => Number(n || 0).toLocaleString('id-ID');
  const date = d => d ? new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  const dateTime = d => d ? new Date(d).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
  const tierBadge = (id, name) => `<span class="tier tier-${esc(id)}">${esc(name || id)}</span>`;
  const avatar = (u, cls = '') => `<span class="avatar ${cls}">${u?.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u?.username || '?')[0].toUpperCase())}</span>`;

  let mePromise = null;
  const me = (fresh = false) => (!mePromise || fresh) ? (mePromise = api('/me')) : mePromise;

  // ---------------------------------------------------------------- nav
  const LINKS = [['/home', '🏠 Home'], ['/playground', '🎡 Playground'], ['/price', '💎 Price'], ['/chat', '💬 Live Chat'], ['/profile', '👤 Profile']];
  async function nav() {
    const path = location.pathname.toLowerCase();
    const el = document.createElement('header');
    el.className = 'nav';
    el.innerHTML = `<div class="wrap nav-inner">
      <a class="brand" href="/home"><span class="logo-badge">0</span> API Zero</a>
      <nav class="nav-links" id="navLinks">${LINKS.map(([h, t]) => `<a href="${h}" class="${path === h ? 'active' : ''}">${t}</a>`).join('')}</nav>
      <div class="nav-user"><button class="btn btn-ghost btn-sm icon-btn" data-theme-btn title="Ganti tema">${isDark() ? '☀️' : '🌙'}</button><a href="/profile" id="navAvatar" title="Profile"><span class="avatar">…</span></a>
      <button class="btn btn-sm btn-pink" id="logoutBtn" title="Keluar">Keluar</button></div></div>`;
    document.body.prepend(el);
    el.querySelector('[data-theme-btn]').onclick = toggleTheme;
    el.querySelector('#logoutBtn').onclick = async () => { try { await api('/auth/logout', { method: 'POST', body: {} }); } catch {} location.href = '/login'; };
    try {
      const d = await me();
      el.querySelector('#navAvatar').innerHTML = avatar(d.user);
      if (d.user.isDeveloper) el.querySelector('#navLinks').insertAdjacentHTML('beforeend', `<a href="/developer" class="${path === '/developer' ? 'active' : ''}">🛠️ Developer</a>`);
    } catch {}
  }

  // ---------------------------------------------------------------- maintenance bubble
  async function maintenanceBubble() {
    try {
      const d = await (await fetch('/site/status')).json();
      const m = d.maintenance;
      if (!m || !m.on) return;
      if (sessionStorage.getItem('az-mt-closed') === m.message) return;
      const b = document.createElement('div');
      b.className = 'mt-bubble'; b.setAttribute('role', 'status');
      b.innerHTML = `<b>🛠️ Maintenance</b><span>${esc(m.message)}</span><button aria-label="Tutup">×</button>`;
      b.querySelector('button').onclick = () => { b.remove(); try { sessionStorage.setItem('az-mt-closed', m.message); } catch {} };
      document.body.appendChild(b);
    } catch {}
  }

  document.querySelectorAll('[data-theme-btn]').forEach(b => { b.textContent = isDark() ? '☀️' : '🌙'; b.onclick = toggleTheme; });
  window.Z = { $, esc, store, toast, copy, api, busy, rupiah, num, date, dateTime, tierBadge, avatar, me, nav, maintenanceBubble, isDark, toggleTheme };
})();
