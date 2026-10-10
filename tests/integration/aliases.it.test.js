'use strict';
// Developer panel → Endpoints → "Tampilkan" / "Sembunyikan" (services/endpointAliasService.js): a
// backup-only endpoint listed as the next version of the endpoint it backs up, and hidden again.
// Upstreams are stubbed: nothing leaves the machine.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let calls = [];
let app, owner, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.botcahx.eu.org') {
      calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams) });
      return new Response(JSON.stringify({ status: true, creator: 'BOTCAHX', result: [{ berita: 'x' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ BOTCAHX_API_KEY: 'bkey' });
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('aliases@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (url, cookie = owner) => app.request('POST', url, { cookie, headers: { origin: app.origin }, body: {} });
const rows = async () => (await app.request('GET', '/owner/api/endpoints', { cookie: owner })).json.endpoints;
const listed = async () => Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat();
const BACKUP = '/api/alt2/news/cnn';   // BOTCAHX copy of CNN news; /api/news/cnn-v2 (NexRay) already exists

it('a backup row offers "Tampilkan"; showing it lists it as the next free version, named after the endpoint it backs up', async () => {
  const backup = (await rows()).find(r => r.path === BACKUP);
  assert.equal(backup.can_show, true);
  assert.equal(backup.alias_of, null);
  assert.ok(!(await listed()).some(e => e.cleanPath.startsWith('/api/alt2/')), 'hidden while it is a backup only');

  const r = await post(`/owner/api/endpoints/${backup.id}/show`);
  assert.equal(r.status, 200, r.text);
  assert.deepEqual(r.json.endpoint, { path: '/api/news/cnn-v3', name: 'CNN Indonesia V3' }, 'v2 is taken, so v3; no "(cadangan)" in the name');

  const item = (await app.request('GET', '/api/endpoints')).json.endpoints.News.find(e => e.cleanPath === '/api/news/cnn-v3');
  assert.ok(item, 'listed in the same category as CNN news');
  assert.equal(item.name, 'CNN Indonesia V3');

  calls = [];
  const call = await app.request('GET', '/api/news/cnn-v3', app.asBrowser(user));
  assert.equal(call.status, 200, call.text);
  assert.equal(calls[0].path, '/api/news/cnn', 'runs the backup\'s code');
  assert.ok(!/BOTCAHX|botcahx/.test(call.text));

  const after = await rows();
  assert.ok(!after.some(x => x.path === BACKUP), 'the backup row is replaced by its version');
  const version = after.find(x => x.path === '/api/news/cnn-v3');
  assert.equal(version.name, 'CNN Indonesia V3');
  assert.equal(version.alias_of, BACKUP);
  assert.equal(version.handler_loaded, true);
  const status = (await app.request('GET', '/api/endpoints/status')).json.endpoints.map(e => e.path);
  assert.ok(status.includes('/api/news/cnn-v3'), 'in the endpoint monitor too');
});

it('"Sembunyikan" takes it off the list (a backup only again); showing it again gives the same version', async () => {
  const version = (await rows()).find(x => x.path === '/api/news/cnn-v3');
  const r = await post(`/owner/api/endpoints/${version.id}/hide`);
  assert.equal(r.status, 200, r.text);
  assert.ok(!(await listed()).some(e => e.cleanPath === '/api/news/cnn-v3'));
  assert.equal((await app.request('GET', '/api/news/cnn-v3', app.asBrowser(user))).status, 404);
  const back = (await rows()).find(x => x.path === BACKUP);
  assert.equal(back.can_show, true, 'the backup row is back with its button');
  assert.ok(!(await rows()).some(x => x.path === '/api/news/cnn-v3'));

  const again = await post(`/owner/api/endpoints/${back.id}/show`);
  assert.equal(again.json.endpoint.path, '/api/news/cnn-v3');
  assert.equal((await app.request('GET', '/api/news/cnn-v3', app.asBrowser(user))).status, 200);
});

it('only backups can be shown, only versions hidden, only by the developer', async () => {
  const main = (await rows()).find(x => x.path === '/api/news/cnn');
  assert.equal(main.can_show, false);
  assert.equal((await post(`/owner/api/endpoints/${main.id}/show`)).status, 409);
  assert.equal((await post(`/owner/api/endpoints/${main.id}/hide`)).status, 409);
  assert.equal((await post(`/owner/api/endpoints/${main.id}/show`, user)).status, 403);
});
