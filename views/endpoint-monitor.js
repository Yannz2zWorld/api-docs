// ~/endpoints monitor on the dashboard: a terminal that walks through every endpoint with its
// latest real HTTP status (GET /api/endpoints/status: real calls of the last 24 hours and the
// endpoint checks). Nothing is invented: endpoints without data say IDLE, disabled ones OFF.
(() => {
  const box = document.getElementById('ep-monitor');
  if (!box) return;
  const body = box.querySelector('.epm-body');
  const clock = box.querySelector('.epm-clock');
  const sum = document.querySelector('.epm-summary') || document.createElement('span');
  const STEP_MS = 320, MAX_LINES = 60, REFRESH_MS = 30000;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const tick = () => { clock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); };
  tick(); setInterval(tick, 1000);

  const el = (cls, text, data) => { const d = document.createElement('div'); d.className = cls; if (data) d.setAttribute('data-no-i18n', ''); d.textContent = text; return d; };
  function push(node) {
    body.append(node);
    while (body.children.length > MAX_LINES) body.firstChild.remove();
    body.scrollTop = body.scrollHeight;
  }
  function line(ep) {
    const d = document.createElement('div');
    d.className = 'epm-line';
    d.setAttribute('data-no-i18n', '');
    const ms = ep.ms != null ? ` (${ep.ms}ms)` : '';
    d.innerHTML = '<span class="epm-arrow">→</span> <span class="epm-method"></span> <span class="epm-path"></span> <span class="epm-code"></span><span class="epm-ms"></span>';
    d.querySelector('.epm-method').textContent = ep.method;
    d.querySelector('.epm-path').textContent = ep.path;
    const code = d.querySelector('.epm-code');
    code.textContent = `[${ep.text}]`;
    code.dataset.state = ep.state;
    d.querySelector('.epm-ms').textContent = ms;
    if (ep.at) d.title = `${ep.source === 'live' ? (en() ? 'Real request' : 'Request asli') : (en() ? 'Endpoint check' : 'Cek endpoint')} · ${new Date(ep.at).toLocaleString('id-ID')}`;
    return d;
  }

  let timer = null;
  async function load() {
    try {
      const r = await fetch('/api/endpoints/status', { credentials: 'same-origin' });
      const d = await r.json();
      if (!r.ok || !d.success) throw new Error(d.message || 'gagal');
      return d;
    } catch { return null; }
  }
  const en = () => window.YannzI18n?.lang === 'en';
  function summary(s) {
    const parts = [`${s.total} endpoint${en() && s.total !== 1 ? 's' : ''}`, `${s.ok || 0} OK`];
    if (s.warn) parts.push(`${s.warn} warning`);
    if (s.down) parts.push(`${s.down} error`);
    if (s.idle) parts.push(en() ? `${s.idle} not checked yet` : `${s.idle} belum dicek`);
    if (s.off) parts.push(`${s.off} off`);
    return parts.join(' · ');
  }
  let last = null;
  addEventListener('yannz:lang', () => { if (last) sum.textContent = summary(last.summary); });
  async function run() {
    clearTimeout(timer);
    const d = await load();
    if (!d) {
      push(el('epm-sys epm-err', 'Status endpoint lagi nggak bisa dimuat. Dicoba lagi bentar…'));
      timer = setTimeout(run, REFRESH_MS);
      return;
    }
    last = d;
    sum.textContent = summary(d.summary);
    push(el('epm-cmd', '$ yannz status --endpoints', true));
    push(el('epm-sys', `[SYSTEM] ${summary(d.summary)}`, true));
    // Problems first so they're seen, then the rest.
    const order = { down: 0, warn: 1, ok: 2, off: 3, idle: 4 };
    const list = d.endpoints.slice().sort((a, b) => order[a.state] - order[b.state] || a.path.localeCompare(b.path));
    if (reduced) { list.forEach(ep => push(line(ep))); push(el('epm-cmd', '$ ready', true)); timer = setTimeout(run, REFRESH_MS); return; }
    let i = 0;
    const step = () => {
      if (i < list.length) { push(line(list[i++])); timer = setTimeout(step, STEP_MS); return; }
      push(el('epm-ready', '$ siap nerima request ▍'));
      timer = setTimeout(run, REFRESH_MS);
    };
    step();
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else run(); });
  run();
})();
