'use strict';
// Website translation (views/i18n.js + views/i18n-en.json): served, loaded on every page, and the
// dictionary is well formed and never contains endpoint data.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const VIEWS = path.join(__dirname, '..', '..', 'views');
const dict = JSON.parse(fs.readFileSync(path.join(VIEWS, 'i18n-en.json'), 'utf8'));
const PAGES = ['index.html', 'login.html', 'pricing.html', 'maintenance.html', 'owner.html', 'api.html', 'playground.html', 'keys.html', 'profile.html', 'billing.html', 'upload.html', 'scythe.html'];

test('every page loads the translator synchronously in <head> and has a language switch', () => {
  for (const page of PAGES) {
    const html = fs.readFileSync(path.join(VIEWS, page), 'utf8');
    const head = html.slice(0, html.indexOf('</head>'));
    assert.match(head, /<script src="\/assets\/i18n\.js"><\/script>/, `${page} loads i18n.js in <head>`);
    if (page !== 'maintenance.html') assert.match(html, /data-lang-switch/, `${page} has the Terjemahan switch`);
  }
});

test('the dictionary is well formed', () => {
  assert.ok(Object.keys(dict.exact).length > 300, 'covers the site');
  for (const [k, v] of Object.entries(dict.exact)) {
    assert.equal(typeof v, 'string', k);
    assert.ok(v.trim(), `empty translation for ${k}`);
  }
  for (const [re, to] of dict.patterns) {
    assert.doesNotThrow(() => new RegExp(re), re);
    assert.ok(re.startsWith('^') && re.endsWith('$'), `pattern ${re} is anchored`);
    assert.equal(typeof to, 'string');
  }
});

test('endpoint names, descriptions and paths are never in the dictionary', () => {
  const pluginDir = path.join(__dirname, '..', '..', 'plugin');
  const texts = new Set();
  for (const f of fs.readdirSync(pluginDir).filter(f => f.endsWith('.js'))) {
    const src = fs.readFileSync(path.join(pluginDir, f), 'utf8');
    for (const m of src.matchAll(/\b(?:name|desc|description)\s*:\s*(['"`])((?:(?!\1).){12,}?)\1/g)) texts.add(m[2].replace(/\s+/g, ' ').trim());
  }
  const keys = new Set(Object.keys(dict.exact));
  const leaked = [...texts].filter(t => keys.has(t));
  assert.deepEqual(leaked, []);
  assert.ok(![...keys].some(k => /^\/api\//.test(k)), 'no endpoint paths');
});

let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });

test('the translator and the dictionary are served', { skip: h.skip }, async () => {
  const js = await app.request('GET', '/assets/i18n.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  assert.match(js.text, /yannz-lang/);
  const json = await app.request('GET', '/assets/i18n-en.json');
  assert.equal(json.status, 200);
  assert.match(json.headers['content-type'], /json/);
  assert.deepEqual(Object.keys(json.json).sort(), ['exact', 'patterns']);
  const page = await app.request('GET', '/pricing');
  assert.match(page.text, /<script src="\/assets\/i18n\.js"><\/script>/);
});
