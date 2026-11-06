(() => {
  'use strict';
  const { $, esc, api, busy, toast, rupiah, num } = Z;
  Z.nav(); Z.maintenanceBubble();
  const EMOJI = { free: '🌱', basic: '⭐', premium: '💎', super: '🚀', nebula: '🌌', freedom: '👑' };
  let PAY = [], PLANS = [], order = null;

  async function load() {
    const [d, me] = await Promise.all([api('/billing/plans'), Z.me(true)]);
    PAY = d.payments; PLANS = d.plans;
    $('#days').textContent = d.days;
    $('#bal').textContent = rupiah(me.user.balance);
    const cur = me.user.tier;
    $('#plans').innerHTML = d.plans.map(p => `<div class="card plan${p.id === cur ? ' current' : ''}">
      ${p.id === cur ? '<span class="badge ok ribbon">Plan kamu</span>' : p.id === 'premium' ? '<span class="badge wait ribbon">Populer</span>' : ''}
      <div class="row"><span style="font-size:30px">${EMOJI[p.id] || '✨'}</span><span class="tier tier-${p.id}">${esc(p.name)}</span></div>
      <div class="price">${p.price ? rupiah(p.price) : 'Gratis'}${p.price ? `<small> / ${d.days} hari</small>` : ''}</div>
      <ul>${p.perks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      ${p.price ? `<button class="btn btn-pink btn-block" data-buy="${p.id}">Bayar pakai saldo</button>
        <button class="btn btn-ghost btn-block" data-manual="${p.id}">Transfer manual</button>` : '<button class="btn btn-ghost btn-block" disabled>Sudah termasuk</button>'}
    </div>`).join('');
    if (me.user.isDeveloper) $('#plans').insertAdjacentHTML('afterbegin', '<div class="card" style="grid-column:1/-1;background:#1d1a2f;color:#ffd84d">🛠️ Kamu developer: finansial freedom, semua endpoint sudah terbuka.</div>');
  }

  function openPay(kind, tier, amount) {
    if (!PAY.length) return toast('Metode pembayaran belum diatur developer. Tanya di Live chat ya.', true);
    order = { kind, tier, amount };
    const plan = PLANS.find(p => p.id === tier);
    $('#payTitle').textContent = kind === 'plan' ? `Beli plan ${plan.name}` : 'Top up saldo';
    $('#payDesc').innerHTML = `Transfer <b>${rupiah(amount)}</b> ke salah satu:`;
    $('#pmList').innerHTML = PAY.map((p, i) => `<label class="pm"><input type="radio" name="pm" value="${esc(p.id)}"${i ? '' : ' checked'}>
      <div style="flex:1;min-width:0"><b>${esc(p.name)}</b> · ${esc(p.holder)}<div class="mono small" style="overflow-wrap:anywhere">${esc(p.number)}</div>${p.note ? `<div class="small muted">${esc(p.note)}</div>` : ''}</div>
      <button type="button" class="btn btn-sm" data-copy="${esc(p.number)}">Salin</button></label>`).join('');
    $('#payModal').showModal();
  }

  document.addEventListener('click', e => {
    const b = e.target.closest('[data-buy]');
    if (b) {
      const card = b.closest('.plan');
      if (!confirm(`Beli plan ${card.querySelector('.tier').textContent} pakai saldo?`)) return;
      busy(b, async () => { const d = await api('/billing/buy', { method: 'POST', body: { tier: b.dataset.buy } }); toast(d.message); await load(); });
    }
    const m = e.target.closest('[data-manual]');
    if (m) openPay('plan', m.dataset.manual, PLANS.find(p => p.id === m.dataset.manual).price);
  });
  $('#topBtn').onclick = () => {
    const a = Math.floor(Number($('#topAmount').value));
    if (!(a >= 1000)) return toast('Top up minimal Rp1.000.', true);
    openPay('topup', null, a);
  };
  $('#paySend').onclick = e => busy(e.currentTarget, async () => {
    const method = document.querySelector('input[name=pm]:checked')?.value;
    const d = await api('/billing/order', { method: 'POST', body: { ...order, method, sender: $('#paySender').value, note: $('#payNote').value } });
    $('#payModal').close(); toast(d.message);
  });
  load().catch(e => toast(e.message, true));
})();
