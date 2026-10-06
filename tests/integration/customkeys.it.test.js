'use strict';
// User-chosen API key values (e.g. "Yannz2z") and invalid-key guessing protection.
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
const create = (cookie, body) => app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body });
const ping = key => app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}` } });

it('a paid user can choose the key value; it works as a Bearer key and is stored only as a hash', async () => {
  const cookie = await userWithTier('custom@example.test', 'SULTAN');
  const r = await create(cookie, { name: 'bot', custom_key: 'Yannz2z' });
  assert.equal(r.status, 201);
  assert.equal(r.json.key, 'Yannz2z');
  assert.equal(r.json.record.custom, true);
  assert.equal((await ping('Yannz2z')).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { 'x-api-key': 'Yannz2z' } })).status, 200);
  assert.equal((await ping('yannz2z')).status, 401, 'values are case-sensitive');

  const list = (await app.request('GET', '/api/keys', { cookie })).json.keys;
  assert.deepEqual([list[0].key_prefix, list[0].custom], ['Yan', true]);
  const dump = JSON.stringify((await h.db().query('SELECT * FROM api_keys')).rows);
  assert.ok(!dump.includes('Yannz2z'), 'plaintext value is not stored');
});

it('custom values are unique across all users, even after the original is revoked', async () => {
  const a = await userWithTier('uniq-a@example.test', 'SEPUH');
  const b = await userWithTier('uniq-b@example.test', 'SEPUH');
  assert.equal((await create(a, { custom_key: 'shared-value-1' })).status, 201);
  const taken = await create(b, { custom_key: 'shared-value-1' });
  assert.deepEqual([taken.status, taken.json.error], [409, 'CUSTOM_KEY_TAKEN']);
  const id = (await app.request('GET', '/api/keys', { cookie: a })).json.keys[0].id;
  await app.request('POST', `/api/keys/${id}/revoke`, { cookie: a, headers: { origin: app.origin } });
  assert.equal((await create(b, { custom_key: 'shared-value-1' })).json.error, 'CUSTOM_KEY_TAKEN');
  assert.equal((await ping('shared-value-1')).json.error, 'API_KEY_REVOKED');
  // Concurrent claims of one value: exactly one wins.
  const c = await userWithTier('uniq-c@example.test', 'DEWA');
  const results = await Promise.all([create(b, { custom_key: 'race-value-9' }), create(c, { custom_key: 'race-value-9' })]);
  assert.deepEqual(results.map(r => r.status).sort(), [201, 409]);
});

it('invalid custom values are rejected; FREE users still cannot create keys; the tier cap applies', async () => {
  const cookie = await userWithTier('rules@example.test', 'SULTAN');
  for (const value of ['abc12', 'has space', 'semi;colon', 'x'.repeat(65), 'yannz_live_mine', 'Ünïcode1']) {
    const r = await create(cookie, { custom_key: value });
    assert.deepEqual([r.status, r.json.error], [400, 'INVALID_CUSTOM_KEY'], value);
  }
  assert.equal((await create(cookie, { custom_key: 'rules-one' })).status, 201);
  assert.equal((await create(cookie, { custom_key: 'rules-two' })).status, 201);
  assert.equal((await create(cookie, { custom_key: 'rules-three' })).json.error, 'KEY_LIMIT');
  const free = await userWithTier('rules-free@example.test');
  assert.equal((await create(free, { custom_key: 'free-wants-one' })).json.error, 'KEYS_NOT_INCLUDED');
});

it('an expired paid tier falls back to FREE limits for keys and sessions', async () => {
  const cookie = await userWithTier('expired@example.test', 'SULTAN');
  assert.equal((await create(cookie, { custom_key: 'expired-key' })).status, 201);
  await h.db().query("UPDATE users SET tier_expires_at=now()-interval '1 minute' WHERE email='expired@example.test'");
  const me = await app.request('GET', '/auth/me', { cookie });
  assert.equal(me.json.user.tier, 'FREE');
  const r = await ping('expired-key');
  assert.equal(r.status, 200, 'key still authenticates');
  assert.equal(r.headers['x-ratelimit-limit'], '100', 'but with FREE quota');
});

it('too many invalid keys from one IP block key authentication for the window (checked last: shares the IP)', async () => {
  const cookie = await userWithTier('throttle@example.test', 'SULTAN');
  assert.equal((await create(cookie, { custom_key: 'throttle-ok' })).status, 201);
  await h.db().query('DELETE FROM api_key_failures'); // earlier tests in this file sent invalid keys too
  let last;
  for (let i = 0; i < 30; i++) last = await ping(`guess-${i}-value`);
  assert.equal(last.json.error, 'INVALID_API_KEY');
  const blocked = await ping('another-guess');
  assert.deepEqual([blocked.status, blocked.json.error], [429, 'TOO_MANY_INVALID_KEYS']);
  assert.equal((await ping('throttle-ok')).json.error, 'TOO_MANY_INVALID_KEYS', 'a correct guess no longer helps');
  const session = await app.request('GET', '/api/tools/ping', app.asBrowser(cookie));
  assert.equal(session.status, 200, 'logged-in sandbox use is unaffected');
});
