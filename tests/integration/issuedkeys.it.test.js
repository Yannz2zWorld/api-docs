'use strict';
// Owner-issued API keys: own tier (access + per-key daily quota), lifetime, renew, assignee.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner, free;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  free = await app.login('ikfree@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
const ping = key => app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}` } });
const pingTier = tier => h.db().query("UPDATE endpoints SET minimum_tier=$1 WHERE path='/api/tools/ping'", [tier]);
const keyRow = id => h.db().query('SELECT * FROM api_keys WHERE id=$1', [id]).then(r => r.rows[0]);

it('owner issues a key to a user by email with its own tier and lifetime; the account tier does not matter', async () => {
  const r = await o('POST', '/owner/keys', { name: 'Sultan 1 hari', tier: 'SULTAN', duration: '1d', assignee: 'IKFREE@example.test' });
  assert.equal(r.status, 201, JSON.stringify(r.json));
  assert.equal(r.json.record.user_email, 'ikfree@example.test');
  assert.equal(r.json.record.tier, 'SULTAN');
  const hours = (Date.parse(r.json.record.expires_at) - Date.now()) / 36e5;
  assert.ok(hours > 23.9 && hours <= 24.01, String(hours));

  await pingTier('SULTAN');
  const ok = await ping(r.json.key);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.result.tier, 'SULTAN', 'the key acts with its own tier although the account is FREE');
  assert.equal(ok.json.result.quota.limit, 1000);
  await pingTier('SEPUH');
  const denied = await ping(r.json.key);
  assert.deepEqual([denied.status, denied.json.error, denied.json.currentTier], [403, 'TIER_RESTRICTED', 'SULTAN']);
  await pingTier('FREE');
});

it('a lower-tier key limits even the owner\'s own account', async () => {
  const r = await o('POST', '/owner/keys', { name: 'owner free', tier: 'FREE', duration: '12h' });
  assert.equal(r.status, 201);
  assert.equal(r.json.record.user_email.toLowerCase(), h.OWNER_EMAIL.toLowerCase());
  await pingTier('SULTAN');
  assert.equal((await ping(r.json.key)).json.error, 'TIER_RESTRICTED');
  await pingTier('FREE');
  assert.equal((await ping(r.json.key)).json.result.tier, 'FREE');
});

it('issued keys have their own daily quota, separate from the account', async () => {
  const r = await o('POST', '/owner/keys', { name: 'quota', tier: 'FREE', duration: '7d', assignee: 'ikfree@example.test' });
  await h.db().query("INSERT INTO key_quota_counters(api_key_id,usage_date,request_count) VALUES($1,(now() AT TIME ZONE 'UTC')::date,100)", [r.json.record.id]);
  const over = await ping(r.json.key);
  assert.deepEqual([over.status, over.json.error], [429, 'QUOTA_EXCEEDED']);
  const user = await h.userByEmail('ikfree@example.test');
  assert.equal(await h.usedToday(user.id), 0, 'the account counter is untouched');
});

it('expired keys are refused; renew extends from now, from the old expiry, or makes it permanent', async () => {
  const r = await o('POST', '/owner/keys', { name: 'renew me', tier: 'DEWA', duration: 'custom', days: 3, assignee: 'ikfree@example.test' });
  const id = r.json.record.id;
  await h.db().query("UPDATE api_keys SET expires_at=now()-interval '1 minute' WHERE id=$1", [id]);
  const expired = await ping(r.json.key);
  assert.deepEqual([expired.status, expired.json.error], [401, 'API_KEY_EXPIRED']);

  assert.equal((await o('PATCH', `/owner/keys/${id}`, { extend: '1d' })).status, 200);
  let k = await keyRow(id);
  let hours = (k.expires_at - Date.now()) / 36e5;
  assert.ok(hours > 23.9 && hours <= 24.01, 'expired key: extended from now');
  assert.equal((await ping(r.json.key)).status, 200);

  await o('PATCH', `/owner/keys/${id}`, { extend: '30d' });
  k = await keyRow(id);
  hours = (k.expires_at - Date.now()) / 36e5;
  assert.ok(hours > 743.9 && hours <= 744.01, 'active key: extended from its expiry (1d + 30d)');

  await o('PATCH', `/owner/keys/${id}`, { tier: 'SEPUH' });
  assert.equal((await keyRow(id)).tier, 'SEPUH');
  await o('PATCH', `/owner/keys/${id}`, { extend: 'permanent' });
  assert.equal((await keyRow(id)).expires_at, null);

  const found = await o('POST', '/owner/keys/search', { q: r.json.key });
  assert.equal(found.json.keys[0].tier, 'SEPUH');
  assert.equal(found.json.keys[0].issued, true);
});

it('validation: tier, duration (max 1000 days), unknown assignee, custom value; renew of a revoked key', async () => {
  for (const [body, error] of [
    [{ tier: 'OWNER', duration: '1d' }, 'INVALID_TIER'],
    [{ tier: 'SULTAN', duration: 'custom', days: 1001 }, 'INVALID_DURATION'],
    [{ tier: 'SULTAN', duration: '2d' }, 'INVALID_DURATION'],
    [{ tier: 'SULTAN', duration: '1d', assignee: 'nobody@example.test' }, 'USER_NOT_FOUND'],
    [{ tier: 'SULTAN', duration: '1d', custom_key: 'yannz_live_x1234' }, 'INVALID_CUSTOM_KEY']
  ]) assert.equal((await o('POST', '/owner/keys', { name: 'x', ...body })).json.error, error, JSON.stringify(body));
  const custom = await o('POST', '/owner/keys', { name: 'c', tier: 'SULTAN', duration: '1d', custom_key: 'OwnerGift2026' });
  assert.equal(custom.status, 201);
  assert.equal((await ping('OwnerGift2026')).status, 200);
  assert.equal((await o('POST', '/owner/keys', { name: 'c2', tier: 'SULTAN', duration: '1d', custom_key: 'OwnerGift2026' })).json.error, 'CUSTOM_KEY_TAKEN');
  await o('POST', `/owner/keys/${custom.json.record.id}/revoke`);
  assert.equal((await o('PATCH', `/owner/keys/${custom.json.record.id}`, { extend: '1d' })).json.error, 'KEY_NOT_FOUND');
});

it('only the owner can issue or renew keys', async () => {
  const r = await app.request('POST', '/owner/keys', { cookie: free, headers: { origin: app.origin }, body: { name: 'x', tier: 'DEWA', duration: '30d' } });
  assert.equal(r.json.error, 'OWNER_REQUIRED');
});
