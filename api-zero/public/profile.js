(() => {
  'use strict';
  const { $, esc, api, busy, toast, rupiah, num, date, dateTime, tierBadge, avatar } = Z;
  Z.nav(); Z.maintenanceBubble();
  const STATUS = { pending: ['wait', 'Menunggu'], approved: ['ok', 'Berhasil'], rejected: ['bad', 'Ditolak'], cancelled: ['', 'Dibatalkan'] };

  async function load() {
    const d = await Z.me(true);
    const u = d.user, p = d.plan;
    $('#top').innerHTML = `${avatar(u, 'lg')}<div><h1>${esc(u.username)}</h1><div class="row" style="margin-top:6px">${tierBadge(u.tier, u.tierName)}<span class="badge">ID ${esc(u.id)}</span><button class="btn btn-sm btn-ghost" data-copy="${esc(u.id)}">Salin ID</button></div></div>
      <span class="spacer"></span><div class="stat" style="min-width:180px"><b>${rupiah(u.balance)}</b><span>saldo</span></div>`;
    $('#info').innerHTML = [
      ['ID', esc(u.id)], ['Username', esc(u.username)], ['Email', esc(u.email || '-')], ['No. HP', esc(u.phone || '-')],
      ['Plan', `${tierBadge(u.tier, u.tierName)}${u.tierExpiresAt ? ` <span class="small muted">s/d ${date(u.tierExpiresAt)}</span>` : ''}`],
      ['Kuota', `${num(d.usage.today)} / ${d.usage.limit ? num(d.usage.limit) : '∞'} hari ini`],
      ['Saldo', rupiah(u.balance)], ['Login', u.google ? 'Google' + (u.hasPassword ? ' + sandi' : '') : 'Username & sandi'], ['Gabung', date(u.joinedAt)]
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('#newName').value = u.username;
    $('#curWrap').classList.toggle('hidden', !u.hasPassword);

    $('#keyCount').textContent = `${d.keys.length} / ${p.maxKeys ?? '∞'}`;
    $('#keyList').innerHTML = d.keys.length ? d.keys.map(k => `<div class="key-item">
        <code>${esc(k.key)}</code>
        <span class="badge">${esc(k.label || 'Key')}</span>${k.custom ? '<span class="badge">custom</span>' : ''}
        <span class="small muted">${k.lastUsedAt ? 'dipakai ' + dateTime(k.lastUsedAt) : 'belum dipakai'}</span>
        <button class="btn btn-sm" data-copy="${esc(k.key)}">Salin</button>
        <button class="btn btn-sm btn-red" data-del-key="${esc(k.id)}">Hapus</button></div>`).join('')
      : '<p class="empty">Belum ada key. Buat satu di bawah</p>';
    $('#keyCustom').disabled = !p.customKey;
    $('#customNote').textContent = p.customKey ? '' : '(mulai plan Premium)';

    $('#orders').innerHTML = d.orders.length ? `<div class="table-wrap"><table><thead><tr><th>#</th><th>Pesanan</th><th>Jumlah</th><th>Metode</th><th>Status</th><th>Tanggal</th><th></th></tr></thead><tbody>${d.orders.map(o => {
      const [cls, label] = STATUS[o.status] || ['', o.status];
      return `<tr><td>${esc(o.id)}</td><td>${o.kind === 'plan' ? 'Plan ' + esc(o.tier) : 'Top up saldo'}</td><td>${rupiah(o.amount)}</td><td>${esc(o.method || '-')}</td>
        <td><span class="badge ${cls}">${label}</span>${o.admin_note ? `<div class="small muted">${esc(o.admin_note)}</div>` : ''}</td><td>${dateTime(o.created_at)}</td>
        <td>${o.status === 'pending' ? `<button class="btn btn-sm btn-ghost" data-cancel="${esc(o.id)}">Batal</button>` : ''}</td></tr>`;
    }).join('')}</tbody></table></div>` : '<p class="empty">Belum ada pesanan. <a href="/price">Lihat plan</a></p>';
    if (location.hash === '#keys') $('#keys').scrollIntoView();
  }

  document.addEventListener('click', e => {
    const del = e.target.closest('[data-del-key]');
    if (del && confirm('Hapus API key ini? Aplikasi yang memakainya akan berhenti jalan.')) busy(del, async () => { await api('/me/keys/' + del.dataset.delKey, { method: 'DELETE' }); toast('Key dihapus.'); await load(); });
    const c = e.target.closest('[data-cancel]');
    if (c && confirm('Batalkan pesanan ini?')) busy(c, async () => { await api(`/billing/order/${c.dataset.cancel}/cancel`, { method: 'POST', body: {} }); await load(); });
  });
  $('#keyForm').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
    await api('/me/keys', { method: 'POST', body: { label: $('#keyLabel').value, custom: $('#keyCustom').value.trim() || undefined } });
    $('#keyLabel').value = ''; $('#keyCustom').value = ''; toast('Key baru dibuat!'); await load();
  }); };
  $('#nameForm').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => { const d = await api('/me', { method: 'PATCH', body: { username: $('#newName').value.trim().toLowerCase() } }); toast(d.message); await load(); }); };
  $('#passForm').onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => {
    const d = await api('/me/password', { method: 'POST', body: { current: $('#curPass').value, password: $('#newPass').value } });
    toast(d.message); $('#curPass').value = ''; $('#newPass').value = ''; await load();
  }); };

  // Kecilkan foto ke 256x256 di browser sebelum upload.
  $('#avatarFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => busy(null, async () => {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const s = Math.min(img.width, img.height);
      c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
      let data = c.toDataURL('image/webp', 0.85);
      if (!data.startsWith('data:image/webp')) data = c.toDataURL('image/jpeg', 0.85);
      await api('/me/avatar', { method: 'POST', body: { image: data } });
      URL.revokeObjectURL(img.src); toast('Foto profil diganti!'); location.reload();
    });
    img.onerror = () => toast('File itu bukan gambar.', true);
    img.src = URL.createObjectURL(f);
  };
  $('#avatarDel').onclick = e => busy(e.currentTarget, async () => { await api('/me/avatar', { method: 'DELETE' }); location.reload(); });

  load().catch(e => toast(e.message, true));
})();
