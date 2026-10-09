// "Not a robot" box (services/humanCheckService.js). YannzHuman.json(url, mount) fetches JSON; when
// the server answers 403 HUMAN_CHECK_REQUIRED, a small check box (Cloudflare style, inside the page,
// never full screen) appears in `mount`. Once it's passed the request is made again.
//   - Turnstile mode: the real Cloudflare Turnstile widget.
//   - Built-in mode: tick the box; the browser solves a small puzzle (a second or two), which a
//     plain scraper never runs.
(() => {
  if (window.YannzHuman) return;
  const css = document.createElement('style');
  css.textContent = `.hc-box{display:flex;align-items:center;gap:14px;max-width:360px;margin:0 0 18px;padding:14px 16px;border:2px solid var(--edge-soft,#3f3f46);border-radius:10px;background:var(--surface,#141416);color:var(--ink,#f4f4f5);font:500 14px Outfit,system-ui,sans-serif}
  .hc-box[hidden]{display:none}
  .hc-tick{flex:none;width:28px;height:28px;border:2px solid var(--muted,#a1a1aa);border-radius:6px;background:transparent;display:grid;place-items:center;cursor:pointer;padding:0;color:inherit}
  .hc-tick:focus-visible{outline:2px solid var(--accent,#c8202f);outline-offset:2px}
  .hc-tick[data-state=busy]{border-color:transparent;border-top-color:var(--accent,#c8202f);border-radius:50%;animation:hc-spin .8s linear infinite;cursor:wait}
  .hc-tick[data-state=ok]{border-color:#16a34a;background:#16a34a;color:#fff}
  .hc-text{flex:1;min-width:0}
  .hc-text b{display:block;font-weight:600}
  .hc-text small{display:block;color:var(--muted,#a1a1aa);font-size:12px;margin-top:2px}
  .hc-brand{flex:none;text-align:right;font:500 9px 'DM Mono',ui-monospace,monospace;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#a1a1aa);line-height:1.5}
  .hc-brand svg{display:block;margin:0 0 2px auto}
  .hc-err{color:var(--bad,#fca5a5)!important}
  .hc-ts{flex:1;min-height:65px}
  @keyframes hc-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.hc-tick[data-state=busy]{animation:none;border-color:var(--accent,#c8202f)}}`;
  document.head.append(css);

  const shield = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>';
  const tickMark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

  async function digest(text) { return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))); }
  function zeroBits(buf) { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; }
  async function solvePuzzle({ salt, bits }) {
    for (let i = 0; ; i++) {
      const nonce = i.toString(36);
      if (zeroBits(await digest(`${salt}:${nonce}`)) >= bits) return nonce;
      if (i % 2000 === 1999) await new Promise(r => setTimeout(r));   // keep the page responsive
    }
  }
  async function send(body) {
    const r = await fetch('/human-check', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { ok: r.ok && d.success, d };
  }

  let waiting = null;   // one box for every request waiting on it
  function showBox(mount, check) {
    if (waiting) return waiting;
    waiting = new Promise(resolve => {
      const box = document.createElement('div');
      box.className = 'hc-box';
      box.setAttribute('role', 'group');
      box.setAttribute('aria-label', 'Verifikasi keamanan');
      box.innerHTML = `<button type="button" class="hc-tick" aria-label="Saya bukan robot"></button><div class="hc-text"><b>Saya bukan robot</b><small>Centang dulu buat lihat daftar endpoint.</small></div><div class="hc-brand">${shield}Yannz<br>Shield</div>`;
      (mount || document.querySelector('main') || document.body).prepend(box);
      const tick = box.querySelector('.hc-tick'), note = box.querySelector('small');
      const done = () => { tick.dataset.state = 'ok'; tick.innerHTML = tickMark; note.className = ''; note.textContent = 'Berhasil. Kamu bukan robot.'; setTimeout(() => box.remove(), 1200); waiting = null; resolve(); };
      const failed = (msg, next) => { tick.dataset.state = ''; tick.disabled = false; note.className = 'hc-err'; note.textContent = msg || 'Verifikasinya gagal. Coba lagi ya.'; if (next) check = next; };

      if (check && check.mode === 'turnstile') {
        tick.remove();
        box.querySelector('.hc-text').outerHTML = '<div class="hc-ts"></div>';
        const host = box.querySelector('.hc-ts');
        const render = () => window.turnstile.render(host, { sitekey: check.siteKey, theme: 'dark', size: 'flexible', language: 'id',
          callback: async token => { const r = await send({ turnstileToken: token }); if (r.ok) { box.remove(); waiting = null; resolve(); } else { try { window.turnstile.reset(); } catch {} } } });
        if (window.turnstile) render();
        else { const s = document.createElement('script'); s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; s.async = true; s.onload = render; document.head.append(s); }
        return;
      }
      tick.addEventListener('click', async () => {
        if (tick.dataset.state) return;
        tick.dataset.state = 'busy'; tick.disabled = true; note.className = ''; note.textContent = 'Lagi ngecek…';
        try {
          const nonce = await solvePuzzle(check);
          const r = await send({ salt: check.salt, nonce });
          if (r.ok) done(); else failed(r.d.message, r.d.check);
        } catch { failed(); }
      });
    });
    return waiting;
  }

  // fetch + JSON that passes the check when asked and then asks again.
  async function json(url, mount, opts = {}) {
    for (let round = 0; round < 3; round++) {
      const r = await fetch(url, { credentials: 'same-origin', ...opts });
      const d = await r.json().catch(() => ({}));
      if (r.status === 403 && d.error === 'HUMAN_CHECK_REQUIRED') { await showBox(mount, d.check); continue; }
      return d;
    }
    throw new Error('HUMAN_CHECK_REQUIRED');
  }
  window.YannzHuman = { json };
})();
