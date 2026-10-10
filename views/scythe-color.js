// Scythe colours: the handle, the head (blade + skull) and the effects (energy, gem, roses, lights,
// embers, the slash trail, shockwaves and every skill flash), each any colour. Saved with the
// visitor's Custom UI (views/ui-theme.js → the account), so the dashboard scythe, the /3d game and
// the Custom UI preview all show the same colours.
//
// Set by tapping the scythe (dashboard, /3d) or on the Custom UI page; never through a menu.
//   YannzScythe.get()                → { handle, head, fx }
//   YannzScythe.set(colours)         → applied everywhere at once, saved (account save debounced)
//   YannzScythe.paint(THREE, root)   → recolours a three.js scythe, follows later changes
//   YannzScythe.track(THREE, obj, prop, part) → an extra light / sprite / ring that follows a part
//   YannzScythe.open(x, y)           → the small colour panel next to the tap
//   YannzScythe.tone(c)              → a crimson from the site's scythe animations, moved to the chosen
//                                      effect colour ([r, g, b] in and out; the default is unchanged)
//   YannzScythe.mark()               → URL of the 2D scythe (the intro / loading picture) in the chosen
//                                      colours; <img data-scythe-mark> pictures follow on their own
(() => {
  if (window.YannzScythe) return;
  const DEFAULT = { handle: '#f2ebe0', head: '#b8b4bc', fx: '#ff1a2c' };
  const HEX = /^#[0-9a-f]{6}$/i;
  // Model material names (the same in the dashboard GLB and the /3d game).
  const PART = { steel: 'head', skull: 'head', metal: 'handle', bone: 'handle', leather: 'handle', fabric: 'handle',
    energy: 'fx', energyCore: 'fx', gem: 'fx', glow: 'fx', rose: 'fx', roseInner: 'fx' };
  const LABEL = { handle: 'Pegangan', head: 'Kepala', fx: 'Efek & skill' };
  const SWATCHES = ['#ff1a2c', '#ffd60a', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#ffffff', '#b8b4bc', '#f2ebe0', '#111111'];

  const clean = c => ({ handle: HEX.test(c?.handle || '') ? c.handle.toLowerCase() : DEFAULT.handle,
    head: HEX.test(c?.head || '') ? c.head.toLowerCase() : DEFAULT.head, fx: HEX.test(c?.fx || '') ? c.fx.toLowerCase() : DEFAULT.fx });
  function get() {
    if (window.YannzUI) return clean(window.YannzUI.load().scythe);
    try { return clean(JSON.parse(localStorage.getItem('yannz-ui') || 'null')?.scythe); } catch { return clean(null); }
  }
  const custom = c => c.handle !== DEFAULT.handle || c.head !== DEFAULT.head || c.fx !== DEFAULT.fx;

  let saveTimer = null;
  function set(c) {
    const colours = clean(c);
    const UI = window.YannzUI;
    if (UI) {
      const pref = { ...UI.load(), scythe: colours };
      UI.save({ ...pref, uid: UI.owner ? UI.owner() : undefined });   // this browser, at once
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => UI.set(pref), 500);               // the account, once the picker settles
    }
    window.dispatchEvent(new CustomEvent('yannz:scythe', { detail: colours }));
    return colours;
  }

  // ---------------------------------------------------------------- recolouring a three.js scene
  // Each part keeps its own light / dark balance: a colour is scaled by how bright that piece was
  // next to the part's original colour (the grip stays darker than the bone shaft, and so on).
  const lum = c => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const scenes = [];
  function entry(THREE, obj, prop, part) {
    const c = obj && obj[prop];
    if (!c || !c.isColor) return null;
    return { obj, prop, part, orig: c.clone(), k: Math.max(0.12, Math.min(1.8, lum(c) / Math.max(0.02, lum(new THREE.Color(DEFAULT[part]))))) };
  }
  function apply(THREE, list, colours) {
    for (const e of list) {
      if (colours[e.part] === DEFAULT[e.part]) e.obj[e.prop].copy(e.orig);
      else e.obj[e.prop].set(colours[e.part]).multiplyScalar(e.k);
    }
  }
  function paint(THREE, root) {
    const list = [];
    const seen = new Set();
    root.traverse(o => {
      const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const m of mats) {
        const part = PART[m.name];
        if (!part || seen.has(m)) continue;
        seen.add(m);
        for (const prop of ['color', 'emissive']) { const e = entry(THREE, m, prop, part); if (e) list.push(e); }
      }
    });
    const s = { THREE, list };
    scenes.push(s);
    apply(THREE, list, get());
    return { track: (obj, prop = 'color', part = 'fx') => { const e = entry(THREE, obj, prop, part); if (e) { list.push(e); apply(THREE, [e], get()); } return e; } };
  }
  function track(THREE, obj, prop = 'color', part = 'fx') {
    let s = scenes.find(x => x.THREE === THREE && x.loose);
    if (!s) { s = { THREE, list: [], loose: true }; scenes.push(s); }
    const e = entry(THREE, obj, prop, part);
    if (e) { s.list.push(e); apply(THREE, [e], get()); }
    return e;
  }
  // The chosen colour as 0..1 numbers (for effects that build their colours themselves).
  function rgb(part) { const n = parseInt(get()[part].slice(1), 16); return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
  window.addEventListener('yannz:scythe', e => { for (const s of scenes) apply(s.THREE, s.list, e.detail); });

  // ---------------------------------------------------------------- 2D animations (intros, loading)
  // The canvas / CSS animations are drawn in crimson. tone() moves such a colour to the chosen effect
  // colour: the hue turns with it, saturation scales, and lightness is remapped so the default red
  // lands on the chosen colour while black stays black and white-hot stays white.
  const hsl = ([r, g, b]) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
  };
  const fromHsl = (h, s, l) => {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v + m)) * 255));
  };
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const toHex = a => '#' + a.map(v => v.toString(16).padStart(2, '0')).join('');
  function tone(c, fx = get().fx) {
    const rgb = typeof c === 'string' ? hexRgb(c) : c;
    if (fx === DEFAULT.fx) return rgb.slice(0, 3);
    const [hd, sd, ld] = hsl(hexRgb(DEFAULT.fx)), [hc, sc, lc] = hsl(hexRgb(fx)), [h, s, l] = hsl(rgb);
    const L = l <= ld ? l * lc / ld : lc + (l - ld) / (1 - ld) * (1 - lc);
    return fromHsl(((h + hc - hd) % 360 + 360) % 360, Math.min(1, s * sc / sd), L);
  }
  // CSS: --scythe-fx is the site crimson (#c8202f) in the chosen effect colour.
  function cssVars(c) { document.documentElement.style.setProperty('--scythe-fx', toHex(tone('#c8202f', c.fx))); }

  // The 2D scythe picture is a render of the 3D model; scythe-mark-parts.png says which part each
  // pixel belongs to (red = handle, green = head, blue or uncovered = effects). A recoloured pixel
  // keeps its own brightness, like the 3D materials do.
  const MARK = '/assets/scythe-mark.webp', PARTS = '/assets/scythe-mark-parts.png';
  const lin = v => (v /= 255) <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  const srgb = v => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(Math.min(1, v), 1 / 2.4) - 0.055));
  const lumLin = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const img = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  let markKey = '', markUrl = null;
  function mark(c = get()) {
    if (!custom(c)) return Promise.resolve(MARK);
    const key = c.handle + c.head + c.fx;
    if (key === markKey && markUrl) return markUrl;
    markKey = key;
    markUrl = Promise.all([img(MARK), img(PARTS)]).then(([base, parts]) => {
      const w = base.naturalWidth, h = base.naturalHeight;
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      const x = cv.getContext('2d', { willReadFrequently: true });
      x.drawImage(parts, 0, 0, w, h);
      const map = x.getImageData(0, 0, w, h).data;
      x.clearRect(0, 0, w, h);
      x.drawImage(base, 0, 0);
      const data = x.getImageData(0, 0, w, h), px = data.data;
      const part = {};
      for (const p of ['handle', 'head', 'fx']) {
        if (c[p] === DEFAULT[p]) continue;
        const d = hexRgb(DEFAULT[p]).map(lin), want = hexRgb(c[p]).map(lin);
        part[p] = { want, ld: Math.max(0.02, lumLin(...d)) };
      }
      for (let i = 0; i < px.length; i += 4) {
        if (!px[i + 3]) continue;
        const r = map[i], g = map[i + 1], b = map[i + 2], covered = map[i + 3] > 127;
        if (covered && !r && !g && !b) continue;          // pieces with no part (socket, leaves)
        const p = !covered ? 'fx' : r >= g && r >= b ? 'handle' : g >= b ? 'head' : 'fx';
        const t = part[p];
        if (!t) continue;
        const k = lumLin(lin(px[i]), lin(px[i + 1]), lin(px[i + 2])) / t.ld;
        px[i] = srgb(t.want[0] * k); px[i + 1] = srgb(t.want[1] * k); px[i + 2] = srgb(t.want[2] * k);
      }
      x.putImageData(data, 0, 0);
      return new Promise(ok => cv.toBlob(b => ok(b ? URL.createObjectURL(b) : cv.toDataURL()), 'image/png'));
    }).catch(() => MARK);
    return markUrl;
  }
  function marks(c = get()) {
    const list = document.querySelectorAll('img[data-scythe-mark]');
    if (list.length) mark(c).then(u => list.forEach(i => { if (i.getAttribute('src') !== u) i.src = u; }));
  }
  window.addEventListener('yannz:scythe', e => { cssVars(e.detail); marks(e.detail); });
  cssVars(get());
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => marks()); else marks();

  // ---------------------------------------------------------------- the small colour panel
  let panel = null;
  function close() { panel?.remove(); panel = null; document.removeEventListener('pointerdown', outside, true); document.removeEventListener('keydown', esc); }
  function outside(e) { if (panel && !panel.contains(e.target)) close(); }
  function esc(e) { if (e.key === 'Escape') close(); }
  function open(x, y) {
    close();
    panel = document.createElement('div');
    panel.className = 'yz-scythe-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Warna scythe');
    const c = get();
    panel.innerHTML = `<style>
      .yz-scythe-panel{position:fixed;z-index:400;width:min(300px,calc(100vw - 24px));padding:14px;border:3px solid var(--edge,#d4d4d8);border-radius:14px;background:var(--surface,var(--paper,#141416));color:var(--ink,#f4f4f5);box-shadow:6px 6px 0 var(--drop,#3f3f46);font:500 13px Outfit,system-ui,sans-serif}
      .yz-scythe-panel b.t{display:block;font:700 16px 'Space Grotesk',sans-serif;margin:0 0 10px}
      .yz-row{display:grid;grid-template-columns:1fr 44px 86px;gap:8px;align-items:center;margin:0 0 8px}
      .yz-row label{font:700 11px 'DM Mono',monospace;letter-spacing:.06em;text-transform:uppercase}
      .yz-row input[type=color]{width:44px;height:34px;padding:0;border:2px solid var(--edge,#d4d4d8);border-radius:8px;background:none;cursor:pointer}
      .yz-row input[type=text]{width:86px;padding:6px 8px;border:2px solid var(--edge-soft,#3f3f46);border-radius:8px;background:var(--surface-2,#1b1b1e);color:inherit;font:600 12px 'DM Mono',monospace;text-transform:uppercase}
      .yz-row[data-on] label{color:var(--accent,#c8202f)}
      .yz-sw{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 12px}
      .yz-sw button{width:24px;height:24px;border-radius:6px;border:2px solid var(--edge,#d4d4d8);padding:0;cursor:pointer;box-shadow:none}
      .yz-act{display:flex;gap:8px}
      .yz-act button{flex:1;padding:8px;border:2px solid var(--edge,#d4d4d8);border-radius:9px;background:var(--surface-2,#1b1b1e);color:inherit;font:700 11px 'DM Mono',monospace;text-transform:uppercase;cursor:pointer;box-shadow:3px 3px 0 var(--drop,#3f3f46)}
      .yz-act button.p{background:var(--accent,#c8202f);color:var(--accent-ink,#fff);border-color:var(--accent,#c8202f)}
      .yz-note{margin:8px 0 0;font-size:11px;color:var(--muted,#a1a1aa)}</style>
      <b class="t">Warna scythe</b>
      ${['handle', 'head', 'fx'].map(p => `<div class="yz-row" data-part="${p}"${p === 'fx' ? ' data-on' : ''}><label for="yz-${p}">${LABEL[p]}</label><input type="color" id="yz-${p}" value="${c[p]}"><input type="text" maxlength="7" value="${c[p].toUpperCase()}" aria-label="${LABEL[p]} (HEX)" spellcheck="false"></div>`).join('')}
      <div class="yz-sw" role="group" aria-label="Warna cepat">${SWATCHES.map(s => `<button type="button" data-c="${s}" style="background:${s}" aria-label="Warna ${s}"></button>`).join('')}</div>
      <div class="yz-act"><button type="button" data-a="reset">Reset</button><button type="button" class="p" data-a="done">Selesai</button></div>
      <p class="yz-note">Warna efek dipakai juga buat semua skill.</p>`;
    document.body.append(panel);
    const w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.max(12, Math.min(innerWidth - w - 12, x - w / 2)) + 'px';
    panel.style.top = Math.max(12, Math.min(innerHeight - h - 12, y + 16)) + 'px';
    let active = 'fx';
    const sync = colours => panel.querySelectorAll('.yz-row').forEach(r => { const v = colours[r.dataset.part]; r.querySelector('[type=color]').value = v; const t = r.querySelector('[type=text]'); if (document.activeElement !== t) t.value = v.toUpperCase(); });
    const change = (part, v) => { const next = { ...get(), [part]: v.toLowerCase() }; set(next); sync(next); };
    panel.querySelectorAll('.yz-row').forEach(r => {
      const part = r.dataset.part;
      const pick = () => { active = part; panel.querySelectorAll('.yz-row').forEach(x => x.toggleAttribute('data-on', x === r)); };
      r.addEventListener('focusin', pick); r.addEventListener('pointerdown', pick);
      r.querySelector('[type=color]').addEventListener('input', e => change(part, e.target.value));
      r.querySelector('[type=text]').addEventListener('input', e => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = '#' + v; if (HEX.test(v)) change(part, v); });
    });
    panel.querySelector('.yz-sw').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) change(active, b.dataset.c); });
    panel.querySelector('[data-a=reset]').addEventListener('click', () => sync(set(DEFAULT)));
    panel.querySelector('[data-a=done]').addEventListener('click', close);
    setTimeout(() => { document.addEventListener('pointerdown', outside, true); document.addEventListener('keydown', esc); }, 0);
    panel.querySelector('#yz-fx').focus({ preventScroll: true });
  }

  window.YannzScythe = { DEFAULT, PART, get, set, custom: () => custom(get()), paint, track, rgb, tone, mark, open, close };
})();
