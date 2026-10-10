'use strict';
// Custom UI (/custom-ui + views/ui-theme.js): signed-in visitors pick a look and a colour; every page
// after sign-in loads the theme script and shows the menu link.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./helpers');

let app, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('ui@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const view = f => fs.readFileSync(path.join(__dirname, '..', '..', 'views', f), 'utf8');

it('the Custom UI page is for signed-in visitors', async () => {
  const anon = await app.request('GET', '/custom-ui');
  assert.equal(anon.status, 302);
  const r = await app.request('GET', '/custom-ui', { cookie: user });
  assert.equal(r.status, 200);
  assert.match(r.text, /<h1>Custom UI<\/h1>/);
  for (const id of ['picker', 'r-range', 'g-range', 'b-range', 'hex', 'rgb', 'looks', 'swatches']) assert.match(r.text, new RegExp(`id="${id}"`), id);
  const js = await app.request('GET', '/assets/ui-theme.js');
  assert.equal(js.status, 200);
});

it('every page after sign-in loads the theme and has "Custom UI" in its menu', () => {
  for (const f of ['index.html', 'api.html', 'billing.html', 'keys.html', 'owner.html', 'playground.html', 'pricing.html', 'profile.html', 'upload.html', 'custom-ui.html']) {
    const html = view(f);
    assert.match(html, /<script src="\/assets\/ui-theme\.js"><\/script>/, f);
    assert.match(html, /href="\/custom-ui"/, f);
  }
});

it('looks and colours: many looks, any colour, readable text on it, RGB mode', () => {
  const store = {};
  const root = { attrs: {}, style: { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } },
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, hasAttribute: () => false };
  const sandbox = { window: {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { documentElement: root, head: { append() {} }, getElementById: () => null, createElement: () => ({}) },
    matchMedia: () => ({ matches: false }), addEventListener() {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, performance: { now: () => 0 },
    fetch: async () => ({ ok: false, json: async () => ({}) }) };
  vm.runInNewContext(view('ui-theme.js'), sandbox);
  const UI = sandbox.window.YannzUI;
  assert.ok(Object.keys(UI.STYLES).length >= 8);
  for (const k of ['default', 'cream', 'pop', 'neon', 'glass', 'minimal', 'terminal']) assert.ok(UI.STYLES[k], k);
  // No "AI glow" anywhere: flat, hard-edged shadows only; no glow, blur or glowing gradients.
  const css = [];
  sandbox.document.createElement = () => ({ set textContent(v) { css.push(v); } });
  sandbox.document.getElementById = () => null;
  for (const k of Object.keys(UI.STYLES)) UI.apply({ style: k, accent: '#22d3ee', rgb: false });
  const all = css.join('\n');
  assert.ok(css.length >= 8);
  assert.ok(!/\b0 0 \d+px|blur\(|text-shadow|drop-shadow|\d+px \d+px [1-9]\d*px/.test(all), 'no glow or soft/blurred shadows');
  assert.ok(!/radial-gradient\([^)]*(accent|%,transparent)/.test(all.replace(/radial-gradient\(var\(--dot\) 1\.2px,transparent 1\.2px\)/g, '')), 'no glowing gradients (only the dot pattern)');
  assert.ok(!/glow/i.test(view('ui-theme.js').replace('no glow', '')), 'no glow look');
  assert.equal(UI.inkOn('#ffd60a'), '#0a0a0a', 'dark text on yellow');
  assert.equal(UI.inkOn('#6366f1'), '#ffffff', 'white text on indigo');
  UI.set({ style: 'cream', accent: '#123456', rgb: false });
  assert.equal(root.attrs['data-ui'], 'cream');
  assert.equal(root.style.props['--accent'], '#123456');
  assert.deepEqual(JSON.parse(store['yannz-ui']), { style: 'cream', accent: '#123456', rgb: false, scythe: null, uid: null }, 'kept in the browser (account not known in this sandbox)');
  UI.set({ style: 'default', accent: '', rgb: false });
  assert.equal(root.attrs['data-ui'], undefined, 'the original look needs no override');
  store['yannz-ui'] = '{"style":"nope","accent":"red"}';
  assert.deepEqual({ ...UI.load() }, { style: 'default', accent: '', rgb: false, scythe: null }, 'bad saved values fall back');
});

it('the look is saved on the account: it follows the user, other accounts keep their own', async () => {
  assert.equal((await app.request('GET', '/api/profile/ui')).status, 401, 'signed-out: nothing to read');
  const first = await app.request('GET', '/api/profile/ui', { cookie: user });
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.ui, null, 'nothing chosen yet');
  const put = body => app.request('PUT', '/api/profile/ui', { cookie: user, headers: { origin: app.origin }, body });
  const saved = await put({ style: 'cream', accent: '#FFD60A', rgb: false });
  assert.equal(saved.status, 200, saved.text);
  assert.deepEqual(saved.json.ui, { style: 'cream', accent: '#ffd60a', rgb: false });
  // Another device / browser, same account: same look.
  assert.deepEqual((await app.request('GET', '/api/profile/ui', { cookie: user })).json.ui, { style: 'cream', accent: '#ffd60a', rgb: false });
  // Someone else keeps their own.
  const other = await app.login('ui-other@example.test');
  assert.equal((await app.request('GET', '/api/profile/ui', { cookie: other })).json.ui, null);
  // Only real looks and real colours; never from another site.
  assert.equal((await put({ style: 'hacker' })).status, 400);
  assert.equal((await put({ style: 'pop', accent: 'red;}body{display:none' })).status, 400);
  assert.equal((await app.request('PUT', '/api/profile/ui', { cookie: user, headers: { origin: 'https://evil.example' }, body: { style: 'pop' } })).status, 403);
  assert.deepEqual((await put({ style: 'pop', accent: '', rgb: true })).json.ui, { style: 'pop', accent: '', rgb: true });
});

it('the page script syncs with the account', () => {
  const js = view('ui-theme.js');
  assert.match(js, /fetch\('\/api\/profile\/ui'/);
  assert.match(js, /method: 'PUT'/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '021_user_ui.sql'), 'utf8'), /ADD COLUMN IF NOT EXISTS ui_prefs jsonb/);
});

it('RGB mode is paced by the page size and waits while the visitor scrolls or taps (it froze big pages)', () => {
  const store = {}, listeners = {}, timers = [];
  let now = 0, nodes = 300, hidden = false;
  const props = {};
  const sandbox = { window: {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { get hidden() { return hidden; }, documentElement: { style: { setProperty(k, v) { props[k] = v; }, removeProperty(k) { delete props[k]; } }, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false },
      head: { append() {} }, getElementById: () => null, createElement: () => ({}), getElementsByTagName: () => ({ length: nodes }) },
    matchMedia: () => ({ matches: false }), addEventListener: (t, f) => { listeners[t] = f; }, dispatchEvent() {}, CustomEvent: class {},
    setInterval: () => { throw new Error('no fixed 60 ms interval'); }, clearInterval() {},
    setTimeout: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimeout() {}, performance: { now: () => now }, fetch: async () => ({ ok: false }) };
  vm.runInNewContext(view('ui-theme.js'), sandbox);
  sandbox.window.YannzUI.apply({ style: 'default', accent: '', rgb: true });
  const tick = () => { const t = timers.shift(); now += t.ms; t.f(); return t.ms; };
  assert.equal(timers.at(-1).ms, 60, 'a small page: smooth steps');
  let before = props['--accent']; tick();
  assert.notEqual(props['--accent'], before, 'the colour moves');
  nodes = 18000;
  assert.equal(tick(), 60); assert.equal(timers.at(-1).ms, 500, 'thousands of elements (Developer panel): a step every 0.5 s');
  for (const t of ['pointerdown', 'wheel', 'touchmove', 'keydown', 'scroll']) assert.equal(typeof listeners[t], 'function', t);
  listeners.wheel(); before = props['--accent']; tick();
  assert.equal(props['--accent'], before, 'held while the visitor scrolls');
  now += 1600; tick();
  assert.notEqual(props['--accent'], before, 'moves again after the scrolling stops');
  hidden = true; before = props['--accent']; tick();
  assert.equal(props['--accent'], before, 'still while the tab is hidden');
});

it('29 looks, the same list on the page and on the server', async () => {
  const store = {};
  const sandbox = { window: {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { documentElement: { style: { setProperty() {}, removeProperty() {} }, setAttribute() {}, removeAttribute() {}, hasAttribute: () => false }, head: { append() {} }, getElementById: () => null, createElement: () => ({}) },
    matchMedia: () => ({ matches: false }), addEventListener() {}, dispatchEvent() {}, CustomEvent: class {}, setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {}, performance: { now: () => 0 }, fetch: async () => ({ ok: false }) };
  vm.runInNewContext(view('ui-theme.js'), sandbox);
  const ids = Object.keys(sandbox.window.YannzUI.STYLES);
  assert.equal(ids.length, 29);
  const put = body => app.request('PUT', '/api/profile/ui', { cookie: user, headers: { origin: app.origin }, body });
  for (const id of ids) assert.equal((await put({ style: id })).status, 200, id);
});

it('scythe colours (handle / head / effects) are saved on the account with the look', async () => {
  const put = body => app.request('PUT', '/api/profile/ui', { cookie: user, headers: { origin: app.origin }, body });
  const r = await put({ style: 'lemon', accent: '', rgb: false, scythe: { handle: '#3B82F6', head: '#ffd60a', fx: '#22c55e' } });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual((await app.request('GET', '/api/profile/ui', { cookie: user })).json.ui.scythe, { handle: '#3b82f6', head: '#ffd60a', fx: '#22c55e' });
  assert.equal((await put({ style: 'lemon', scythe: { handle: 'red', head: '#ffd60a', fx: '#22c55e' } })).status, 400);
  assert.equal((await put({ style: 'lemon', scythe: { handle: '#ffffff' } })).status, 400, 'all three colours');
});

it('the scythe colour panel is reached by tapping the scythe (home, /3d) and on Custom UI, never a menu', () => {
  for (const f of ['index.html', 'login.html', 'custom-ui.html', 'scythe.html']) assert.match(view(f), /\/assets\/scythe-color\.js/, f);
  assert.match(view('scene3d.js'), /YannzScythe\.open\(e\.clientX, e\.clientY\)/);
  assert.match(view('scythe.html'), /SC\.open\(e\.clientX,e\.clientY\)/);
  assert.match(view('scythe.html'), /<html lang="id" data-no-theme>/, 'the game keeps its own design');
  assert.match(view('custom-ui.html'), /data-scene3d="preview"/);
  for (const f of ['index.html', 'custom-ui.html', 'owner.html']) assert.ok(!/href="[^"]*scythe-colou?r/.test(view(f)), 'no menu entry for it');
  const js = view('scythe-color.js');
  for (const part of ['handle', 'head', 'fx']) assert.match(js, new RegExp(`${part}: '#`));
});

it('every scythe animation follows the chosen effect colour: intros, loading screen, 2D picture, game flash', async () => {
  // tone(): the default colour leaves the crimson alone; another colour moves it there.
  const store = { 'yannz-ui': JSON.stringify({ scythe: { handle: '#f2ebe0', head: '#b8b4bc', fx: '#ff1a2c' } }) };
  const props = {};
  const sandbox = { window: {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { readyState: 'complete', documentElement: { style: { setProperty: (k, v) => { props[k] = v; } } }, querySelectorAll: () => [], addEventListener() {} },
    addEventListener() {}, dispatchEvent() {}, CustomEvent: class {}, Image: class {} };
  sandbox.window = sandbox;
  vm.runInNewContext(view('scythe-color.js'), sandbox);
  const SC = sandbox.YannzScythe;
  assert.deepEqual([...SC.tone([200, 32, 47])], [200, 32, 47], 'default: unchanged');
  assert.equal(props['--scythe-fx'], '#c8202f');
  assert.deepEqual([...SC.tone([200, 32, 47], '#ff1a2c')], [200, 32, 47]);
  const green = SC.tone([255, 26, 44], '#22c55e');
  assert.ok(green.every((v, i) => Math.abs(v - [0x22, 0xc5, 0x5e][i]) <= 2), 'the default red lands on the chosen colour: ' + green);
  assert.deepEqual([...SC.tone([255, 255, 255], '#22c55e')], [255, 255, 255], 'white-hot stays white');
  assert.deepEqual([...SC.tone([0, 0, 0], '#22c55e')], [0, 0, 0], 'black stays black');
  assert.equal(await SC.mark(), '/assets/scythe-mark.webp', 'default colours: the original picture');
  // The animations use it.
  for (const f of ['aura-intro.js', 'slash-intro.js']) {
    const js = view(f);
    assert.match(js, /YannzScythe/, f);
    assert.ok(!/rgba\((2\d\d|1[5-9]\d), ?\d{1,2}, ?\d{1,2}/.test(js), f + ': no fixed crimson left');
  }
  assert.match(view('aura-intro.js'), /SC\.mark\(\)/);
  assert.match(view('login.html'), /data-scythe-mark/);
  assert.match(view('login.html'), /\.load-scene \.load-aura\{[^}]*--scythe-fx/);
  assert.match(view('maintenance.html'), /data-scythe-mark/);
  assert.match(view('scythe.html'), /SC\.tone\(\[170,10,30\]\)/);
  assert.equal((await app.request('GET', '/assets/scythe-mark-parts.png')).status, 200);
});

it('once the UI is customised, no original red is left: pages use the UI colour, and the scythe effect follows it until set', () => {
  // 1. No fixed red in the page styles: only defaults that the theme overrides (`--x: #c8202f`,
  //    `var(--x, #c8202f)`) may still name it.
  const RED = /#(c8202f|a3172a|ef4444|f87171|fca5a5|fecaca|ff1a2c|ff2a3a|dc2626|b91c1c)\b|rgba?\((2\d\d|1[5-9]\d), ?(\d|[1-5]\d), ?(\d|[1-6]\d)[,)]/i;
  const files = ['index.html', 'login.html', 'api.html', 'playground.html', 'keys.html', 'billing.html', 'pricing.html', 'profile.html', 'upload.html', 'owner.html', 'maintenance.html', 'custom-ui.html', 'theme.css', 'chat.js', 'music.js', 'select.js', 'human-check.js', 'i18n.js', 'endpoint-monitor.js', 'announce.js'];
  for (const f of files) {
    let src = view(f).replace(/var\(--[\w-]+,\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))\)/gi, 'var()').replace(/--[\w-]+:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))/gi, '--x:0');
    if (f === 'custom-ui.html') src = src.replace(/const (SC_SW|SWATCHES) = \[[^\]]*\]/g, '');   // the colour choices themselves
    const m = src.match(RED);
    assert.equal(m, null, `${f}: fixed red ${m && m[0]}`);
  }
  const game = view('scythe.html').replace(/\n\s*--red:#c8202f; --red-deep:#a3172a;/, '');
  assert.ok(!/(color|background|border-color):\s*#(c8202f|fca5a5|a3172a)/.test(game), 'the /3d game styles use its colour variables');
  assert.match(view('maintenance.html'), /\/assets\/ui-theme\.js/, 'the maintenance page follows the look too');
  assert.match(view('ui-theme.js'), /data-no-theme[\s\S]*setProperty\('--red', a\)/, 'pages with their own design still take the colour');

  // 2. The scythe effect colour follows the UI colour while it is not customised.
  const run = pref => {
    const sandbox = { localStorage: { getItem: () => JSON.stringify(pref), setItem() {} },
      document: { readyState: 'complete', documentElement: { style: { setProperty() {} } }, querySelectorAll: () => [], addEventListener() {} },
      addEventListener() {}, dispatchEvent() {}, CustomEvent: class {}, Image: class {} };
    sandbox.window = sandbox;
    sandbox.YannzUI = { load: () => pref, accentOf: p => (p.style !== 'default' || p.accent ? p.accent || '#16a34a' : null) };
    vm.runInNewContext(view('scythe-color.js'), sandbox);
    return sandbox.YannzScythe;
  };
  assert.equal(run({ style: 'default', accent: '', scythe: null }).get().fx, '#ff1a2c', 'original UI: original red');
  const pink = run({ style: 'default', accent: '#ec4899', scythe: null });
  assert.equal(pink.get().fx, '#ec4899', 'pink UI: pink effects');
  assert.equal(pink.stored().fx, '#ff1a2c', 'still saved as "follow the UI"');
  assert.notDeepEqual([...pink.tone([200, 32, 47])], [200, 32, 47], 'intros and loading screens are not red');
  assert.equal(run({ style: 'mint', accent: '', scythe: null }).get().fx, '#16a34a', "a look's own colour");
  assert.equal(run({ style: 'default', accent: '#ec4899', scythe: { handle: '#f2ebe0', head: '#b8b4bc', fx: '#22c55e' } }).get().fx, '#22c55e', 'a chosen effect colour wins');
});
