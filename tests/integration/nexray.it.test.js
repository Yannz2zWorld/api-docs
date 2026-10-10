'use strict';
// NexRay endpoints (plugin/nexray.js + lib/apiproxy.js). Upstreams are stubbed: nothing leaves the
// machine. Checks the rules the endpoints were added by: new ones listed, a second working copy of an
// existing endpoint listed as the next version, a broken copy only a backup, and NexRay's own
// branding never reaching the caller.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
const STUBBED = ['api.nexray.eu.cc', 'api.dongtube.id', 'api.botcahx.eu.org'];
let calls = [];
let reply = () => ({ status: 200, json: { status: true, author: '@nexray - ElrayyXml', result: { ok: 1 }, timestamp: '2026-10-10T07:37:02.051Z', response_time: '1028ms' } });
let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (STUBBED.includes(u.hostname)) {
      calls.push({ host: u.hostname, path: u.pathname, query: Object.fromEntries(u.searchParams) });
      const r = reply(u);
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ NEXRAY: 'on' });
  user = await app.login('nexray@example.test');
});
after(async () => { global.fetch = realFetch; delete process.env.DONGTUBE_API_KEY; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, json: { status: true, author: '@nexray - ElrayyXml', result: { ok: 1 }, timestamp: 'x', response_time: '1ms' } });
  delete process.env.DONGTUBE_API_KEY;
  require('../../services/errorLogService').resetHidden();
  require('../../services/failoverService').reset();
});
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = p => app.request('GET', p, app.asBrowser(user));
const catalog = async () => (await app.request('GET', '/api/endpoints')).json.endpoints;

it('catalog: new endpoints and next versions are listed, backups and the left-out ones are not', async () => {
  const cat = await catalog();
  const all = Object.values(cat).flat().map(e => e.cleanPath);
  for (const p of ['/api/textpro/naruto', '/api/search/wallcraft', '/api/tools/webphishing', '/api/news/mlbb']) assert.ok(all.includes(p), `new: ${p}`);
  for (const p of ['/api/download/tiktok-v3', '/api/ai/claude-v2', '/api/search/youtube-v2', '/api/info/cuaca/v1']) assert.ok(all.includes(p), `version: ${p}`);
  assert.ok(!all.some(p => p.startsWith('/api/alt3/')), 'backups are not listed on their own');
  for (const left of ['/api/maker/fakedana', '/api/tools/nikparse', '/api/tools/spamngl', '/api/random/loli', '/api/textpro/pornhub', '/api/tools/vcc']) assert.ok(!all.includes(left), left);
  assert.ok(Object.keys(cat).includes('Textpro'));
});

it('a NexRay endpoint needs no key; its author, timestamp and response time are dropped', async () => {
  const r = await get('/api/textpro/naruto?text=yannz');
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([calls[0].host, calls[0].path, calls[0].query.text], ['api.nexray.eu.cc', '/textpro/naruto', 'yannz']);
  assert.equal(calls[0].query.apikey, undefined);
  assert.deepEqual(r.json.result, { ok: 1 });
  assert.ok(!/nexray|ElrayyXml/i.test(r.text), r.text);
  assert.equal(r.json.timestamp, undefined);
  assert.equal(r.json.response_time, undefined);
});

it('a version keeps the site\'s parameter names: Copilot v2 takes prompt= and sends NexRay text=', async () => {
  const r = await get('/api/ai/copilot-v2?prompt=halo');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].path, '/ai/copilot');
  assert.equal(calls[0].query.text, 'halo');
  assert.equal(calls[0].query.prompt, undefined);
});

it('an existing endpoint that breaks falls back to the NexRay copy: Tafsir Mimpi (Dongtube) -> NexRay', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  reply = u => (u.hostname === 'api.dongtube.id' ? { status: 500, json: { status: false, error: 'down' } } : { status: 200, json: { status: true, author: '@nexray', result: { arti: 'x' } } });
  const r = await get('/api/primbon/tafsir-mimpi?mimpi=ular');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/alt3/primbon/tafsirmimpi');
  assert.equal(calls.at(-1).host, 'api.nexray.eu.cc');
  assert.equal(calls.at(-1).query.mimpi, 'ular');
});

it('NexRay\'s "status: false" is an error for the caller, not a result', async () => {
  reply = () => ({ status: 500, json: { status: false, author: '@nexray - ElrayyXml', error: 'Request failed with status code 500' } });
  const r = await get('/api/textpro/naruto?text=yannz');
  assert.equal(r.status, 502);
  assert.ok(!/nexray|ElrayyXml/i.test(r.text));
});
