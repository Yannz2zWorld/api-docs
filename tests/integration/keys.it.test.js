'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

async function userWithTier(email, tier) {
  await app.login(email);
  if (tier) await h.setTier(email, tier);
  return app.login(email);
}
const create = (cookie, name = 'k', extraHeaders = {}) => app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin, ...extraHeaders }, body: { name } });
const ping = key => app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}` } });

it('FREE users cannot create custom keys', async () => {
  const cookie = await userWithTier('kfree@example.test');
  const r = await create(cookie);
  assert.deepEqual([r.status, r.json.error], [403, 'KEYS_NOT_INCLUDED']);
});

it('SULTAN can create exactly 2 keys; plaintext is shown once and never stored', async () => {
  const cookie = await userWithTier('ksultan@example.test', 'SULTAN');
  const a = await create(cookie, 'first');
  const b = await create(cookie, 'second');
  assert.deepEqual([a.status, b.status], [201, 201]);
  assert.match(a.json.key, /^yannz_live_/);
  const third = await create(cookie, 'third');
  assert.deepEqual([third.status, third.json.error], [403, 'KEY_LIMIT']);

  const list = await app.request('GET', '/api/keys', { cookie });
  assert.equal(list.json.limit, 2);
  assert.equal(list.json.keys.length, 2);
  assert.ok(!JSON.stringify(list.json).includes(a.json.key), 'list never returns plaintext');
  assert.ok(!('key_hash' in list.json.keys[0]));
  const stored = await h.db().query("SELECT key_hash FROM api_keys WHERE key_hash=$1 OR key_hash=$2", [a.json.key, b.json.key]);
  assert.equal(stored.rowCount, 0, 'plaintext is not in the database');
});

it('concurrent creation cannot exceed the tier cap (SEPUH = 3)', async () => {
  const cookie = await userWithTier('krace@example.test', 'SEPUH');
  const results = await Promise.all(Array.from({ length: 12 }, (_, i) => create(cookie, 'race' + i)));
  assert.equal(results.filter(r => r.status === 201).length, 3);
  assert.ok(results.filter(r => r.status !== 201).every(r => r.json.error === 'KEY_LIMIT'));
  const u = await h.userByEmail('krace@example.test');
  const n = (await h.db().query("SELECT count(*)::int n FROM api_keys WHERE user_id=$1 AND status='active'", [u.id])).rows[0].n;
  assert.equal(n, 3);
});

it('DEWA and OWNER have unlimited keys', async () => {
  const dewa = await userWithTier('kdewa@example.test', 'DEWA');
  const owner = await userWithTier(h.OWNER_EMAIL);
  for (let i = 0; i < 5; i++) {
    assert.equal((await create(dewa, 'd' + i)).status, 201);
    assert.equal((await create(owner, 'o' + i)).status, 201);
  }
  assert.equal((await app.request('GET', '/api/keys', { cookie: dewa })).json.limit, null);
});

it('keys authenticate via Bearer and x-api-key; invalid keys are rejected', async () => {
  const cookie = await userWithTier('kauth@example.test', 'SULTAN');
  const { key } = (await create(cookie)).json;
  const bearer = await ping(key);
  assert.equal(bearer.status, 200);
  assert.deepEqual([bearer.json.result.tier, bearer.json.result.auth], ['SULTAN', 'api_key']);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { 'x-api-key': key } })).status, 200);
  const bad = await ping('yannz_live_not-a-real-key');
  assert.deepEqual([bad.status, bad.json.error], [401, 'INVALID_API_KEY']);
});

it('revoked keys fail immediately and free a slot', async () => {
  const cookie = await userWithTier('krevoke@example.test', 'SULTAN');
  const one = (await create(cookie, 'one')).json;
  await create(cookie, 'two');
  const r = await app.request('POST', `/api/keys/${one.record.id}/revoke`, { cookie, headers: { origin: app.origin } });
  assert.equal(r.status, 200);
  const after = await ping(one.key);
  assert.deepEqual([after.status, after.json.error], [401, 'API_KEY_REVOKED']);
  assert.equal((await create(cookie, 'three')).status, 201, 'revoking frees a slot');
  const again = await app.request('DELETE', `/api/keys/${one.record.id}`, { cookie, headers: { origin: app.origin } });
  assert.deepEqual([again.status, again.json.error], [404, 'KEY_NOT_FOUND']);
});

it("users cannot see or revoke another user's key (no IDOR)", async () => {
  const alice = await userWithTier('kalice@example.test', 'SULTAN');
  const bob = await userWithTier('kbob@example.test', 'SULTAN');
  const aliceKey = (await create(alice, 'alice')).json;
  const list = await app.request('GET', '/api/keys', { cookie: bob });
  assert.ok(!list.json.keys.some(k => k.id === aliceKey.record.id));
  const r = await app.request('POST', `/api/keys/${aliceKey.record.id}/revoke`, { cookie: bob, headers: { origin: app.origin } });
  assert.equal(r.status, 404);
  assert.equal((await ping(aliceKey.key)).status, 200, 'still active');
  assert.equal((await app.request('POST', '/api/keys/not-a-uuid/revoke', { cookie: bob, headers: { origin: app.origin } })).status, 404);
});

it('an Idempotency-Key replay does not mint a second secret', async () => {
  const cookie = await userWithTier('kidem@example.test', 'DEWA');
  const first = await create(cookie, 'idem', { 'idempotency-key': 'same-request' });
  const replay = await create(cookie, 'idem', { 'idempotency-key': 'same-request' });
  assert.equal(first.status, 201);
  assert.deepEqual([replay.status, replay.json.error], [409, 'IDEMPOTENCY_REPLAY']);
});

it("a banned user's keys stop working", async () => {
  const cookie = await userWithTier('kban@example.test', 'SULTAN');
  const { key } = (await create(cookie)).json;
  await h.db().query("UPDATE users SET status='banned' WHERE email='kban@example.test'");
  const r = await ping(key);
  assert.deepEqual([r.status, r.json.error], [403, 'ACCOUNT_RESTRICTED']);
});
