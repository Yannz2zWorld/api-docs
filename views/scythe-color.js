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
  function get() { return clean(window.YannzUI ? window.YannzUI.load().scythe : null); }

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

  window.YannzScythe = { DEFAULT, PART, get, set, paint, track, rgb, open, close };
})();
