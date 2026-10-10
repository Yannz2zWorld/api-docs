// Yannz API — live chat room (bottom-right on the dashboard). One public room for signed-in users;
// messages show the account name only. Polls /api/chat every 2.5 s while open (12 s while closed,
// for the unread badge) and pauses while the tab is hidden. All text is rendered with textContent.
(function () {
  'use strict';
  if (window.__yannzChat) return;
  window.__yannzChat = true;

  const css = `
  .yc-fab{position:fixed;right:18px;bottom:18px;z-index:90;display:flex;align-items:center;gap:8px;padding:12px 16px;border:2px solid var(--edge,#d4d4d8);border-radius:999px;background:var(--blood,#c8202f);color:var(--accent-ink,#fff);font:700 12px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;box-shadow:4px 4px 0 var(--drop,#3f3f46);cursor:pointer}
  .yc-fab:hover{transform:translate(-1px,-1px);box-shadow:5px 5px 0 var(--drop,#3f3f46)}
  .yc-fab .yc-dot{width:8px;height:8px;border-radius:50%;background:#86efac;box-shadow:0 0 0 3px rgba(134,239,172,.25)}
  .yc-badge{min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:#fff;color:var(--ui-deep,#a3172a);display:inline-grid;place-items:center;font-size:11px}
  .yc-badge[hidden]{display:none}
  .yc-panel{position:fixed;right:18px;bottom:76px;z-index:91;width:min(360px,calc(100vw - 24px));height:min(520px,calc(100vh - 110px));display:flex;flex-direction:column;border:2px solid var(--edge,#d4d4d8);border-radius:16px;background:#111113;box-shadow:6px 6px 0 var(--drop,#3f3f46);overflow:hidden;color:#f4f4f5}
  .yc-panel[hidden]{display:none}
  .yc-head{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:12px 14px;border-bottom:2px solid #26262b;background:#161618}
  .yc-head b{font:700 15px 'Space Grotesk',sans-serif}
  .yc-head small{font:500 10px 'DM Mono',monospace;color:#a1a1aa;letter-spacing:.06em;text-transform:uppercase}
  .yc-x{border:0;background:transparent;color:#a1a1aa;font-size:20px;cursor:pointer;line-height:1}
  .yc-list{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;overscroll-behavior:contain}
  .yc-msg{max-width:85%;align-self:flex-start;background:#1c1c20;border:1.5px solid #2e2e34;border-radius:12px 12px 12px 4px;padding:7px 10px;position:relative}
  .yc-msg.mine{align-self:flex-end;background:color-mix(in srgb,var(--accent,#c8202f) 16%,transparent);border-color:color-mix(in srgb,var(--accent,#c8202f) 45%,transparent);border-radius:12px 12px 4px 12px}
  .yc-who{display:flex;gap:6px;align-items:center;font:600 11px 'DM Mono',monospace;color:#d4d4d8;margin-bottom:2px}
  .yc-av{width:22px;height:22px;border-radius:7px;border:1.5px solid #3f3f46;object-fit:cover;flex:none;background:var(--accent,#c8202f);color:var(--accent-ink,#fff);display:inline-grid;place-items:center;font:700 11px 'Space Grotesk',sans-serif}
  .yc-owner{font-size:9px;padding:1px 5px;border-radius:999px;background:var(--accent,#c8202f);color:var(--accent-ink,#fff);letter-spacing:.06em}
  .yc-body{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.4 Outfit,sans-serif}
  .yc-time{font:10px 'DM Mono',monospace;color:#71717a;margin-top:2px}
  .yc-del{position:absolute;top:4px;right:6px;border:0;background:transparent;color:#71717a;cursor:pointer;font-size:13px;opacity:0}
  .yc-msg:hover .yc-del,.yc-del:focus{opacity:1}
  .yc-empty,.yc-note{color:#a1a1aa;font:12px 'DM Mono',monospace;text-align:center;margin:auto 0}
  .yc-form{display:flex;gap:8px;padding:10px;border-top:2px solid #26262b;background:#161618}
  .yc-form textarea{flex:1;resize:none;height:40px;max-height:120px;border:2px solid #3f3f46;border-radius:10px;background:#0b0b0c;color:#f4f4f5;padding:9px 10px;font:14px Outfit,sans-serif}
  .yc-form textarea:focus{outline:none;border-color:#d4d4d8}
  .yc-form button{border:2px solid #d4d4d8;border-radius:10px;background:var(--accent,#c8202f);color:var(--accent-ink,#fff);font:700 11px 'DM Mono',monospace;text-transform:uppercase;padding:0 14px;cursor:pointer}
  .yc-form button:disabled{opacity:.5;cursor:default}
  .yc-err{color:var(--ui-bad,#fca5a5);font:11px 'DM Mono',monospace;padding:0 12px 8px;background:#161618}
  .yc-err:empty{display:none}
  @media (max-width:520px){.yc-fab{right:12px;bottom:12px;padding:11px 14px}.yc-panel{right:12px;bottom:66px}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const fab = el('button', 'yc-fab');
  fab.type = 'button';
  fab.setAttribute('aria-label', 'Buka live chat');
  const badge = el('span', 'yc-badge', '0');
  badge.hidden = true;
  fab.append(el('span', 'yc-dot'), el('span', '', 'Live chat'), badge);

  const panel = el('section', 'yc-panel');
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Live chat');
  const head = el('div', 'yc-head');
  const title = el('div');
  const online = el('small', '', 'lagi nyambung…');
  title.append(el('b', '', 'Live Chat'), el('br'), online);
  const close = el('button', 'yc-x', '×');
  close.type = 'button';
  close.setAttribute('aria-label', 'Tutup live chat');
  head.append(title, close);
  const list = el('div', 'yc-list');
  list.setAttribute('role', 'log');
  list.setAttribute('aria-live', 'polite');
  const err = el('div', 'yc-err');
  const form = el('form', 'yc-form');
  const input = el('textarea');
  input.maxLength = 500;
  input.placeholder = 'Tulis pesan…';
  input.setAttribute('aria-label', 'Pesan');
  const send = el('button', '', 'Kirim');
  send.type = 'submit';
  form.append(input, send);
  panel.append(head, list, err, form);
  document.body.append(panel, fab);

  let lastId = 0, open = false, unread = 0, timer = 0, busy = false, me = null, available = true;
  const seen = new Map();
  const timeOf = v => new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const atBottom = () => list.scrollHeight - list.scrollTop - list.clientHeight < 60;

  function render(m) {
    if (seen.has(m.id)) return;
    const box = el('div', 'yc-msg' + (m.mine ? ' mine' : ''));
    const who = el('div', 'yc-who');
    let av;
    if (m.avatar) { av = el('img', 'yc-av'); av.src = m.avatar; av.alt = ''; av.loading = 'lazy'; av.onerror = () => av.replaceWith(el('span', 'yc-av', (m.name || '?').charAt(0).toUpperCase())); }
    else av = el('span', 'yc-av', (m.name || '?').charAt(0).toUpperCase());
    const name = el('span', '', m.name);
    name.setAttribute('data-no-i18n', '');
    who.append(av, name);
    if (m.owner) who.append(el('span', 'yc-owner', 'DEVELOPER'));
    const body = el('div', 'yc-body', m.body);
    body.setAttribute('data-no-i18n', '');
    box.append(who, body, el('div', 'yc-time', timeOf(m.at)));
    if (m.mine || (me && me.owner)) {
      const del = el('button', 'yc-del', '✕');
      del.type = 'button';
      del.title = 'Hapus pesan';
      del.addEventListener('click', async () => {
        if (!confirm('Hapus pesan ini?')) return;
        const r = await fetch('/api/chat/' + m.id, { method: 'DELETE', credentials: 'same-origin' }).catch(() => null);
        if (r && r.ok) remove(m.id);
      });
      box.append(del);
    }
    list.querySelector('.yc-empty')?.remove();
    list.append(box);
    seen.set(m.id, box);
  }
  function remove(id) { const b = seen.get(id); if (b) { b.remove(); seen.delete(id); } }

  async function poll() {
    if (busy || !available) return;
    busy = true;
    try {
      const r = await fetch('/api/chat' + (lastId ? '?after=' + lastId : ''), { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json().catch(() => ({}));
      if (r.status === 503 && d.error === 'MIGRATION_REQUIRED') { available = false; list.replaceChildren(el('p', 'yc-note', 'Live chat belum aktif.')); online.textContent = 'offline'; return; }
      if (!r.ok) throw new Error(d.message || 'Chat gagal dimuat.');
      me = d.me;
      const stick = atBottom();
      const fresh = d.messages.filter(m => !seen.has(m.id));
      fresh.forEach(render);
      (d.deleted || []).forEach(remove);
      if (!lastId && !d.messages.length) list.replaceChildren(el('p', 'yc-empty', 'Belum ada pesan. Sapa yang lain dulu! 👋'));
      if (d.messages.length) lastId = Math.max(lastId, ...d.messages.map(m => m.id));
      online.textContent = `${d.online} online · kamu: ${d.me.name}`;
      if (!open && lastPolled) { unread += fresh.filter(m => !m.mine).length; badge.textContent = unread > 99 ? '99+' : String(unread); badge.hidden = unread === 0; }
      if (open && (stick || fresh.some(m => m.mine))) list.scrollTop = list.scrollHeight;
      lastPolled = true;
      err.textContent = '';
    } catch (e) {
      if (open) err.textContent = 'Koneksi chat putus, lagi nyoba lagi…';
    } finally {
      busy = false;
    }
  }
  let lastPolled = false;
  function schedule() {
    clearTimeout(timer);
    if (document.hidden || !available) return;
    timer = setTimeout(async () => { await poll(); schedule(); }, open ? 2500 : 12000);
  }
  function toggle(show) {
    open = show;
    panel.hidden = !show;
    fab.setAttribute('aria-expanded', String(show));
    if (show) {
      unread = 0; badge.hidden = true;
      poll().then(() => { list.scrollTop = list.scrollHeight; });
      setTimeout(() => input.focus(), 50);
    }
    schedule();
  }
  fab.addEventListener('click', () => toggle(!open));
  close.addEventListener('click', () => toggle(false));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); schedule(); });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;
    send.disabled = true;
    try {
      const r = await fetch('/api/chat', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { err.textContent = d.message || 'Pesan gagal dikirim.'; return; }
      input.value = '';
      err.textContent = '';
      render(d.message);
      lastId = Math.max(lastId, d.message.id);
      list.scrollTop = list.scrollHeight;
    } catch { err.textContent = 'Pesan gagal dikirim. Coba lagi ya.'; }
    finally { send.disabled = false; input.focus(); }
  });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  poll().then(schedule);
})();
