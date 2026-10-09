'use strict';
// Failover (config/endpointGroups.js + services/failoverService.js): a group's public endpoint
// switches to a working backup by itself; a broken member is logged; the public endpoint is only
// hidden when every member is broken, and comes back once one works. Upstreams are stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const h = require('./helpers');

const realFetch = global.fetch;
let calls = [];
let reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
let tikwm = () => { throw new Error('tikwm down'); };
let app, user, owner;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (['api.theresav.eu', 'api.clutch.web.id', 'api.termai.cc'].includes(u.hostname)) {
      calls.push({ host: u.hostname, path: u.pathname, query: Object.fromEntries(u.searchParams) });
      const r = reply(u);
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  const axios = require(path.join(__dirname, '..', '..', 'node_modules', 'axios'));
  const realPost = axios.post;
  axios.post = async (url, ...rest) => (String(url).startsWith('https://www.tikwm.com/') ? tikwm() : realPost(url, ...rest));
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: 't', CLUTCH_API_KEY: 'c', TERMAI_API_KEY: 'm' });
  user = await app.login('failover@example.test');
  owner = await app.login(h.OWNER_EMAIL);
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; reply = () => ({ status: 200, json: { status: true, result: 'ok' } }); tikwm = () => { throw new Error('tikwm down'); }; require('../../services/errorLogService').resetHidden(); require('../../services/failoverService').reset(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const call = p => app.request('GET', p, app.asBrowser(user));
const inCatalog = async p => Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat().some(e => e.cleanPath === p);
const errorsFor = async p => (await app.request('GET', '/owner/api/errors', { cookie: owner })).json.errors.filter(e => e.path === p && !e.resolved_at);

it('TikTok: when the main source fails, the backup answers and the failure is logged', async () => {
  const r = await call('/api/download/tiktok?url=https://vt.tiktok.com/ZSabc/');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/download/tiktok-termai');
  assert.equal(calls[0].host, 'api.termai.cc');
  assert.equal((await errorsFor('/api/download/tiktok')).length, 1, 'the broken main source is in the Error tab');
  assert.equal(await inCatalog('/api/download/tiktok'), true);
});

it('when the first backup is out of quota too, the next one is used; the public endpoint stays', async () => {
  reply = u => (u.hostname === 'api.termai.cc' ? { status: 403, json: { status: false, message: 'Limit plan kamu habis, upgrade dulu' } } : { status: 200, json: { status: true, result: 'from aio' } });
  const r = await call('/api/download/tiktok?url=https://vt.tiktok.com/ZSabc/');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/download/aio');
  assert.equal(r.json.result, 'from aio');
  assert.equal(await inCatalog('/api/download/tiktok'), true, 'still works through a backup');
  assert.equal(await inCatalog('/api/download/tiktok-termai'), false, 'the out-of-quota one is hidden as its own endpoint');
  // Next call: the broken members are tried last, the working backup first.
  calls = [];
  const again = await call('/api/download/tiktok?url=https://vt.tiktok.com/ZSabc/');
  assert.equal(again.status, 200);
  assert.ok(!calls.some(c => c.host === 'api.termai.cc'), 'the hidden backup is not tried while another works');
});

it('a backup gets its own parameter names / fixed values (YouTube → ytmp4 at 360p)', async () => {
  reply = u => (u.hostname === 'api.clutch.web.id' ? { status: 500, json: { status: false, message: 'server error' } } : { status: 200, json: { status: true, result: 'yt' } });
  const r = await call('/api/download/youtube?url=https://youtu.be/abc');
  assert.equal(r.status, 200, r.text);
  assert.equal(r.headers['x-yannz-backup'], '/api/download/ytmp4');
  const yt = calls.find(c => c.path === '/api/download/ytmp4');
  assert.deepEqual([yt.query.url, yt.query.resolution], ['https://youtu.be/abc', '360']);
});

it("the caller's own mistake (missing url) is answered right away, no backups tried", async () => {
  const r = await call('/api/download/youtube');
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

it('when every member is out of plan the endpoint is hidden; it comes back when one works again', async () => {
  reply = () => ({ status: 403, json: { status: false, message: "You've reached your plan quota" } });
  const r = await call('/api/download/youtube?url=https://youtu.be/abc');
  assert.deepEqual([r.status, r.json.error], [503, 'ENDPOINT_UNAVAILABLE']);
  assert.ok(!/plan|quota/i.test(r.text));
  require('../../services/errorLogService').resetHidden();
  assert.equal(await inCatalog('/api/download/youtube'), false, 'hidden: no member works');
  assert.equal((await call('/api/download/youtube?url=https://youtu.be/abc')).status, 404);

  // The automatic check finds YouTube working again.
  reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
  for (let i = 0; i < 40; i++) { const c = await app.request('POST', '/api/endpoints/autocheck', { headers: { 'x-yannz-client': 'web' } }); if (!c.json.checked.length) break; }
  require('../../services/errorLogService').resetHidden();
  assert.equal(await inCatalog('/api/download/youtube'), true);
  assert.equal((await call('/api/download/youtube?url=https://youtu.be/abc')).status, 200);
});

it('the monitor shows a group as 200 while a backup works; the panel lists the backups', async () => {
  const status = require('../../services/endpointStatusService');
  await h.db().query("INSERT INTO endpoint_checks (path, status, ok, checked_at) VALUES ('/api/download/instagram', 502, false, now()), ('/api/download/kolid', 200, true, now()) ON CONFLICT (path) DO UPDATE SET status = EXCLUDED.status, ok = EXCLUDED.ok, checked_at = now()");
  status.reset();
  const ig = (await app.request('GET', '/api/endpoints/status')).json.endpoints.find(e => e.path === '/api/download/instagram');
  assert.deepEqual([ig.code, ig.source], [200, 'backup']);
  const rows = (await app.request('GET', '/owner/api/endpoints', { cookie: owner })).json.endpoints;
  assert.deepEqual(rows.find(e => e.path === '/api/download/tiktok').backups, ['/api/download/tiktok-termai', '/api/dongtube/download/tiktok', '/api/download/aio', '/api/dongtube/download/aio']);
  assert.deepEqual(rows.find(e => e.path === '/api/download/aio').backup_for.sort(), ['/api/download/instagram', '/api/download/tiktok', '/api/download/youtube']);
});
