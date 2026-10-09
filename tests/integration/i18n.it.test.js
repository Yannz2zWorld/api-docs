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
});

let app;
// A tiny request limit, to check page assets never count against it.
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp({ RATE_LIMIT_PER_MINUTE: '4' }); });
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
  // No real endpoint path is ever translated (the panel's "/api/kategori/nama" hint is fine).
  const paths = Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat().map(e => e.cleanPath);
  assert.ok(paths.length > 10);
  assert.deepEqual(paths.filter(p => p in dict.exact), []);
  const page = await app.request('GET', '/pricing');
  assert.match(page.text, /<script src="\/assets\/i18n\.js"><\/script>/);
});

test('page assets never hit the request limit and the dictionary is always revalidated', { skip: h.skip }, async () => {
  for (let i = 0; i < 12; i++) {
    for (const url of ['/assets/i18n-en.json', '/assets/i18n.js', '/assets/theme.css', '/assets/music.js']) {
      const r = await app.request('GET', url);
      assert.equal(r.status, 200, `${url} #${i}`);
    }
  }
  const d = await app.request('GET', '/assets/i18n-en.json');
  assert.equal(d.headers['cache-control'], 'no-cache');
  assert.ok(d.headers.etag, 'ETag so unchanged copies answer 304');
  const again = await app.request('GET', '/assets/i18n-en.json', { headers: { 'if-none-match': d.headers.etag } });
  assert.equal(again.status, 304);
  assert.equal((await app.request('GET', '/assets/i18n.js')).headers['cache-control'], 'no-cache');
});

test('dropdown labels (select.js) translate, endpoint names stay as they are', () => {
  const pats = dict.patterns.map(([re, to]) => [new RegExp(re), to]);
  const first = t => pats.find(([re]) => re.test(t));
  assert.equal('Pilih endpoint: Bard Chat — /api/ai/bard'.replace(...first('Pilih endpoint: Bard Chat — /api/ai/bard')), 'Choose endpoint: Bard Chat — /api/ai/bard');
  assert.ok(first('Pilih: FREE'));
});
