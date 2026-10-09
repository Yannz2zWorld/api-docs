'use strict';
// Dashboard "Endpoint terakhir dibuka" (/api/me/recent-endpoints) and the New / Hot / Recommend
// labels the developer sets per endpoint in the panel (shown in the catalog as access.badge).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner, user, other, pingId;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('recent@example.test');
  other = await app.login('recent2@example.test');
  pingId = (await h.db().query("SELECT id FROM endpoints WHERE path='/api/tools/ping'")).rows[0].id;
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const patch = (cookie, body) => app.request('PATCH', `/owner/api/endpoints/${pingId}`, { cookie, headers: { origin: app.origin }, body });
const catalogPing = async () => Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat().find(e => e.cleanPath === '/api/tools/ping');

it('recent endpoints list only what this account opened, newest first', async () => {
  const empty = await app.request('GET', '/api/me/recent-endpoints', { cookie: user });
  assert.deepEqual([empty.status, empty.json.endpoints], [200, []]);
  assert.equal((await app.request('GET', '/api/me/recent-endpoints')).status, 401);

  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(user))).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(user))).status, 200);
  const r = await app.request('GET', '/api/me/recent-endpoints', { cookie: user });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.endpoints.length, 1);
  assert.deepEqual([r.json.endpoints[0].path, r.json.endpoints[0].calls, r.json.endpoints[0].minimumTier], ['/api/tools/ping', 2, 'FREE']);

  const mine = await app.request('GET', '/api/me/recent-endpoints', { cookie: other });
  assert.deepEqual(mine.json.endpoints, [], 'other accounts do not see it');
});

it('the developer sets New / Hot / Recommend or no label; the catalog and recent list carry it', async () => {
  for (const badge of ['new', 'hot', 'recommend']) {
    const r = await patch(owner, { badge });
    assert.equal(r.status, 200, r.text);
    assert.equal((await catalogPing()).access.badge, badge);
  }
  assert.equal((await app.request('GET', '/api/me/recent-endpoints', { cookie: user })).json.endpoints[0].badge, 'recommend');

  const bad = await patch(owner, { badge: 'star' });
  assert.equal(bad.status, 400);
  assert.equal((await catalogPing()).access.badge, 'recommend');

  assert.equal((await patch(owner, { badge: null })).status, 200);
  assert.equal((await catalogPing()).access.badge, null);
  assert.equal((await patch(user, { badge: 'hot' })).status, 403, 'only the developer may change it');
});

it('changing the tier in the panel blocks lower tiers right away', async () => {
  assert.equal((await patch(owner, { minimum_tier: 'SULTAN' })).status, 200);
  try {
    const r = await app.request('GET', '/api/tools/ping', app.asBrowser(user));
    assert.deepEqual([r.status, r.json.error], [403, 'TIER_RESTRICTED']);
    assert.equal((await catalogPing()).access.minimum_tier, 'SULTAN');
  } finally { await patch(owner, { minimum_tier: 'FREE' }); }
});
