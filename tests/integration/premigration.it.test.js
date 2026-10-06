'use strict';
// Deploy-order safety: if this code reaches production before migration 007 is applied,
// login, sessions and existing API keys must keep working (new billing/custom-key features
// may answer DATABASE_SCHEMA_OUTDATED until then).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  const db = h.db();
  // Undo migration 007 on this disposable schema.
  await db.query('DROP TABLE payment_proofs');
  await db.query('DROP TABLE api_key_failures');
  await db.query('ALTER TABLE users DROP COLUMN tier_expires_at');
  await db.query('ALTER TABLE orders DROP COLUMN duration_days');
  await db.query('ALTER TABLE api_keys DROP COLUMN custom');
  await db.query('ALTER TABLE payments DROP COLUMN owner_notified');
  app = await h.startApp();
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('without migration 007: Google login, /auth/me, keys and the gateway still work', async () => {
  await app.login('pre@example.test');
  await h.setTier('pre@example.test', 'SULTAN');
  const cookie = await app.login('pre@example.test');
  const me = await app.request('GET', '/auth/me', { cookie });
  assert.deepEqual([me.status, me.json.user.tier], [200, 'SULTAN']);
  const made = await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: 'auto' } });
  assert.equal(made.status, 201);
  assert.equal((await app.request('GET', '/api/keys', { cookie })).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${made.json.key}` } })).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { authorization: 'Bearer wrong-value-1' } })).json.error, 'INVALID_API_KEY');
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(cookie))).status, 200);
  const health = await app.request('GET', '/health/database');
  assert.equal(health.json.schema, 'migration_required');
  assert.ok(health.json.missing.includes('users.tier_expires_at'));
});
