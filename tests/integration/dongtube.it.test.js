'use strict';
// Dongtube endpoints (plugin/dongtube.js + lib/apiproxy.js). Upstreams are stubbed: nothing leaves
// the machine. Checks the catalog, public endpoints that work without the key, Dongtube's own
// branding being dropped, fixed parameters, and the failover onto Dongtube backups.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let calls = [];
let reply = () => ({ status: 200, json: { author: 'Dongtube API', channel: 'https://whatsapp.com/channel/x', status: true, data: { ok: 1 } } });
let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (['api.dongtube.id', 'api.clutch.web.id'].includes(u.hostname)) {
      calls.push({ host: u.hostname, path: u.pathname, query: Object.fromEntries(u.searchParams) });
      const r = reply(u);
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ CLUTCH_API_KEY: 'ckey' });
  delete process.env.DONGTUBE_API_KEY;
  user = await app.login('dongtube@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => {
  calls = [];
  reply = () => ({ status: 200, json: { author: 'Dongtube API', channel: 'https://whatsapp.com/channel/x', status: true, data: { ok: 1 } } });
  delete process.env.DONGTUBE_API_KEY;
  require('../../services/errorLogService').resetHidden();
  require('../../services/failoverService').reset();
});
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = p => app.request('GET', p, app.asBrowser(user));
const catalog = async () => (await app.request('GET', '/api/endpoints')).json.endpoints;

it('catalog lists the new Dongtube endpoints; the backup-only ones stay out of it', async () => {
  const cat = await catalog();
  assert.ok(cat.News.some(e => e.cleanPath === '/api/news/cnn'));
  assert.ok(cat.Games.some(e => e.cleanPath === '/api/games/tebakkata'));
  assert.ok(cat.Tools.some(e => e.cleanPath === '/api/tools/text2qr'));
  const all = Object.values(cat).flat().map(e => e.cleanPath);
  assert.ok(!all.some(p => p.startsWith('/api/alt/')), 'backups are not listed on their own');
  for (const left of ['/api/tools/vccgen', '/api/canvas/fake-dana', '/api/get/pp-wa', '/api/tools/nik-parser']) assert.ok(!all.includes(left), left);
});

it('a public Dongtube endpoint works without DONGTUBE_API_KEY, and their branding is dropped', async () => {
  const r = await get('/api/tools/text2base64?text=halo');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].host, 'api.dongtube.id');
  assert.equal(calls[0].path, '/tools/text2base64');
  assert.equal(calls[0].query.text, 'halo');
  assert.equal(calls[0].query.apikey, undefined, 'no key sent while none is set');
  assert.deepEqual(r.json.data, { ok: 1 });
  assert.equal(r.json.channel, undefined);
  assert.notEqual(r.json.author, 'Dongtube API');
});

it('with the key set it is sent as ?apikey=, never shown in the answer', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  const r = await get('/api/search/cookpad?q=ayam');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].query.apikey, 'dkey');
  assert.ok(!r.text.includes('dkey'));
});

it('an endpoint that needs the key does not call Dongtube while the key is missing', async () => {
  const r = await get('/api/search/cookpad?q=ayam');
  assert.notEqual(r.status, 200);
  assert.equal(calls.length, 0);
});

it('fixed parameters: Pixiv always asks for safe content, whatever the caller sends', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  const r = await get('/api/search/pixiv?q=landscape&mode=r18');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].query.mode, 'safe');
});

it('Dongtube variants back each other up: KBBI switches to the second one with its own parameter name', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  reply = u => (u.pathname === '/search/kbbi' ? { status: 500, json: { status: false, error: 'down' } } : { status: 200, json: { status: true, result: 'arti' } });
  const r = await get('/api/search/kbbi?q=makan');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/alt/tools/kbbi');
  assert.deepEqual(calls.map(c => c.path), ['/search/kbbi', '/tools/kbbi']);
  assert.equal(calls[1].query.word, 'makan');
});

it('an existing endpoint falls back to Dongtube: GitHub stalk (clutch) -> Dongtube with user=', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  reply = u => (u.hostname === 'api.clutch.web.id' ? { status: 502, json: { status: false, message: 'server error' } } : { status: 200, json: { status: true, result: { login: 'torvalds' } } });
  const r = await get('/api/stalk/github?username=torvalds');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/alt/stalk/github');
  assert.equal(calls[1].host, 'api.dongtube.id');
  assert.equal(calls[1].query.user, 'torvalds');
});

