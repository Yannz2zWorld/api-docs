// ~/endpoints monitor on the dashboard: a terminal that walks through every endpoint with its latest
// real HTTP code (GET /api/endpoints/status): 200 OK in green when it works, the error code with what
// it means in red when it doesn't. While it runs it asks the server to check the endpoints whose last
// check is old (POST /api/endpoints/autocheck) and prints those results live.
(() => {
  const box = document.getElementById('ep-monitor');
  if (!box) return;
  const body = box.querySelector('.epm-body');
  const clock = box.querySelector('.epm-clock');
  const sum = document.querySelector('.epm-summary') || document.createElement('span');
  const STEP_MS = 280, MAX_LINES = 200, REFRESH_MS = 30000, BUSY_REFRESH_MS = 12000;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const en = () => window.YannzI18n?.lang === 'en';

  // HTTP codes and what they mean.
  const CODES = {
    200: ['OK', 'Jalan normal', 'Working normally'],
    400: ['Bad Request', 'Request tidak valid', 'Invalid request'],
    401: ['Unauthorized', 'Butuh API key yang valid', 'A valid API key is needed'],
    403: ['Forbidden', 'Akses ditolak', 'Access denied'],
    404: ['Not Found', 'Endpoint tidak ditemukan', 'Endpoint not found'],
    405: ['Method Not Allowed', 'Metode request tidak didukung', 'Request method not supported'],
    408: ['Request Timeout', 'Request terlalu lama', 'The request took too long'],
    413: ['Payload Too Large', 'Ukuran data terlalu besar', 'The data is too large'],
    415: ['Unsupported Media Type', 'Format data tidak didukung', 'Data format not supported'],
    422: ['Unprocessable Entity', 'Data tidak dapat diproses', "The data couldn't be processed"],
    429: ['Too Many Requests', 'Terlalu banyak request', 'Too many requests'],
    500: ['Internal Server Error', 'Terjadi kesalahan pada server', 'Something went wrong on the server'],
    501: ['Not Implemented', 'Fitur belum didukung', 'Feature not supported yet'],
    502: ['Bad Gateway', 'Server menerima respons tidak valid', 'The server got an invalid response'],
    503: ['Service Unavailable', 'Server sedang tidak tersedia', 'The server is unavailable right now'],
    504: ['Gateway Timeout', 'Server terlalu lama merespons', 'The server took too long to respond']
  };
  const describe = code => {
    const c = CODES[code] || (code >= 500 ? [`Error`, 'Terjadi kesalahan pada server', 'Something went wrong on the server'] : ['Error', 'Request gagal', 'Request failed']);
    return { label: `${code} ${c[0]}`, desc: en() ? c[2] : c[1] };
  };

  const tick = () => { clock.textContent = new Date().toLocaleTimeString('id-ID', { hour12: false }); };
  tick(); setInterval(tick, 1000);

  const el = (cls, text, data) => { const d = document.createElement('div'); d.className = cls; if (data) d.setAttribute('data-no-i18n', ''); d.textContent = text; return d; };
  // Follows new lines only while the visitor is at the bottom; scrolled up to read, it stays put and
  // a "↓ Terbaru" button jumps back down.
  const jump = box.querySelector('.epm-jump');
  let follow = true;
  const atBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 24;
  let selfScroll = false;   // our own scrolling doesn't count as the visitor's
  const toBottom = () => { selfScroll = true; body.scrollTop = body.scrollHeight; requestAnimationFrame(() => { selfScroll = false; }); };
  body.addEventListener('scroll', () => { if (selfScroll) return; follow = atBottom(); if (jump) jump.hidden = follow; }, { passive: true });
  jump?.addEventListener('click', () => { follow = true; jump.hidden = true; toBottom(); });
  function push(node) {
    const keep = follow;
    body.append(node);
    while (body.children.length > MAX_LINES) {
      const h = body.firstChild.offsetHeight;
      body.firstChild.remove();
      if (!keep) { selfScroll = true; body.scrollTop = Math.max(0, body.scrollTop - h); requestAnimationFrame(() => { selfScroll = false; }); }   // removing old lines must not move what's being read
    }
    if (keep) toBottom();
    else if (jump) jump.hidden = false;
  }
  function line(ep, prefix = '→') {
    const d = document.createElement('div');
    d.className = 'epm-line';
    d.setAttribute('data-no-i18n', '');
    d.innerHTML = '<span class="epm-arrow"></span> <span class="epm-method"></span> <span class="epm-path"></span> <span class="epm-code"></span> <span class="epm-desc"></span><span class="epm-ms"></span>';
    d.querySelector('.epm-arrow').textContent = prefix;
    d.querySelector('.epm-method').textContent = ep.method || 'GET';
    d.querySelector('.epm-path').textContent = ep.path;
    const code = d.querySelector('.epm-code'), desc = d.querySelector('.epm-desc');
    if (ep.code == null) {
      code.textContent = en() ? '[CHECKING]' : '[LAGI DICEK]';
      code.dataset.state = 'pending';
    } else {
      const c = describe(ep.code);
      code.textContent = `[${c.label}]`;
      code.dataset.state = ep.code === 200 ? 'ok' : 'down';
      desc.textContent = ep.code === 200 ? '' : c.desc;
      desc.dataset.state = code.dataset.state;
    }
    d.querySelector('.epm-ms').textContent = ep.ms != null ? ` (${ep.ms}ms)` : '';
    if (ep.at) d.title = `${ep.source === 'live' ? (en() ? 'Real request' : 'Request asli') : (en() ? 'Automatic check' : 'Cek otomatis')} · ${new Date(ep.at).toLocaleString('id-ID')}`;
    return d;
  }
  function summary(s) {
    const parts = [`${s.total} endpoint${en() && s.total !== 1 ? 's' : ''}`, `${s.ok || 0} × 200 OK`];
    if (s.down) parts.push(`${s.down} error`);
    if (s.pending) parts.push(en() ? `${s.pending} being checked` : `${s.pending} lagi dicek`);
    return parts.join(' · ');
  }
  let last = null;
  addEventListener('yannz:lang', () => { if (last) sum.textContent = summary(last.summary); });

  async function load() {
    try {
      const r = await fetch('/api/endpoints/status', { credentials: 'same-origin', cache: 'no-store' });
      const d = await r.json();
      return r.ok && d.success ? d : null;
    } catch { return null; }
  }
  // Ask the server to check the endpoints whose last check is old; print what it checked.
  let checking = false;
  async function autocheck() {
    if (checking || document.hidden) return 0;
    checking = true;
    try {
      const r = await fetch('/api/endpoints/autocheck', { method: 'POST', credentials: 'same-origin', headers: { 'X-Yannz-Client': 'web' } });
      const d = await r.json().catch(() => ({}));
      const list = (r.ok && d.checked) || [];
      if (list.length) {
        push(el('epm-cmd', `$ yannz check --auto (${list.length})`, true));
        list.forEach(ep => push(line(ep, '✓')));
      }
      return list.length;
    } catch { return 0; } finally { checking = false; }
  }

  let timer = null;
  async function run() {
    clearTimeout(timer);
    if (refreshing) return;
    const d = await load();
    if (!d) {
      push(el('epm-sys epm-err', en() ? "Couldn't load endpoint status. Trying again in a moment…" : 'Status endpoint lagi nggak bisa dimuat. Dicoba lagi bentar…', true));
      timer = setTimeout(run, REFRESH_MS);
      return;
    }
    last = d;
    sum.textContent = summary(d.summary);
    push(el('epm-cmd', '$ yannz status --endpoints', true));
    push(el('epm-sys', `[SYSTEM] ${summary(d.summary)}`, true));
    const pending = autocheck();   // runs alongside the listing
    // Errors first so they're seen, then the ones being checked, then the rest.
    const order = { down: 0, pending: 1, ok: 2 };
    const list = d.endpoints.slice().sort((a, b) => order[a.state] - order[b.state] || a.path.localeCompare(b.path));
    const next = async () => { const n = await pending; timer = setTimeout(run, n || d.summary.pending ? BUSY_REFRESH_MS : REFRESH_MS); };
    if (reduced) { list.forEach(ep => push(line(ep))); push(el('epm-ready', en() ? '$ ready' : '$ siap', true)); next(); return; }
    let i = 0;
    const step = () => {
      if (i < list.length) { push(line(list[i++])); timer = setTimeout(step, STEP_MS); return; }
      push(el('epm-ready', en() ? '$ ready for incoming requests ▍' : '$ siap nerima request ▍', true));
      next();
    };
    step();
  }
  // Refresh: really checks every endpoint again on the server (except the ones checked in the last
  // 5 minutes), a few at a time, printing each result as it comes back.
  const refresh = box.querySelector('.epm-refresh');
  let refreshing = false;
  refresh?.addEventListener('click', async () => {
    if (refreshing) return;
    refreshing = true;
    clearTimeout(timer);
    refresh.disabled = true;
    refresh.classList.add('spin');
    follow = true; if (jump) jump.hidden = true; toBottom();
    push(el('epm-cmd', '$ yannz check --all', true));
    let done = 0, ok = 0, failed = 0, stop = null;
    while (checking) await new Promise(r => setTimeout(r, 300));
    checking = true;
    try {
      for (let round = 0; round < 40; round++) {
        sum.textContent = en() ? `Checking again… ${done} done` : `Lagi ngecek ulang… ${done} selesai`;
        const r = await fetch('/api/endpoints/autocheck', { method: 'POST', credentials: 'same-origin', headers: { 'X-Yannz-Client': 'web', 'Content-Type': 'application/json' }, body: JSON.stringify({ force: true }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) { stop = d.message || `HTTP ${r.status}`; break; }
        const list = d.checked || [];
        if (!list.length) break;
        list.forEach(ep => { done++; if (ep.code === 200) ok++; else failed++; push(line(ep, '✓')); });
      }
    } catch { stop = en() ? 'Connection lost.' : 'Koneksi putus.'; } finally { checking = false; }
    push(el(stop ? 'epm-sys epm-err' : 'epm-ready', stop
      ? (en() ? `Check stopped: ${stop}` : `Cek ulang berhenti: ${stop}`)
      : done ? (en() ? `$ checked ${done} endpoints: ${ok} × 200 OK, ${failed} error` : `$ selesai ngecek ${done} endpoint: ${ok} × 200 OK, ${failed} error`)
        : (en() ? '$ everything was checked in the last 5 minutes' : '$ semua udah dicek 5 menit terakhir'), true));
    refresh.disabled = false;
    refresh.classList.remove('spin');
    refreshing = false;
    run();
  });

  document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else if (!refreshing) run(); });
  run();
})();
