'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
let owner;
const users = {};
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  for (const tier of ['FREE', 'SULTAN', 'DEWA']) {
    const email = `e${tier.toLowerCase()}@example.test`;
    await app.login(email);
    if (tier !== 'FREE') await h.setTier(email, tier);
    users[tier] = { cookie: await app.login(email), id: (await h.userByEmail(email)).id };
  }
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const ping = cookie => app.request('GET', '/api/tools/ping', app.asBrowser(cookie));
const setPing = fields => h.db().query(
  'UPDATE endpoints SET minimum_tier=COALESCE($1,minimum_tier),locked=COALESCE($2,locked),status=COALESCE($3,status) WHERE path=$4',
  [fields.minimum_tier ?? null, fields.locked ?? null, fields.status ?? null, '/api/tools/ping']
);
const resetPing = () => setPing({ minimum_tier: 'FREE', locked: false, status: 'active' });

it('plugin endpoints are registered as FREE/active and listed in the public catalog with access metadata', async () => {
  const cat = await app.request('GET', '/api/endpoints');
  const all = Object.values(cat.json.endpoints).flat();
  const p = all.find(e => e.cleanPath === '/api/tools/ping');
  assert.deepEqual([p.access.minimum_tier, p.access.locked, p.access.status], ['FREE', false, 'active']);
  assert.equal((await ping(users.FREE.cookie)).status, 200);
});

it('tier-restricted endpoints return TIER_RESTRICTED without running or charging', async () => {
  await setPing({ minimum_tier: 'SULTAN' });
  try {
    const before = await h.usedToday(users.FREE.id);
    const r = await ping(users.FREE.cookie);
    assert.deepEqual([r.status, r.json.error, r.json.requiredTier], [403, 'TIER_RESTRICTED', 'SULTAN']);
    assert.equal(await h.usedToday(users.FREE.id), before);
    assert.equal((await ping(users.SULTAN.cookie)).status, 200);
    assert.equal((await ping(users.DEWA.cookie)).status, 200);
  } finally { await resetPing(); }
});

it('locked endpoints never execute for non-owners; OWNER may still call them', async () => {
  await setPing({ locked: true });
  try {
    for (const tier of ['FREE', 'DEWA']) {
      const before = await h.usedToday(users[tier].id);
      const r = await ping(users[tier].cookie);
      assert.deepEqual([r.status, r.json.error], [403, 'ENDPOINT_LOCKED']);
      assert.equal(r.json.result, undefined, 'handler did not run');
      assert.equal(await h.usedToday(users[tier].id), before);
    }
    assert.equal((await ping(owner)).status, 200);
  } finally { await resetPing(); }
});

it('owner-only endpoints (minimum_tier OWNER) reject every other tier', async () => {
  await setPing({ minimum_tier: 'OWNER' });
  try {
    assert.equal((await ping(users.DEWA.cookie)).json.error, 'TIER_RESTRICTED');
    assert.equal((await ping(owner)).status, 200);
  } finally { await resetPing(); }
});

it('disabled endpoints are unavailable to everyone, including OWNER', async () => {
  await setPing({ status: 'disabled' });
  try {
    for (const cookie of [users.FREE.cookie, owner]) {
      const r = await ping(cookie);
      assert.deepEqual([r.status, r.json.error], [404, 'ENDPOINT_UNAVAILABLE']);
    }
  } finally { await resetPing(); }
});

it('maintenance mode blocks users but not OWNER', async () => {
  const set = enabled => app.request('PATCH', '/owner/server', { cookie: owner, headers: { origin: app.origin }, body: { maintenance_enabled: enabled, maintenance_message: 'Sedang maintenance' } });
  assert.equal((await set(true)).status, 200);
  try {
    const r = await ping(users.SULTAN.cookie);
    assert.deepEqual([r.status, r.json.error, r.json.message], [503, 'MAINTENANCE', 'Sedang maintenance']);
    assert.equal((await ping(owner)).status, 200);
  } finally { await set(false); }
});

