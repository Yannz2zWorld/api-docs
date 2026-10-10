// Announcement cards on the sign-in page and Home, drawn as a memo sheet in the site's flat style
// (ruled lines, hard shadows, no glow):
//   - Maintenance: "Pengumuman Dev · Mode: Maintenance ON", the developer's message, when maintenance
//     started (time, date, month, year) and a "Dimengerti" button. Visitors see it on every visit while
//     maintenance is on; the developer (who can still use the site) once per session.
//   - Pengumuman Dev from the Developer panel: message, optional second message and a button that opens
//     the link the developer chose. Shown until the visitor closes it; a new announcement shows again.
// Data: window.__yannzAnnounce (put in the page by the server during maintenance) and GET /auth/announce.
(() => {
  if (window.YannzAnnounce) return;
  const SEEN = 'yannz-announce-seen', SEEN_MAINT = 'yannz-maint-seen';
  const store = (s, k, v) => { try { if (v === undefined) return s.getItem(k); s.setItem(k, v); } catch { /* private mode */ } return null; };
  const t = s => (window.YannzI18n ? window.YannzI18n.t(s) : s);
  const en = () => window.YannzI18n?.lang === 'en';
  const ICON = {
    x: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  // A memo sheet: ruled lines with a margin line, a masthead with a double rule and a barcode,
  // "label ....... value" rows and a tear line above the button. Flat: hard shadows, no glow.
  const SURF = 'var(--surface,var(--paper,#141416))', EDGE = 'var(--edge,#d4d4d8)', SOFT = 'var(--edge-soft,#3f3f46)', ACC = 'var(--accent,#c8202f)';
  const CSS = `
  .yz-ann-back{position:fixed;inset:0;z-index:600;display:grid;place-items:center;padding:16px;background:rgba(10,10,12,.62);overflow:auto}
  .yz-ann{width:min(430px,100%);margin:auto;background:${SURF};color:var(--ink,#f4f4f5);border:3px solid ${EDGE};border-radius:6px;box-shadow:10px 10px 0 var(--drop,#3f3f46);font:500 14px/1.5 Outfit,system-ui,sans-serif;text-align:left}
  .yz-ann-head{display:grid;grid-template-columns:1fr auto auto;gap:12px;align-items:center;padding:14px 14px 12px 16px;border-left:10px solid ${ACC};border-bottom:6px double ${EDGE};background:var(--surface-2,#1b1b1e)}
  .yz-ann-head h2{margin:0;font:800 15px/1.2 'DM Mono',monospace;letter-spacing:.16em;text-transform:uppercase}
  .yz-ann-head p{margin:3px 0 0;font:600 11px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#a1a1aa)}
  .yz-ann-code{width:46px;height:28px;background:repeating-linear-gradient(90deg,var(--ink,#f4f4f5) 0 2px,transparent 2px 4px,var(--ink,#f4f4f5) 4px 5px,transparent 5px 7px,var(--ink,#f4f4f5) 7px 10px,transparent 10px 12px)}
  .yz-ann-x{width:34px;height:34px;display:grid;place-items:center;padding:0;border:2px solid ${EDGE};border-radius:50%;background:${SURF};color:inherit;cursor:pointer}
  .yz-ann-x:hover{background:${ACC};color:var(--accent-ink,#fff);border-color:${ACC}}
  .yz-ann-sheet{padding:10px 18px 14px 40px;line-height:28px;background:linear-gradient(90deg,transparent 26px,${ACC} 26px 28px,transparent 28px),repeating-linear-gradient(180deg,transparent 0 27px,color-mix(in srgb,${SOFT} 70%,transparent) 27px 28px);background-position:0 10px}
  .yz-ann-row{display:flex;align-items:baseline;gap:8px}
  .yz-ann-row b,.yz-ann-label{font:800 11px/28px 'DM Mono',monospace;letter-spacing:.12em;text-transform:uppercase;color:var(--muted,#a1a1aa);white-space:nowrap}
  .yz-ann-row i{flex:1;min-width:16px;border-bottom:2px dotted ${SOFT};transform:translateY(-6px)}
  .yz-ann-row span{font:800 12px/28px 'DM Mono',monospace;letter-spacing:.06em;text-align:right}
  .yz-ann-row span.on{padding:0 8px;line-height:22px;border:2px solid ${ACC};color:${ACC};text-transform:uppercase}
  .yz-ann-label{display:block}
  .yz-ann-msg{margin:0;font-size:15px;font-weight:600;line-height:28px;white-space:pre-line;overflow-wrap:anywhere}
  .yz-ann-tear{height:0;margin:0 14px;border-top:3px dashed ${SOFT}}
  .yz-ann-foot{padding:14px 16px 16px}
  .yz-ann-btn{display:grid;grid-template-columns:48px 1fr auto;align-items:stretch;width:100%;padding:0;border:3px solid ${EDGE};border-radius:6px;background:${SURF};color:var(--ink,#f4f4f5);font:800 13px 'DM Mono',monospace;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;text-align:left;box-shadow:5px 5px 0 var(--drop,#3f3f46);cursor:pointer;overflow:hidden}
  .yz-ann-btn i{display:grid;place-items:center;background:${ACC};color:var(--accent-ink,#fff);border-right:3px solid ${EDGE}}
  .yz-ann-btn span{padding:13px 14px}
  .yz-ann-btn:active,.yz-ann-x:active{transform:translate(3px,3px);box-shadow:2px 2px 0 var(--drop,#3f3f46)}
  .yz-ann-btn+.yz-ann-btn{margin-top:10px}
  @media (max-width:360px){.yz-ann-code{display:none}.yz-ann-sheet{padding-left:34px;background-position:0 10px}}`;

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function when(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return null;
    const loc = en() ? 'en-GB' : 'id-ID';
    return {
      time: new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(d),
      date: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(d),
      short: new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
    };
  }
  // Only links to a page here or an http(s) address (also checked on the server).
  const safeUrl = u => (/^\/(?!\/)\S*$/.test(u) || /^https?:\/\/[^\s/]+\S*$/i.test(u) ? u : '');

  let open = null;
  function card({ kind, chip, date, sections, when: start, buttons, onClose }) {
    if (!document.getElementById('yz-ann-css')) { const st = document.createElement('style'); st.id = 'yz-ann-css'; st.textContent = CSS; document.head.append(st); }
    const back = document.createElement('div');
    back.className = 'yz-ann-back';
    back.innerHTML = `<div class="yz-ann" role="dialog" aria-modal="true" aria-labelledby="yz-ann-title" data-kind="${kind}">
      <div class="yz-ann-head">
        <div><h2 id="yz-ann-title">${esc(t('Pengumuman Dev'))}</h2><p>${date ? esc(date) : esc(t('Info dari developer'))}</p></div>
        <div class="yz-ann-code" aria-hidden="true"></div>
        <button type="button" class="yz-ann-x" aria-label="${esc(t('Tutup'))}">${ICON.x}</button>
      </div>
      <div class="yz-ann-sheet">
        ${chip ? `<div class="yz-ann-row"><b>${esc(t('Mode'))}</b><i></i><span class="on">${esc(chip)}</span></div>` : ''}
        ${sections.map(s => `<div class="yz-ann-sec"><span class="yz-ann-label">${esc(t(s.label))}</span><p class="yz-ann-msg" data-no-i18n>${esc(s.text)}</p></div>`).join('')}
        ${start ? `<div class="yz-ann-row"><b>${esc(t('Maintenance dimulai'))}</b><i></i><span>${esc(t('Jam'))} ${esc(start.time)}</span></div><div class="yz-ann-row"><b>${esc(t('Tanggal'))}</b><i></i><span>${esc(start.date)}</span></div>` : ''}
      </div>
      <div class="yz-ann-tear" aria-hidden="true"></div>
      <div class="yz-ann-foot">
        ${buttons.map(b => b.href
          ? `<a class="yz-ann-btn p" href="${esc(b.href)}"${/^https?:/i.test(b.href) ? ' target="_blank" rel="noopener noreferrer"' : ''} data-close><i>${ICON.arrow}</i><span data-no-i18n>${esc(b.label)}</span></a>`
          : `<button type="button" class="yz-ann-btn" data-close><i>${ICON.check}</i><span>${esc(t(b.label))}</span></button>`).join('')}
      </div></div>`;
    const close = () => { back.remove(); document.removeEventListener('keydown', key); open = null; onClose?.(); };
    const key = e => { if (e.key === 'Escape') close(); };
    back.querySelector('.yz-ann-x').addEventListener('click', close);
    back.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', close));
    back.addEventListener('click', e => { if (e.target === back) close(); });
    document.addEventListener('keydown', key);
    document.body.append(back);
    open = back;
    (back.querySelector('.yz-ann-btn') || back.querySelector('.yz-ann-x')).focus({ preventScroll: true });
  }

  function maintenance(m, next) {
    const start = m.since ? when(m.since) : null;
    card({
      kind: 'maintenance', chip: 'Maintenance ON', date: start ? start.short : '',
      sections: [{ label: 'Pesan dev', text: m.message }], when: start,
      buttons: [{ label: 'Dimengerti' }], onClose: next
    });
  }
  function dev(a, next) {
    const at = a.at ? when(a.at) : null;
    const href = safeUrl(a.buttonUrl || '');
    card({
      kind: 'dev', chip: '', date: at ? at.short : '',
      sections: [{ label: 'Pesan', text: a.message }, ...(a.message2 ? [{ label: 'Pesan 2', text: a.message2 }] : [])],
      buttons: href ? [{ href, label: a.buttonLabel || t('Buka') }] : [{ label: 'Dimengerti' }],
      onClose: () => { store(localStorage, SEEN, a.id); next?.(); }
    });
  }

  function show(data) {
    if (open || !data) return;
    const queue = [];
    const pinned = window.__yannzAnnounce?.maintenance;      // the page itself is closed for maintenance
    const m = data.maintenance;
    if (m && (pinned || store(sessionStorage, SEEN_MAINT) !== String(m.since || m.message))) {
      queue.push(next => { if (!pinned) store(sessionStorage, SEEN_MAINT, String(m.since || m.message)); maintenance(m, next); });
    }
    const a = data.announcement;
    if (a && store(localStorage, SEEN) !== a.id) queue.push(next => dev(a, next));
    const run = () => { const f = queue.shift(); if (f) f(run); };
    run();
  }

  // After the page-load intro (slash / aura), so the card is not hidden under it.
  const afterIntro = cb => (window.__slashDone || !document.getElementById('slash-intro') ? cb() : document.addEventListener('slash:done', cb, { once: true }));
  function boot() {
    const embedded = window.__yannzAnnounce;
    const show2 = d => afterIntro(() => show(d));
    fetch('/auth/announce', { credentials: 'same-origin', cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => show2(d ? { maintenance: d.maintenance || embedded?.maintenance || null, announcement: d.announcement || null } : embedded))
      .catch(() => show2(embedded));
  }
  window.YannzAnnounce = { show, boot };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
