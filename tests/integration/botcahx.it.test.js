'use strict';
// BOTCAHX endpoints (plugin/botcahx.js + lib/apiproxy.js). Upstreams are stubbed: nothing leaves the
// machine. Checks the catalog, the key staying server-side, renamed parameters, images passed
// through, and the failover onto BOTCAHX backups.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let calls = [];
let reply = () => ({ status: 200, json: { status: true, creator: 'BOTCAHX', code: 200, result: { ok: 1 } } });
let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (['api.botcahx.eu.org', 'api.dongtube.id', 'api.nexray.eu.cc'].includes(u.hostname)) {
      calls.push({ host: u.hostname, path: u.pathname, query: Object.fromEntries(u.searchParams) });
      const r = reply(u);
      if (r.image) return new Response(r.image, { status: 200, headers: { 'content-type': 'image/gif' } });
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({});
  user = await app.login('botcahx@example.test');
});
after(async () => { global.fetch = realFetch; delete process.env.BOTCAHX_API_KEY; delete process.env.DONGTUBE_API_KEY; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, json: { status: true, creator: 'BOTCAHX', code: 200, result: { ok: 1 } } });
  process.env.BOTCAHX_API_KEY = 'bkey';
  delete process.env.DONGTUBE_API_KEY;
  require('../../services/errorLogService').resetHidden();
  require('../../services/failoverService').reset();
});
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = p => app.request('GET', p, app.asBrowser(user));
const catalog = async () => (await app.request('GET', '/api/endpoints')).json.endpoints;

it('catalog lists the new BOTCAHX endpoints (Islamic is a new category); backups and adult search stay out', async () => {
  const cat = await catalog();
  assert.ok(cat.Islamic.some(e => e.cleanPath === '/api/islamic/surah'));
  assert.ok(cat.News.some(e => e.cleanPath === '/api/news/detik'));
  assert.ok(cat.Search.some(e => e.cleanPath === '/api/search/google'));
  assert.ok(cat.Maker.some(e => e.cleanPath === '/api/maker/attp'));
  const all = Object.values(cat).flat().map(e => e.cleanPath);
  assert.ok(!all.some(p => p.startsWith('/api/alt2/')), 'backups are not listed on their own');
  assert.ok(!all.some(p => /xvideos/.test(p)));
});

it('the key goes upstream as ?apikey=, never back to the caller; BOTCAHX branding is dropped', async () => {
  const r = await get('/api/islamic/surah?no=1');
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([calls[0].host, calls[0].path, calls[0].query.no, calls[0].query.apikey], ['api.botcahx.eu.org', '/api/islamic/surah', '1', 'bkey']);
  assert.deepEqual(r.json.result, { ok: 1 });
  assert.notEqual(r.json.creator, 'BOTCAHX');
  assert.equal(r.json.code, undefined);
  assert.ok(!r.text.includes('bkey'));
});

it('our parameter names are renamed to BOTCAHX\'s: q -> text1 (Google), url -> link (TinyURL)', async () => {
  await get('/api/search/google?q=nodejs');
  assert.equal(calls[0].query.text1, 'nodejs');
  assert.equal(calls[0].query.q, undefined);
  await get('/api/tools/tinyurl?url=https://example.com');
  assert.equal(calls[1].path, '/api/tools/tinyurl');
  assert.equal(calls[1].query.link, 'https://example.com');
});

it('images come straight through (ATTP is a GIF); "status: false" from BOTCAHX is an error, not a result', async () => {
  reply = () => ({ image: Buffer.from('GIF89a-test') });
  const img = await get('/api/maker/attp?text=halo');
  assert.equal(img.status, 200);
  assert.match(img.headers['content-type'], /^image\/gif/);
  reply = () => ({ status: 200, json: { status: false, creator: 'BOTCAHX', message: 'masukan parameter url' } });
  const bad = await get('/api/download/snackvideo?url=https://s.snackvideo.com/p/x');
  assert.equal(bad.status, 502);
  assert.match(bad.json.message, /masukan parameter url/);
});

it('without BOTCAHX_API_KEY its endpoints answer "belum aktif" and nothing is sent', async () => {
  delete process.env.BOTCAHX_API_KEY;
  const r = await get('/api/news/detik');
  assert.equal(r.status, 503);
  assert.equal(calls.length, 0);
});

it('an existing endpoint falls back to BOTCAHX: Dongtube CNN news down -> BOTCAHX CNN', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  reply = u => (u.hostname === 'api.dongtube.id' ? { status: 500, json: { status: false, error: 'down' } } : { status: 200, json: { status: true, creator: 'BOTCAHX', result: [{ berita: 'x' }] } });
  const r = await get('/api/news/cnn');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/alt2/news/cnn');
  assert.deepEqual(calls.map(c => c.host), ['api.dongtube.id', 'api.botcahx.eu.org']);
  assert.equal(calls[1].path, '/api/news/cnn');
});

it('backups get their own parameter names: Wikipedia q -> text', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  reply = u => (u.hostname === 'api.botcahx.eu.org' ? { status: 200, json: { status: true, result: { title: 'Indonesia' } } } : { status: 502, json: { status: false, message: 'server error' } });
  const r = await get('/api/search/wikipedia?q=indonesia');
  assert.equal(r.status, 200, r.text);
  const last = calls.at(-1);
  assert.equal(last.host, 'api.botcahx.eu.org');
  assert.equal(last.path, '/api/search/wikipedia');
  assert.equal(last.query.text, 'indonesia');
});
