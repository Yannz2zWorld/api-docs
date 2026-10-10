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
    setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } };
  const sandbox = { window: {}, localStorage: { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = v; } },
    document: { documentElement: root, head: { append() {} }, getElementById: () => null, createElement: () => ({}) },
    matchMedia: () => ({ matches: false }), addEventListener() {}, setInterval: () => 1, clearInterval() {},
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
  assert.deepEqual(JSON.parse(store['yannz-ui']), { style: 'cream', accent: '#123456', rgb: false, uid: null }, 'kept in the browser (account not known in this sandbox)');
  UI.set({ style: 'default', accent: '', rgb: false });
  assert.equal(root.attrs['data-ui'], undefined, 'the original look needs no override');
  store['yannz-ui'] = '{"style":"nope","accent":"red"}';
  assert.deepEqual({ ...UI.load() }, { style: 'default', accent: '', rgb: false }, 'bad saved values fall back');
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
