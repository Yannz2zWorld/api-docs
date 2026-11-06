(() => {
  'use strict';
  const { $, esc, api, toast, tierBadge, avatar, date } = Z;
  Z.nav(); Z.maintenanceBubble();
  const box = $('#msgs');
  let last = null, me = null, isDev = false, first = true;
  const users = new Map();

  const nearBottom = () => box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  function row(m) {
    users.set(m.user.id, m.user);
    const mine = m.user.id === me;
    const t = new Date(m.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `<div class="msg${mine ? ' me' : ''}${m.user.tier === 'developer' ? ' dev' : ''}" data-id="${esc(m.id)}">
      <span data-user="${esc(m.user.id)}">${avatar(m.user)}</span>
      <div><div class="who"><b data-user="${esc(m.user.id)}">${esc(m.user.username)}</b>${tierBadge(m.user.tier, m.user.tierName)}<span class="uid">${esc(m.user.id)}</span></div>
      <div class="bubble">${esc(m.text)}</div><time>${t}</time>${mine || isDev ? `<button class="del" data-del="${esc(m.id)}" title="Hapus">🗑</button>` : ''}</div></div>`;
  }
  async function poll() {
    try {
      const d = await api('/chat/messages' + (last ? '?after=' + last : ''));
      me = d.me; isDev = d.developer;
      const stick = first || nearBottom();
      if (first) box.innerHTML = d.messages.length ? '' : '<p class="empty" id="emptyNote">Belum ada pesan. Sapa duluan! 👋</p>';
      if (d.messages.length) { $('#emptyNote')?.remove(); box.insertAdjacentHTML('beforeend', d.messages.map(row).join('')); last = d.messages[d.messages.length - 1].id; }
      while (box.children.length > 300) box.firstElementChild.remove();
      if (stick) box.scrollTop = box.scrollHeight;
      first = false;
    } catch (e) { if (first) box.innerHTML = `<p class="empty">😵 ${esc(e.message)}</p>`; }
  }
  setInterval(() => { if (!document.hidden) poll(); }, 3000);
  poll();

  async function send() {
    const text = $('#text').value.trim();
    if (!text) return;
    $('#text').value = '';
    try { await api('/chat/messages', { method: 'POST', body: { text } }); await poll(); box.scrollTop = box.scrollHeight; }
    catch (e) { $('#text').value = text; toast(e.message, true); }
  }
  $('#form').onsubmit = e => { e.preventDefault(); send(); };
  $('#text').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });

  box.addEventListener('click', async e => {
    const d = e.target.closest('[data-del]');
    if (d && confirm('Hapus pesan ini?')) {
      try { await api('/chat/messages/' + d.dataset.del, { method: 'DELETE' }); d.closest('.msg').remove(); } catch (err) { toast(err.message, true); }
      return;
    }
    const u = e.target.closest('[data-user]');
    if (u) {
      const info = users.get(u.dataset.user);
      $('#userBody').innerHTML = `<div style="text-align:center">${avatar(info, 'lg').replace('class="avatar lg"', 'class="avatar lg" style="margin:0 auto 10px"')}
        <h2 style="margin:0">${esc(info.username)}</h2><div class="row" style="justify-content:center;margin:8px 0">${tierBadge(info.tier, info.tierName)}<span class="badge">ID ${esc(info.id)}</span></div>
        <p class="muted small">Gabung ${date(info.joinedAt)}</p><button class="btn btn-sm" data-copy="${esc(info.id)}">Salin ID</button></div>`;
      $('#userModal').showModal();
    }
  });
})();
