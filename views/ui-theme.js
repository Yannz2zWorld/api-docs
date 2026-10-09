// Custom UI (menu "Custom UI", page /custom-ui): the visitor picks a look and a colour for the site.
// Saved on the account (GET / PUT /api/profile/ui, migration 021), so it follows the user to any
// device they sign in on, with a copy in this browser (localStorage "yannz-ui": { style, accent, rgb,
// uid }) so it's applied on every page that loads this script before the page is drawn. Every look is a set of colour / border / shadow
// tokens put on <html data-ui="…">; the pages are built on those tokens (views/theme.css and the
// dashboard's own variables), so one set restyles everything.
//   accent : any colour (#rrggbb); empty = the look's own colour
//   rgb    : the accent keeps cycling through every colour (off with reduced motion)
(() => {
  if (window.YannzUI) return;
  const KEY = 'yannz-ui';

  // Each look: base colours, border width, corner radius, shadow offset, dot pattern, default accent.
  const STYLES = {
    default: { name: 'Default', desc: 'Gelap, garis tegas, aksen merah. Tampilan bawaan.', dark: true,
      bg: '#0b0b0c', dot: '#1f1f23', surface: '#141416', surface2: '#1b1b1e', surface3: '#232327', ink: '#f4f4f5', muted: '#a1a1aa', faint: '#71717a',
      edge: '#d4d4d8', edgeSoft: '#3f3f46', drop: '#3f3f46', border: 2, radius: 12, shadow: [6, 6], accent: '#c8202f' },
    cream: { name: 'Brutal Cream', desc: 'Krem bertitik, garis hitam tebal, bayangan kotak, aksen kuning.', dark: false,
      bg: '#f3f1ea', dot: '#cfcabb', surface: '#ffffff', surface2: '#fbf8ef', surface3: '#f5f0e1', ink: '#111111', muted: '#4b4b4b', faint: '#7a7a7a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#ffd60a', font: "'Space Grotesk', Outfit, sans-serif" },
    pop: { name: 'Brutal Pop', desc: 'Abu bertitik, kartu putih tebal, aksen ungu cerah.', dark: false,
      bg: '#e4e4e7', dot: '#a1a1aa', surface: '#ffffff', surface2: '#f4f4f5', surface3: '#ececf0', ink: '#0a0a0a', muted: '#3f3f46', faint: '#71717a',
      edge: '#0a0a0a', edgeSoft: '#0a0a0a', drop: '#0a0a0a', border: 3, radius: 22, shadow: [8, 8], accent: '#6366f1', font: "'Space Grotesk', Outfit, sans-serif" },
    neon: { name: 'Midnight', desc: 'Biru malam, garis tegas sesuai warna pilihan, bayangan kotak.', dark: true,
      bg: '#070b18', dot: '#16203d', surface: '#0d1428', surface2: '#121b35', surface3: '#182343', ink: '#e8ecff', muted: '#9aa5c8', faint: '#6c7699',
      edge: 'accent', edgeSoft: '#25335c', drop: '#020409', border: 2, radius: 14, shadow: [6, 6], accent: '#22d3ee' },
    glass: { name: 'Graphite', desc: 'Abu grafit, garis tebal, rata tanpa efek.', dark: true,
      bg: '#2a2a2e', dot: '#3a3a40', surface: '#34343a', surface2: '#3c3c43', surface3: '#45454d', ink: '#f4f4f5', muted: '#c4c4cc', faint: '#9a9aa3',
      edge: '#f4f4f5', edgeSoft: '#56565f', drop: '#121214', border: 3, radius: 10, shadow: [5, 5], accent: '#f97316' },
    minimal: { name: 'Minimal Light', desc: 'Putih bersih, garis tipis, rapi.', dark: false,
      bg: '#fafafa', dot: 'transparent', surface: '#ffffff', surface2: '#f6f6f7', surface3: '#efeff1', ink: '#18181b', muted: '#52525b', faint: '#8b8b94',
      edge: '#d4d4d8', edgeSoft: '#e4e4e7', drop: '#e4e4e7', border: 1, radius: 12, shadow: [0, 3], accent: '#2563eb' },
    terminal: { name: 'Terminal', desc: 'Hitam pekat, huruf mesin ketik, sudut lancip.', dark: true,
      bg: '#000000', dot: '#0f1a0f', surface: '#050805', surface2: '#0a110a', surface3: '#0f180f', ink: '#d1fae5', muted: '#86c9a3', faint: '#4d7a5f',
      edge: 'accent', edgeSoft: '#1d3b28', drop: '#0f2a1a', border: 1, radius: 0, shadow: [4, 4], accent: '#22c55e', font: "'DM Mono', ui-monospace, monospace" },
    pastel: { name: 'Pastel', desc: 'Pink lembut, sudut bulat, ceria.', dark: false,
      bg: '#fdf2f8', dot: '#f5cfe3', surface: '#ffffff', surface2: '#fff7fb', surface3: '#fdeef6', ink: '#3b0a2a', muted: '#7a4867', faint: '#a9809a',
      edge: '#f0abd0', edgeSoft: '#f6cde2', drop: '#f5c2dd', border: 2, radius: 22, shadow: [5, 5], accent: '#ec4899' },
    paper: { name: 'Retro Paper', desc: 'Kertas tua, tinta cokelat, nuansa jadul.', dark: false,
      bg: '#f2e8d5', dot: '#dccaa6', surface: '#fbf5e8', surface2: '#f6ecd9', surface3: '#efe2c8', ink: '#3b2a1e', muted: '#6f5843', faint: '#9b8468',
      edge: '#3b2a1e', edgeSoft: '#b8a07c', drop: '#3b2a1e', border: 2, radius: 6, shadow: [4, 4], accent: '#c2410c', font: "Georgia, 'Times New Roman', serif" }
  };

  const HEX = /^#[0-9a-f]{6}$/i;
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && STYLES[v.style]) return { style: v.style, accent: HEX.test(v.accent || '') ? v.accent.toLowerCase() : '', rgb: Boolean(v.rgb) }; } catch {}
    return { style: 'default', accent: '', rgb: false };
  }
  function save(pref) { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch {} }
  const owner = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.uid || null; } catch { return null; } };
  let uid = null;   // the signed-in account, once known
  const same = (a, b) => a.style === b.style && (a.accent || '') === (b.accent || '') && Boolean(a.rgb) === Boolean(b.rgb);

  // The account's choice wins. An account without one takes this browser's choice, but only one
  // made by this account (or before saving to accounts existed), never someone else's on a shared
  // browser.
  async function sync() {
    let d;
    try { const r = await fetch('/api/profile/ui', { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) return; d = await r.json(); } catch { return; }
    uid = d.user || null;
    const local = load(), mine = !owner() || owner() === uid;
    if (d.ui && STYLES[d.ui.style]) {
      const pref = { style: d.ui.style, accent: HEX.test(d.ui.accent || '') ? d.ui.accent.toLowerCase() : '', rgb: Boolean(d.ui.rgb) };
      save({ ...pref, uid });
      if (!same(pref, local)) apply(pref);
    } else if (mine && (local.style !== 'default' || local.accent || local.rgb)) {
      save({ ...local, uid }); push(local);
    } else if (!mine) {
      const pref = { style: 'default', accent: '', rgb: false };
      save({ ...pref, uid }); apply(pref);
    }
  }
  function push(pref) {
    return fetch('/api/profile/ui', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style: pref.style, accent: pref.accent || '', rgb: Boolean(pref.rgb) }) })
      .then(r => r.ok).catch(() => false);
  }

  // Black or white text on a colour, whichever reads better.
  function inkOn(hex) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.38 ? '#0a0a0a' : '#ffffff';
  }
  const hsl = h => { const f = n => { const k = (n + h / 30) % 12, a = .9 * Math.min(.55, 1 - .55); return Math.round(255 * (.55 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return `#${f(0)}${f(8)}${f(4)}`; };

  function css(s) {
    const edge = s.edge === 'accent' ? 'var(--accent)' : s.edge;
    const drop = s.drop;
    // Flat, hard-edged shadows only: no glow, no blur.
    const shadow = `${s.shadow[0]}px ${s.shadow[1]}px 0 var(--drop)`;
    const R = 'html[data-ui]';
    return `${R}{--bg:${s.bg};--dot:${s.dot};--surface:${s.surface};--surface-2:${s.surface2};--surface-3:${s.surface3};--ink:${s.ink};--muted:${s.muted};--faint:${s.faint};
--edge:${edge};--edge-soft:${s.edgeSoft};--drop:${drop};--radius:${s.radius}px;--line:${s.border}px solid var(--edge);--shadow:${shadow};
--red:var(--accent);--red-deep:color-mix(in srgb,var(--accent) 78%,#000);--paper:var(--surface);--yellow:var(--accent);--blood:var(--accent);--blood-deep:var(--red-deep);--blue:var(--muted);--green:var(--edge);
--ok:${s.dark ? '#86efac' : '#15803d'};--bad:${s.dark ? '#fca5a5' : '#b91c1c'};--warn:${s.dark ? '#e4e4e7' : '#3f3f46'};color-scheme:${s.dark ? 'dark' : 'light'}}
${R} body{background-color:var(--bg);background-image:radial-gradient(var(--dot) 1.2px,transparent 1.2px);background-size:22px 22px;color:var(--ink)${s.font ? `;font-family:${s.font}` : ''}}
${s.font ? `${R} h1,${R} h2,${R} h3,${R} .brand,${R} .hero h1,${R} .section-head h2,${R} .metric-value{font-family:${s.font}}` : ''}
${R} .topbar{background:color-mix(in srgb,var(--bg) 86%,transparent);border-bottom-color:var(--edge-soft)}
${R} a:hover,${R} button:hover,${R} .btn:hover{color:var(--ink)}
${R} button,${R} .btn,${R} input,${R} select,${R} textarea{border-radius:${Math.min(s.radius, 14)}px}
${R} button,${R} .btn{border-width:${s.border}px}
${R} .panel,${R} .card,${R} dialog,${R} .metric,${R} .feature,${R} .endpoints{border-width:${s.border}px;border-radius:var(--radius)}
${R} input:hover,${R} select:hover,${R} textarea:hover{border-color:var(--edge)}
${R} button.primary,${R} .btn.primary,${R} .nav a[aria-current="page"],${R} .tabs button[aria-selected="true"],${R} .secret,${R} .steps>.step::before,${R} .brand-mark{color:var(--accent-ink)}
${R} button.primary:hover,${R} .btn.primary:hover{background:var(--red-deep);border-color:var(--red-deep);color:var(--accent-ink)}
${R} td,${R} .list>li,${R} .order{border-color:var(--edge-soft)}
${R} tbody tr:hover,${R} table tr:hover td{background:color-mix(in srgb,var(--ink) 5%,transparent)}
${R} .card.current small,${R} .card.current li{color:var(--accent-ink);opacity:.86}
${R} ::selection{background:var(--accent);color:var(--accent-ink)}
${R} .feature.blue,${R} .feature.green{background:var(--surface)}${R} .feature.yellow{background:color-mix(in srgb,var(--accent) 16%,var(--surface))}
${R} .feature p,${R} .metric-note,${R} .endpoint small,${R} .endpoint-head span,${R} .empty,${R} .footer p,${R} .copyright{color:var(--muted)}
${R} .endpoints{background:var(--surface);color:var(--ink)}${R} .endpoint{background:var(--surface-2);border-color:var(--edge-soft)}
${R} .footer{background:var(--surface);color:var(--ink);border-top-color:var(--edge-soft)}${R} .footer-links a{border-color:var(--edge-soft);color:var(--ink)}${R} .footer-links a:hover{background:var(--surface-2)}${R} .copyright{border-top-color:var(--edge-soft)}
${R} .hero h1 span,${R} .mark,${R} .account-menu summary,${R} .shell .btn:not(.secondary){color:var(--accent-ink)}
${R} .shell .btn:not(.secondary):hover,${R} .account-pop a:hover,${R} .account-pop button:hover,${R} .logout:hover{color:var(--ink)}`;
  }

  let rgbTimer = null;
  function setAccent(hex) {
    const root = document.documentElement.style;
    root.setProperty('--accent', hex);
    root.setProperty('--accent-ink', inkOn(hex));
  }
  function apply(pref = load()) {
    const s = STYLES[pref.style] || STYLES.default;
    const html = document.documentElement;
    clearInterval(rgbTimer); rgbTimer = null;
    let tag = document.getElementById('yannz-ui-style');
    const custom = pref.style !== 'default' || pref.accent || pref.rgb;
    if (!custom) {
      html.removeAttribute('data-ui'); tag?.remove();
      html.style.removeProperty('--accent'); html.style.removeProperty('--accent-ink');
      return;
    }
    if (!tag) { tag = document.createElement('style'); tag.id = 'yannz-ui-style'; (document.head || html).append(tag); }
    tag.textContent = css(s);
    html.setAttribute('data-ui', pref.style);
    setAccent(pref.accent || s.accent);
    if (pref.rgb && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let h = 0;
      rgbTimer = setInterval(() => { h = (h + 2) % 360; setAccent(hsl(h)); }, 60);
    }
  }

  // set(): applied at once, kept in this browser, saved on the account (resolves true when saved there).
  window.YannzUI = { STYLES, load, save, apply, inkOn, sync, set(pref) { save({ ...pref, uid: uid || owner() }); apply(pref); return push(pref); } };
  apply();
  sync();
  // Another tab changed it: follow.
  addEventListener('storage', e => { if (e.key === KEY) apply(); });
})();