it('without the Dongtube key its backups are skipped instead of tried', async () => {
  reply = u => (u.hostname === 'api.clutch.web.id' ? { status: 502, json: { status: false, message: 'server error' } } : { status: 200, json: { status: true } });
  const r = await get('/api/stalk/github?username=torvalds');
  assert.equal(r.status >= 500, true);
  assert.ok(calls.every(c => c.host === 'api.clutch.web.id'));
});

it('automatic checks use at most half of Dongtube\'s 60/minute; a 429 from Dongtube is "check later", not broken', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  const ap = require('../../lib/apiproxy');
  ap._resetLimits();
  const entry = ap.registry().find(e => e.path === '/api/news/cnn');
  for (let i = 0; i < 30; i++) assert.equal((await ap.probe(entry)).result, 'ok');
  calls = [];
  assert.deepEqual(await ap.probe(entry), { result: 'deferred' }, 'the other half is left for real callers');
  assert.equal(calls.length, 0);
  // Real calls are never held back by it.
  assert.equal((await get('/api/news/cnn')).status, 200);
  ap._resetLimits();
  reply = () => ({ status: 429, json: { status: false, error: 'Terlalu banyak permintaan (rate limit: 60 req/menit).' } });
  assert.deepEqual(await ap.probe(entry), { result: 'deferred' });
  ap._resetLimits();
});

it('an endpoint whose automatic check fails twice in a row is hidden, and comes back when it passes', async () => {
  process.env.DONGTUBE_API_KEY = 'dkey';
  require('../../lib/apiproxy')._resetLimits();
  const P = '/api/canvas/ttqc';
  const owner = await app.login(h.OWNER_EMAIL);
  const check = async () => {
    // Only this endpoint is due.
    await h.db().query('INSERT INTO endpoint_checks (path) SELECT path FROM endpoints ON CONFLICT (path) DO NOTHING');
    await h.db().query("UPDATE endpoint_checks SET checked_at = now(), claimed_at = NULL WHERE path <> $1", [P]);
    await h.db().query("UPDATE endpoint_checks SET checked_at = now() - interval '7 hours', claimed_at = NULL WHERE path = $1", [P]);
    const r = await app.request('POST', '/api/endpoints/autocheck', { headers: { 'x-yannz-client': 'web' } });
    assert.ok(r.json.checked.some(x => x.path === P), JSON.stringify(r.json));
    require('../../services/errorLogService').resetHidden();
  };
  const inCatalog = async () => Object.values(await catalog()).flat().some(e => e.cleanPath === P);
  await h.db().query('INSERT INTO endpoint_checks (path, ok, status, checked_at) VALUES ($1, true, 200, now()) ON CONFLICT (path) DO UPDATE SET ok = true, status = 200', [P]);   // it worked last time
  reply = u => (u.pathname === '/canvas/ttqc' ? { status: 200, json: { status: false, error: 'Request failed with status code 404' } } : { status: 200, json: { status: true } });
  await check();
  assert.equal(await inCatalog(), true, 'one failed check: still listed');
  await check();
  assert.equal(await inCatalog(), false, 'failed twice: hidden');
  const errs = (await app.request('GET', '/owner/api/errors', { cookie: owner })).json.errors.filter(e => e.path === P && !e.resolved_at);
  assert.ok(errs.some(e => e.hidden), 'the Error tab says why');
  reply = () => ({ status: 200, json: { status: true, data: 'png' } });
  await check();
  assert.equal(await inCatalog(), true, 'works again: back by itself');
});

it('parameters with fixed choices reach API Docs as a menu (options), with their default', async () => {
  const all = Object.values(await catalog()).flat();
  const p = (path, name) => all.find(e => e.cleanPath === path)?.params.find(x => x.name === name);
  assert.deepEqual(p('/api/download/ytmp4', 'resolution').options, ['360', '480', '720', '1080', '1440', '2160']);
  assert.equal(p('/api/download/ytmp4', 'resolution').default, '720');
  assert.deepEqual(p('/api/download/youtube', 'quality').options, ['144p', '240p', '360p', '480p', '720p', '1080p']);
  assert.deepEqual(p('/api/download/bilibili', 'quality').options, ['360P', '480P', '720P']);
  assert.equal(p('/api/download/bilibili', 'url').options, undefined, 'free text stays a text box');
  const page = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'views', 'api.html'), 'utf8');
  assert.match(page, /function paramSelect\(p\)/);
});