it('session access requires the site header; cross-site navigation cannot spend quota', async () => {
  const before = await h.usedToday(users.FREE.id);
  const noHeader = await app.request('GET', '/api/tools/ping', { cookie: users.FREE.cookie });
  const crossSite = await app.request('GET', '/api/tools/ping', app.asBrowser(users.FREE.cookie, { 'sec-fetch-site': 'cross-site' }));
  assert.deepEqual([noHeader.status, noHeader.json.error], [403, 'CSRF_BLOCKED']);
  assert.deepEqual([crossSite.status, crossSite.json.error], [403, 'CSRF_BLOCKED']);
  assert.equal(await h.usedToday(users.FREE.id), before);
  const r = await ping(users.FREE.cookie);
  assert.deepEqual([r.status, r.json.result.auth], [200, 'session']);
});

it('owner endpoint registry: metadata is separate from executable handlers', async () => {
  const list = await app.request('GET', '/owner/api/endpoints', { cookie: owner });
  assert.equal(list.json.endpoints.find(e => e.path === '/api/tools/ping').handler_loaded, true);

  const created = await app.request('POST', '/owner/api/endpoints', { cookie: owner, headers: { origin: app.origin }, body: { name: 'Future API', path: '/api/future/thing', minimum_tier: 'SEPUH' } });
  assert.equal(created.status, 201);
  assert.equal(created.json.endpoint.handler_loaded, false);
  assert.match(created.json.warning, /plugin/);
  assert.equal((await app.request('GET', '/api/future/thing', app.asBrowser(owner))).status, 404, 'metadata alone never executes anything');

  const dup = await app.request('POST', '/owner/api/endpoints', { cookie: owner, headers: { origin: app.origin }, body: { name: 'Dup', path: '/api/future/thing' } });
  assert.deepEqual([dup.status, dup.json.error], [409, 'ENDPOINT_EXISTS']);
  const bad = await app.request('POST', '/owner/api/endpoints', { cookie: owner, headers: { origin: app.origin }, body: { name: 'x', path: '../../etc' } });
  assert.equal(bad.status, 400);

  const pingRow = list.json.endpoints.find(e => e.path === '/api/tools/ping');
  delete process.env.GITHUB_TOKEN;   // never reach GitHub from the tests
  const del = await app.request('DELETE', `/owner/api/endpoints/${pingRow.id}`, { cookie: owner, headers: { origin: app.origin } });
  assert.deepEqual([del.status, del.json.error], [503, 'GITHUB_NOT_CONFIGURED'], 'its own code file: deleted on GitHub, which needs the token');
  const shared = list.json.endpoints.find(e => e.handler_loaded && e.file_endpoints > 1);
  const delShared = await app.request('DELETE', `/owner/api/endpoints/${shared.id}`, { cookie: owner, headers: { origin: app.origin } });
  assert.deepEqual([delShared.status, delShared.json.error], [409, 'MULTI_ENDPOINT_FILE'], 'a file serving many endpoints is never deleted from here');
  assert.equal((await app.request('DELETE', `/owner/api/endpoints/${created.json.endpoint.id}`, { cookie: owner, headers: { origin: app.origin } })).status, 200);

  const badPatch = await app.request('PATCH', `/owner/api/endpoints/${pingRow.id}`, { cookie: owner, headers: { origin: app.origin }, body: { locked: 'yes' } });
  assert.equal(badPatch.status, 400);
  const lock = await app.request('POST', `/owner/api/endpoints/${pingRow.id}/lock`, { cookie: owner, headers: { origin: app.origin } });
  assert.equal(lock.json.endpoint.locked, true);
  assert.equal((await ping(users.FREE.cookie)).json.error, 'ENDPOINT_LOCKED');
  await app.request('POST', `/owner/api/endpoints/${pingRow.id}/unlock`, { cookie: owner, headers: { origin: app.origin } });
  assert.equal((await ping(users.FREE.cookie)).status, 200);
});

it('normal users cannot change endpoint access', async () => {
  const list = await app.request('GET', '/owner/api/endpoints', { cookie: owner });
  const id = list.json.endpoints[0].id;
  const r = await app.request('POST', `/owner/api/endpoints/${id}/lock`, { cookie: users.DEWA.cookie, headers: { origin: app.origin } });
  assert.deepEqual([r.status, r.json.error], [403, 'OWNER_REQUIRED']);
});
