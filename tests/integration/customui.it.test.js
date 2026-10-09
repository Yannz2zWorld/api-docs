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
    matchMedia: () => ({ matches: false }), addEventListener() {}, setInterval: () => 1, clearInterval() {} };
  vm.runInNewContext(view('ui-theme.js'), sandbox);
  const UI = sandbox.window.YannzUI;
  assert.ok(Object.keys(UI.STYLES).length >= 8);
  for (const k of ['default', 'cream', 'pop', 'neon', 'glass', 'minimal', 'terminal']) assert.ok(UI.STYLES[k], k);
  assert.equal(UI.inkOn('#ffd60a'), '#0a0a0a', 'dark text on yellow');
  assert.equal(UI.inkOn('#6366f1'), '#ffffff', 'white text on indigo');
  UI.set({ style: 'cream', accent: '#123456', rgb: false });
  assert.equal(root.attrs['data-ui'], 'cream');
  assert.equal(root.style.props['--accent'], '#123456');
  assert.deepEqual(JSON.parse(store['yannz-ui']), { style: 'cream', accent: '#123456', rgb: false });
  UI.set({ style: 'default', accent: '', rgb: false });
  assert.equal(root.attrs['data-ui'], undefined, 'the original look needs no override');
  store['yannz-ui'] = '{"style":"nope","accent":"red"}';
  assert.deepEqual({ ...UI.load() }, { style: 'default', accent: '', rgb: false }, 'bad saved values fall back');
});
