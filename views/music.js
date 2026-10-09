// Website background music: a play/pause button bottom-right with its own volume control.
// The full song plays automatically on every page and loops. Browsers only allow sound after the
// visitor has clicked or typed on the page; when the browser blocks it, the song starts at the
// visitor's first click or key press anywhere on the page. Pressing pause stops it on every page
// until play is pressed again. Volume, mute and the position in the song are remembered in this
// browser, so the music carries on from the same spot between pages. Song info comes from
// /api/site-music.
(() => {
  if (window.__yannzMusic) return;
  window.__yannzMusic = true;

  const KEY = 'yannz-music';
  const INFO_KEY = 'yannz-music-info';
  const load = (store, key) => { try { return JSON.parse(store.getItem(key) || 'null'); } catch { return null; } };
  const save = (store, key, v) => { try { store.setItem(key, JSON.stringify(v)); } catch {} };
  const state = Object.assign({ vol: 0.5, muted: false, playing: false, paused: false, t: 0, at: 0 }, load(localStorage, KEY) || {});
  const persist = () => save(localStorage, KEY, { vol: state.vol, muted: state.muted, playing: state.playing, paused: state.paused, t: state.t, at: Date.now() });

  const css = `
  .ym-dock{position:fixed;right:18px;bottom:18px;z-index:88;display:flex;align-items:center;gap:6px;padding:5px;border:2px solid var(--edge,#d4d4d8);border-radius:999px;background:#111113;box-shadow:4px 4px 0 var(--drop,#3f3f46);font:600 11px 'DM Mono',ui-monospace,monospace;color:#f4f4f5}
  body:has(.yc-fab) .ym-dock{bottom:78px}
  .ym-btn{display:grid;place-items:center;width:40px;height:40px;padding:0;border:0;border-radius:50%;background:#1d1d21;color:#f4f4f5;cursor:pointer;box-shadow:none;transition:background .15s,transform .15s}
  .ym-btn:hover{background:#2a2a30;transform:none}
  .ym-btn:focus-visible{outline:2px solid #f4f4f5;outline-offset:2px}
  .ym-play{background:var(--accent,#c8202f);color:#fff}
  .ym-play:hover{background:var(--red-deep,#a3172a)}
  .ym-btn svg{width:18px;height:18px;fill:currentColor}
  .ym-dock[data-state=loading] .ym-play svg{animation:ym-spin 1s linear infinite}
  .ym-dock[data-state=error] .ym-play{background:#3f3f46}
  .ym-dock[data-wait] .ym-play{animation:ym-pulse 1.6s ease-in-out infinite}
  @keyframes ym-spin{to{transform:rotate(360deg)}}
  @keyframes ym-pulse{50%{box-shadow:0 0 0 6px rgba(200,32,47,.35)}}
  .ym-pop{position:absolute;right:0;bottom:calc(100% + 10px);width:230px;padding:12px 14px;border:2px solid var(--edge,#d4d4d8);border-radius:14px;background:#111113;box-shadow:4px 4px 0 var(--drop,#3f3f46)}
  .ym-pop[hidden]{display:none}
  .ym-title{display:block;color:#f4f4f5;font:600 12px 'Outfit',system-ui,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ym-sub{display:block;margin:2px 0 10px;color:#a1a1aa;font-size:10px;letter-spacing:.04em}
  .ym-row{display:flex;align-items:center;gap:10px}
  .ym-row input[type=range]{flex:1;min-width:0;width:auto;height:auto;margin:0;padding:0;border:0;border-radius:0;background:transparent;box-shadow:none;accent-color:var(--accent,#c8202f);cursor:pointer}
  .ym-pct{width:34px;text-align:right;color:#d4d4d8}
  @media (max-width:520px){.ym-dock{right:12px;bottom:12px}body:has(.yc-fab) .ym-dock{bottom:70px}}
  @media (prefers-reduced-motion:reduce){.ym-dock *{animation:none!important;transition:none!important}}`;
  const ICON = {
    play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
    load: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9h-2.2A6.8 6.8 0 1 1 12 5.2z"/></svg>',
    vol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM15.5 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.3 5.7a9 9 0 0 1 0 12.6l-1.4-1.4a7 7 0 0 0 0-9.8z"/></svg>',
    mute: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9zM16 9.4l1.4-1.4 2.1 2.1 2.1-2.1L23 9.4l-2.1 2.1 2.1 2.1-1.4 1.4-2.1-2.1-2.1 2.1-1.4-1.4 2.1-2.1z"/></svg>'
  };

  function build(info) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);

    const dock = document.createElement('div');
    dock.className = 'ym-dock';
    dock.setAttribute('role', 'region');
    dock.setAttribute('aria-label', 'Musik website');
    dock.innerHTML = `<div class="ym-pop" hidden><span class="ym-title"></span><span class="ym-sub">Diputar terus (loop)</span>
      <div class="ym-row"><button type="button" class="ym-btn ym-mute"></button><input type="range" min="0" max="100" step="1" aria-label="Volume musik"><span class="ym-pct"></span></div></div>
      <button type="button" class="ym-btn ym-vol" aria-haspopup="true" aria-expanded="false" aria-label="Atur volume"></button>
      <button type="button" class="ym-btn ym-play"></button>`;
    document.body.append(dock);

    const $ = s => dock.querySelector(s);
    const play = $('.ym-play'), volBtn = $('.ym-vol'), pop = $('.ym-pop'), range = $('input'), pct = $('.ym-pct'), mute = $('.ym-mute');
    const song = [info.title, info.author].filter(Boolean).join(' — ') || 'Lagu website';
    $('.ym-title').textContent = song;
    if (info.title || info.author) $('.ym-title').setAttribute('data-no-i18n', '');   // the song's name is data, never translated
    $('.ym-title').title = song;

    const audio = new Audio();
    audio.loop = true;
    audio.preload = 'none';
    let started = false;

    function render() {
      const s = dock.dataset.state;
      play.innerHTML = s === 'loading' ? ICON.load : s === 'playing' ? ICON.pause : ICON.play;
      play.setAttribute('aria-label', s === 'playing' ? `Jeda lagu: ${song}` : s === 'error' ? 'Lagunya nggak bisa diputar' : `Putar lagu: ${song}`);
      play.setAttribute('aria-pressed', String(s === 'playing'));
      play.title = s === 'error' ? 'Lagunya lagi nggak bisa diputar' : song;
      const silent = state.muted || state.vol === 0;
      volBtn.innerHTML = silent ? ICON.mute : ICON.vol;
      mute.innerHTML = silent ? ICON.mute : ICON.vol;
      mute.setAttribute('aria-label', silent ? 'Nyalain suara' : 'Matiin suara');
      range.value = String(Math.round(state.vol * 100));
      pct.textContent = `${Math.round(state.vol * 100)}%`;
    }
    function applyVolume() { audio.volume = state.vol; audio.muted = state.muted; }
    function setState(s) { dock.dataset.state = s; render(); }

    const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];
    let waiting = null;
    function waitForGesture() {
      if (waiting) return;
      dock.dataset.wait = '';
      waiting = ev => {
        if (ev.target instanceof Node && dock.contains(ev.target)) return;   // the player's own buttons handle themselves
        GESTURES.forEach(t => removeEventListener(t, waiting, true));
        waiting = null;
        if (!state.paused) start(true);
      };
      GESTURES.forEach(t => addEventListener(t, waiting, true));
    }

    async function start(fromUser) {
      if (fromUser) state.paused = false;
      if (!started) {
        audio.src = info.src;
        if (state.t > 0) audio.addEventListener('loadedmetadata', () => { try { audio.currentTime = state.t % (audio.duration || Infinity); } catch {} }, { once: true });
        started = true;
      }
      applyVolume();
      setState('loading');
      try {
        await audio.play();
        delete dock.dataset.wait;
        state.playing = true; persist();
        setState('playing');
      } catch (e) {
        if (e && e.name === 'NotAllowedError') {
          // The browser wants a click first: start at the visitor's first click or key press.
          setState('paused');
          waitForGesture();
        } else if (e && e.name !== 'AbortError') {
          setState('error');
        }
      }
    }
    function stop() {
      audio.pause();
      state.playing = false; state.paused = true; persist();
      setState('paused');
    }

    play.addEventListener('click', () => (dock.dataset.state === 'playing' ? stop() : start(true)));
    volBtn.addEventListener('click', () => {
      pop.hidden = !pop.hidden;
      volBtn.setAttribute('aria-expanded', String(!pop.hidden));
      if (!pop.hidden) range.focus();
    });
    range.addEventListener('input', () => {
      state.vol = Number(range.value) / 100;
      if (state.vol > 0) state.muted = false;
      applyVolume(); persist(); render();
    });
    mute.addEventListener('click', () => {
      if (state.muted || state.vol === 0) { state.muted = false; if (state.vol === 0) state.vol = 0.5; }
      else state.muted = true;
      applyVolume(); persist(); render();
    });
    document.addEventListener('click', e => { if (!dock.contains(e.target) && !pop.hidden) { pop.hidden = true; volBtn.setAttribute('aria-expanded', 'false'); } });
    dock.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) { pop.hidden = true; volBtn.setAttribute('aria-expanded', 'false'); volBtn.focus(); } });

    audio.addEventListener('error', () => { if (started) { state.playing = false; persist(); setState('error'); } });
    let lastSave = 0;
    audio.addEventListener('timeupdate', () => { state.t = audio.currentTime; if (Date.now() - lastSave > 2000) { lastSave = Date.now(); persist(); } });
    addEventListener('pagehide', () => { if (started) state.t = audio.currentTime; persist(); });

    setState('paused');
    // Autoplay unless the visitor paused it. Within 30 minutes of the last page it carries on from
    // the same spot; otherwise the song starts from the beginning.
    if (Date.now() - (state.at || 0) > 30 * 60 * 1000) state.t = 0;
    if (!state.paused) start(false);
  }

  async function init() {
    let info = load(sessionStorage, INFO_KEY);
    if (!info || Date.now() - info.at > 10 * 60 * 1000) {
      try {
        const r = await fetch('/api/site-music', { credentials: 'same-origin' });
        const d = await r.json();
        if (!d || d.enabled === false) return;
        if (!r.ok || !d.status) info = { src: '/api/site-music/audio', title: null, author: null, at: 0 };
        else { info = { src: d.src, title: d.title, author: d.author, at: Date.now() }; save(sessionStorage, INFO_KEY, info); }
      } catch { info = { src: '/api/site-music/audio', title: null, author: null, at: 0 }; }
    }
    build(info);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
