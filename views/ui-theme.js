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
      edge: '#3b2a1e', edgeSoft: '#b8a07c', drop: '#3b2a1e', border: 2, radius: 6, shadow: [4, 4], accent: '#c2410c', font: "Georgia, 'Times New Roman', serif" },
    lemon: { name: 'Lemon', desc: 'Kuning lemon bertitik, kartu putih, garis hitam tebal.', dark: false,
      bg: '#fffbea', dot: '#eadc8f', surface: '#ffffff', surface2: '#fffbea', surface3: '#eadc8f', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#facc15', font: "'Space Grotesk', Outfit, sans-serif" },
    mint: { name: 'Mint', desc: 'Hijau mint bertitik, garis hitam tebal, segar.', dark: false,
      bg: '#ecfdf5', dot: '#a7e3c8', surface: '#ffffff', surface2: '#ecfdf5', surface3: '#a7e3c8', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#10b981', font: "'Space Grotesk', Outfit, sans-serif" },
    sky: { name: 'Sky', desc: 'Biru langit bertitik, kartu putih tebal.', dark: false,
      bg: '#eff6ff', dot: '#b6cff3', surface: '#ffffff', surface2: '#eff6ff', surface3: '#b6cff3', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#3b82f6', font: "'Space Grotesk', Outfit, sans-serif" },
    peach: { name: 'Peach', desc: 'Oranye persik lembut, garis hitam tegas.', dark: false,
      bg: '#fff1e6', dot: '#f2c6a3', surface: '#ffffff', surface2: '#fff1e6', surface3: '#f2c6a3', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#fb923c', font: "'Space Grotesk', Outfit, sans-serif" },
    lilac: { name: 'Lilac', desc: 'Ungu lilac bertitik, kartu putih, aksen ungu.', dark: false,
      bg: '#f5f0ff', dot: '#d3c4f3', surface: '#ffffff', surface2: '#f5f0ff', surface3: '#d3c4f3', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#8b5cf6', font: "'Space Grotesk', Outfit, sans-serif" },
    bubblegum: { name: 'Bubblegum', desc: 'Pink permen karet, sudut bulat besar.', dark: false,
      bg: '#fff0f6', dot: '#f5bcd6', surface: '#ffffff', surface2: '#fff0f6', surface3: '#f5bcd6', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 26, shadow: [6, 6], accent: '#ff4fa3', font: "'Space Grotesk', Outfit, sans-serif" },
    coral: { name: 'Coral', desc: 'Merah koral bertitik, garis hitam tebal.', dark: false,
      bg: '#fff3f0', dot: '#f6c3b8', surface: '#ffffff', surface2: '#fff3f0', surface3: '#f6c3b8', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#ff5a5f', font: "'Space Grotesk', Outfit, sans-serif" },
    lime: { name: 'Lime Punch', desc: 'Hijau lime terang, bayangan kotak besar.', dark: false,
      bg: '#f7fee7', dot: '#cbe596', surface: '#ffffff', surface2: '#f7fee7', surface3: '#cbe596', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [8, 8], accent: '#84cc16', font: "'Space Grotesk', Outfit, sans-serif" },
    ocean: { name: 'Ocean', desc: 'Biru laut muda, kartu putih, aksen toska.', dark: false,
      bg: '#e6f6f8', dot: '#a9dbe2', surface: '#ffffff', surface2: '#e6f6f8', surface3: '#a9dbe2', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 18, shadow: [6, 6], accent: '#0891b2', font: "'Space Grotesk', Outfit, sans-serif" },
    sand: { name: 'Sand', desc: 'Pasir hangat, sudut kecil, aksen jingga.', dark: false,
      bg: '#f6efe1', dot: '#dfcda6', surface: '#ffffff', surface2: '#f6efe1', surface3: '#dfcda6', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 8, shadow: [6, 6], accent: '#d97706', font: "'Space Grotesk', Outfit, sans-serif" },
    comic: { name: 'Comic', desc: 'Kertas komik bertitik rapat, garis super tebal.', dark: false,
      bg: '#fffdf2', dot: '#c9c3a8', surface: '#ffffff', surface2: '#fffdf2', surface3: '#c9c3a8', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 4, radius: 6, shadow: [7, 7], accent: '#ef4444', font: "'Space Grotesk', Outfit, sans-serif" },
    newsprint: { name: 'Newsprint', desc: 'Kertas koran abu, tinta hitam, huruf klasik.', dark: false,
      bg: '#f2f2f0', dot: '#c8c8c4', surface: '#fafaf8', surface2: '#f2f2f0', surface3: '#c8c8c4', ink: '#111111', muted: '#3f3f46', faint: '#71717a',
      edge: '#111111', edgeSoft: '#111111', drop: '#111111', border: 3, radius: 4, shadow: [5, 5], accent: '#111111', font: "Georgia, 'Times New Roman', serif" },
    matcha: { name: 'Matcha', desc: 'Hijau matcha kalem, tinta hijau tua.', dark: false,
      bg: '#f1f5e8', dot: '#c9d6a8', surface: '#fbfdf6', surface2: '#f1f5e8', surface3: '#c9d6a8', ink: '#1f2a14', muted: '#4b5a3a', faint: '#71717a',
      edge: '#1f2a14', edgeSoft: '#1f2a14', drop: '#1f2a14', border: 3, radius: 14, shadow: [6, 6], accent: '#65a30d', font: "'Space Grotesk', Outfit, sans-serif" },
    blueprint: { name: 'Blueprint', desc: 'Biru cetak biru, garis putih tebal, aksen kuning.', dark: true,
      bg: '#0b3a75', dot: '#2a5ea0', surface: '#0f4588', surface2: '#13509a', surface3: '#1a5aa8', ink: '#eaf2ff', muted: '#b9cdee', faint: '#8aa7d6',
      edge: '#eaf2ff', edgeSoft: '#3f72b8', drop: '#062449', border: 3, radius: 10, shadow: [6, 6], accent: '#ffd60a', font: "'DM Mono', ui-monospace, monospace" },
    forest: { name: 'Forest', desc: 'Hijau hutan gelap, garis terang, aksen hijau muda.', dark: true,
      bg: '#0f1f17', dot: '#1f3a2b', surface: '#15291f', surface2: '#1a3326', surface3: '#20402f', ink: '#e7f5ec', muted: '#a9c9b5', faint: '#76937f',
      edge: '#e7f5ec', edgeSoft: '#2f5340', drop: '#050c08', border: 3, radius: 16, shadow: [6, 6], accent: '#4ade80' },
    wine: { name: 'Wine', desc: 'Merah anggur gelap, garis terang, aksen rose.', dark: true,
      bg: '#1a0b10', dot: '#3a1822', surface: '#241016', surface2: '#2e1520', surface3: '#391a28', ink: '#fbe9ee', muted: '#d9aab8', faint: '#a77b8a',
      edge: '#fbe9ee', edgeSoft: '#4d2433', drop: '#0a0306', border: 3, radius: 16, shadow: [6, 6], accent: '#f43f5e' },
    mocha: { name: 'Mocha', desc: 'Cokelat kopi gelap, garis krem, aksen karamel.', dark: true,
      bg: '#1f1813', dot: '#3a2d24', surface: '#2a2019', surface2: '#33281f', surface3: '#3d3026', ink: '#f5ebe0', muted: '#d4c1ad', faint: '#a08c78',
      edge: '#f5ebe0', edgeSoft: '#4d3d31', drop: '#0d0907', border: 3, radius: 14, shadow: [6, 6], accent: '#d4a373' },
    slate: { name: 'Slate', desc: 'Abu kebiruan gelap, garis terang, aksen biru.', dark: true,
      bg: '#111827', dot: '#253045', surface: '#1a2333', surface2: '#212c40', surface3: '#28354c', ink: '#e5e7eb', muted: '#aeb6c4', faint: '#7c8698',
      edge: '#e5e7eb', edgeSoft: '#334058', drop: '#05080f', border: 3, radius: 12, shadow: [6, 6], accent: '#60a5fa' },
    noir: { name: 'Noir', desc: 'Hitam putih pekat, garis putih tebal, tanpa warna lain.', dark: true,
      bg: '#000000', dot: '#1c1c1c', surface: '#0d0d0d', surface2: '#151515', surface3: '#1e1e1e', ink: '#ffffff', muted: '#bdbdbd', faint: '#8a8a8a',
      edge: '#ffffff', edgeSoft: '#3a3a3a', drop: '#3a3a3a', border: 3, radius: 8, shadow: [6, 6], accent: '#ffffff' },
    arcade: { name: 'Arcade', desc: 'Ungu malam, huruf mesin, aksen kuning arcade.', dark: true,
      bg: '#1b0b33', dot: '#34195c', surface: '#24103f', surface2: '#2c144d', surface3: '#35195c', ink: '#f3e8ff', muted: '#c7b3e6', faint: '#9a84bd',
      edge: '#f3e8ff', edgeSoft: '#4a2a7a', drop: '#0b0418', border: 3, radius: 10, shadow: [6, 6], accent: '#facc15', font: "'DM Mono', ui-monospace, monospace" },
  };

  const HEX = /^#[0-9a-f]{6}$/i;
  // scythe: { handle, head, fx } colours of the 3D scythe (views/scythe-color.js), or null.
  const scytheOf = c => (c && typeof c === 'object' && ['handle', 'head', 'fx'].every(k => HEX.test(c[k] || ''))) ? { handle: c.handle.toLowerCase(), head: c.head.toLowerCase(), fx: c.fx.toLowerCase() } : null;
  const clean = v => ({ style: STYLES[v?.style] ? v.style : 'default', accent: HEX.test(v?.accent || '') ? v.accent.toLowerCase() : '', rgb: Boolean(v?.rgb), scythe: scytheOf(v?.scythe) });
  function load() {
    try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v) return clean(v); } catch {}
    return clean(null);
  }
  function save(pref) { try { localStorage.setItem(KEY, JSON.stringify(pref)); } catch {} }
  const owner = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null')?.uid || null; } catch { return null; } };
  let uid = null;   // the signed-in account, once known
  const same = (a, b) => a.style === b.style && (a.accent || '') === (b.accent || '') && Boolean(a.rgb) === Boolean(b.rgb);
  const sameScythe = (a, b) => JSON.stringify(a.scythe || null) === JSON.stringify(b.scythe || null);
  const custom = p => p.style !== 'default' || p.accent || p.rgb || p.scythe;
  const scytheChanged = p => window.dispatchEvent(new CustomEvent('yannz:scythe', { detail: p.scythe || { handle: '#f2ebe0', head: '#b8b4bc', fx: '#ff1a2c' } }));

  // The account's choice wins. An account without one takes this browser's choice, but only one
  // made by this account (or before saving to accounts existed), never someone else's on a shared
  // browser.
  async function sync() {
    let d;
    try { const r = await fetch('/api/profile/ui', { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) return; d = await r.json(); } catch { return; }
    uid = d.user || null;
    const local = load(), mine = !owner() || owner() === uid;
    if (d.ui && STYLES[d.ui.style]) {
      const pref = clean(d.ui);
      save({ ...pref, uid });
      if (!same(pref, local)) apply(pref);
      if (!sameScythe(pref, local)) scytheChanged(pref);
    } else if (mine && custom(local)) {
      save({ ...local, uid }); push(local);
    } else if (!mine) {
      const pref = clean(null);
      save({ ...pref, uid }); apply(pref); scytheChanged(pref);
    }
  }
  function push(pref) {
    return fetch('/api/profile/ui', { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ style: pref.style, accent: pref.accent || '', rgb: Boolean(pref.rgb), scythe: pref.scythe || null }) })
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
--red:var(--accent);--red-deep:color-mix(in srgb,var(--accent) 78%,#000);--paper:var(--surface);--cream:var(--bg);--login-bg:var(--surface);--yellow:var(--accent);--blood:var(--accent);--blood-deep:var(--red-deep);--blue:var(--muted);--green:var(--edge);
--ui-bad:var(--bad);--ui-deep:var(--red-deep);--ok:${s.dark ? '#86efac' : '#15803d'};--bad:${s.dark ? 'color-mix(in srgb,var(--accent) 62%,#fff)' : 'color-mix(in srgb,var(--accent) 80%,#000)'};--warn:${s.dark ? '#e4e4e7' : '#3f3f46'};color-scheme:${s.dark ? 'dark' : 'light'}}
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
    const custom = pref.style !== 'default' || pref.accent || pref.rgb;
    // Pages with their own design (the /3d game) keep their layout but take the chosen colour, so
    // none of the original red is left once the UI is customised.
    if (html.hasAttribute('data-no-theme')) {
      const st = html.style, a = pref.accent || s.accent;
      if (custom) { setAccent(a); st.setProperty('--red', a); st.setProperty('--red-deep', 'color-mix(in srgb,' + a + ' 78%,#000)'); st.setProperty('--red-ink', inkOn(a)); st.setProperty('--bad', 'color-mix(in srgb,' + a + ' 62%,#fff)'); st.setProperty('--ui-bad', 'var(--bad)'); }
      else ['--accent', '--accent-ink', '--red', '--red-deep', '--red-ink', '--bad', '--ui-bad'].forEach(k => st.removeProperty(k));
      return changed();
    }
    let tag = document.getElementById('yannz-ui-style');
    if (!custom) {
      html.removeAttribute('data-ui'); tag?.remove();
      html.style.removeProperty('--accent'); html.style.removeProperty('--accent-ink');
      return changed();
    }
    if (!tag) { tag = document.createElement('style'); tag.id = 'yannz-ui-style'; (document.head || html).append(tag); }
    tag.textContent = css(s);
    html.setAttribute('data-ui', pref.style);
    setAccent(pref.accent || s.accent);
    if (pref.rgb && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let h = 0;
      rgbTimer = setInterval(() => { h = (h + 2) % 360; setAccent(hsl(h)); }, 60);
    }
    changed();
  }
  // The colour the whole site uses now: the chosen one, the look's own, or null for the original.
  function accentOf(pref = load()) {
    const s = STYLES[pref.style] || STYLES.default;
    return pref.style !== 'default' || pref.accent || pref.rgb ? pref.accent || s.accent : null;
  }
  // Tell the rest of the page (scythe colours follow the UI colour while they are not customised).
  function changed() { try { window.dispatchEvent(new CustomEvent('yannz:ui')); } catch { /* old browsers */ } }

  // set(): applied at once, kept in this browser, saved on the account (resolves true when saved there).
  // The look stays after signing out too: this browser keeps the last account's choice.
  window.YannzUI = { STYLES, load, save, apply, inkOn, sync, accentOf, owner: () => uid || owner(), set(pref) { const p = clean(pref); save({ ...p, uid: uid || owner() }); apply(p); return push(p); } };
  apply();
  sync();
  // Another tab changed it: follow.
  addEventListener('storage', e => { if (e.key === KEY) { const p = load(); apply(p); scytheChanged(p); } });
})();
