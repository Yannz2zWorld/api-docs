// Announcement cards on the sign-in page and Home, in the site's flat style (hard shadows, stripes,
// no glow):
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
    megaphone: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9"/></svg>'
  };
  const CSS = `
  .yz-ann-back{position:fixed;inset:0;z-index:600;display:grid;place-items:center;padding:16px;background:rgba(10,10,12,.62);overflow:auto}
  .yz-ann{width:min(440px,100%);margin:auto;background:var(--surface,var(--paper,#141416));color:var(--ink,#f4f4f5);border:3px solid var(--edge,#d4d4d8);border-radius:18px;box-shadow:8px 8px 0 var(--drop,#3f3f46);overflow:hidden;font:500 14px/1.5 Outfit,system-ui,sans-serif;text-align:left}
  .yz-ann-tape{height:12px;border-bottom:3px solid var(--edge,#d4d4d8);background:repeating-linear-gradient(-45deg,var(--accent,#c8202f) 0 11px,var(--ink,#f4f4f5) 11px 22px)}
  .yz-ann-head{display:grid;grid-template-columns:auto 1fr auto;gap:14px;align-items:center;padding:18px;border-bottom:3px solid var(--edge,#d4d4d8);background:repeating-linear-gradient(-45deg,color-mix(in srgb,var(--accent,#c8202f) 15%,var(--surface,var(--paper,#141416))) 0 14px,color-mix(in srgb,var(--accent,#c8202f) 6%,var(--surface,var(--paper,#141416))) 14px 28px)}
  .yz-ann-ico{width:54px;height:54px;display:grid;place-items:center;border-radius:13px;background:var(--ink,#f4f4f5);color:var(--accent,#c8202f);border:3px solid var(--edge,#d4d4d8);box-shadow:4px 4px 0 var(--drop,#3f3f46)}
  .yz-ann-head h2{margin:0;font:800 22px/1.05 'Space Grotesk',system-ui,sans-serif;letter-spacing:-.01em;text-transform:uppercase}
  .yz-ann-head p{margin:5px 0 0;font:700 11px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#a1a1aa)}
  .yz-ann-head p b{color:var(--ink,#f4f4f5)}
  .yz-ann-x{width:42px;height:42px;display:grid;place-items:center;padding:0;border:3px solid var(--edge,#d4d4d8);border-radius:11px;background:var(--surface,var(--paper,#141416));color:inherit;box-shadow:3px 3px 0 var(--drop,#3f3f46);cursor:pointer}
  .yz-ann-body{padding:18px}
  .yz-ann-card{border:3px solid var(--edge,#d4d4d8);border-radius:14px;padding:14px 16px;background:var(--surface-2,#1b1b1e);box-shadow:5px 5px 0 var(--drop,#3f3f46)}
  .yz-ann-top{display:flex;justify-content:space-between;align-items:center;gap:10px;padding-bottom:12px;border-bottom:2px dashed var(--edge-soft,#3f3f46)}
  .yz-ann-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:2px solid var(--edge,#d4d4d8);border-radius:8px;background:var(--accent,#c8202f);color:var(--accent-ink,#fff);font:800 11px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;box-shadow:2px 2px 0 var(--drop,#3f3f46)}
  .yz-ann-date{font:600 12px 'DM Mono',monospace;color:var(--muted,#a1a1aa);text-align:right}
  .yz-ann-sec{padding-top:12px}
  .yz-ann-sec+.yz-ann-sec{margin-top:12px;border-top:2px dashed var(--edge-soft,#3f3f46)}
  .yz-ann-label{display:block;margin:0 0 4px;font:800 11px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#a1a1aa)}
  .yz-ann-msg{margin:0;font-size:15px;font-weight:600;white-space:pre-line;overflow-wrap:anywhere}
  .yz-ann-when{display:flex;gap:10px;align-items:flex-start;margin-top:14px;padding:10px 12px;border:2px solid var(--edge-soft,#3f3f46);border-radius:10px;background:repeating-linear-gradient(90deg,transparent 0 10px,color-mix(in srgb,var(--edge-soft,#3f3f46) 35%,transparent) 10px 11px)}
  .yz-ann-when svg{flex:none;margin-top:2px}
  .yz-ann-when b{display:block;font:800 11px 'DM Mono',monospace;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#a1a1aa)}
  .yz-ann-when span{font-weight:700}
  .yz-ann-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-top:18px;padding:13px 16px;border:3px solid var(--edge,#d4d4d8);border-radius:12px;background:var(--surface,var(--paper,#141416));color:var(--ink,#f4f4f5);font:800 14px 'DM Mono',monospace;letter-spacing:.1em;text-transform:uppercase;text-decoration:none;box-shadow:4px 4px 0 var(--drop,#3f3f46);cursor:pointer}
  .yz-ann-btn i{width:22px;height:22px;display:grid;place-items:center;border-radius:50%;background:var(--ink,#f4f4f5);color:var(--surface,var(--paper,#141416))}
  .yz-ann-btn.p{background:var(--accent,#c8202f);color:var(--accent-ink,#fff)}
  .yz-ann-btn.p i{background:var(--accent-ink,#fff);color:var(--accent,#c8202f)}
  .yz-ann-btn:active,.yz-ann-x:active{transform:translate(3px,3px);box-shadow:1px 1px 0 var(--drop,#3f3f46)}
  .yz-ann-btn+.yz-ann-btn{margin-top:10px}
  @media (max-width:380px){.yz-ann-head{grid-template-columns:auto 1fr;}.yz-ann-x{grid-row:1;grid-column:2;justify-self:end}.yz-ann-head h2{font-size:19px}}`;

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
      <div class="yz-ann-tape"></div>
      <div class="yz-ann-head">
        <div class="yz-ann-ico">${ICON.megaphone}</div>
        <div><h2 id="yz-ann-title">${esc(t('Pengumuman Dev'))}</h2><p>${kind === 'maintenance' ? `${esc(t('Mode'))} : <b>Maintenance ON</b>` : esc(t('Info dari developer'))}</p></div>
        <button type="button" class="yz-ann-x" aria-label="${esc(t('Tutup'))}">${ICON.x}</button>
      </div>
      <div class="yz-ann-body">
        <div class="yz-ann-card">
          <div class="yz-ann-top"><span class="yz-ann-chip">${ICON.megaphone.replace(/26/g, '14')}${esc(chip)}</span>${date ? `<span class="yz-ann-date">${esc(date)}</span>` : ''}</div>
          ${sections.map(s => `<div class="yz-ann-sec"><span class="yz-ann-label">${esc(t(s.label))}</span><p class="yz-ann-msg" data-no-i18n>${esc(s.text)}</p></div>`).join('')}
          ${start ? `<div class="yz-ann-when">${ICON.clock}<div><b>${esc(t('Maintenance dimulai'))}</b><span>${esc(t('Jam'))} ${esc(start.time)} · ${esc(start.date)}</span></div></div>` : ''}
        </div>
        ${buttons.map(b => b.href
          ? `<a class="yz-ann-btn p" href="${esc(b.href)}"${/^https?:/i.test(b.href) ? ' target="_blank" rel="noopener noreferrer"' : ''} data-close><span data-no-i18n>${esc(b.label)}</span><i>${ICON.arrow}</i></a>`
          : `<button type="button" class="yz-ann-btn" data-close><i>${ICON.check}</i>${esc(t(b.label))}</button>`).join('')}
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
      kind: 'dev', chip: 'Info', date: at ? at.short : '',
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
