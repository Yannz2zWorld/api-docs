'use strict';
// Deploy-order safety: before migration 009, sign-in, keys, the gateway, profile and the owner
// panel keep working; only the new features answer MIGRATION_REQUIRED.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  const db = h.db();
  // Undo migration 009 on this disposable schema.
  await db.query('DROP TABLE activity_log');
  await db.query('DROP TABLE chat_messages');
  await db.query('DROP TABLE key_quota_counters');
  await db.query('ALTER TABLE api_keys DROP COLUMN tier, DROP COLUMN expires_at, DROP COLUMN issued_by');
  await db.query('ALTER TABLE users DROP COLUMN display_name, DROP COLUMN last_seen_at');
  app = await h.startApp();
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('without migration 009: login, keys, gateway, pages, profile and owner panel work; new features say MIGRATION_REQUIRED', async () => {
  await app.login('pre9@example.test');
  await h.setTier('pre9@example.test', 'SULTAN');
  const cookie = await app.login('pre9@example.test');
  const owner = await app.login(h.OWNER_EMAIL);
  const made = await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: 'auto' } });
  assert.equal(made.status, 201);
  assert.equal((await app.request('GET', '/api/keys', { cookie })).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${made.json.key}` } })).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(cookie))).status, 200);
  assert.equal((await app.request('GET', '/home', { cookie })).status, 200);
  const profile = await app.request('GET', '/api/profile', { cookie });
  assert.deepEqual([profile.status, profile.json.profile.accountName], [200, 'Pre']);
  assert.equal((await app.request('POST', '/owner/keys/search', { cookie: owner, headers: { origin: app.origin }, body: {} })).status, 200);
  assert.equal((await app.request('GET', '/owner/activity', { cookie: owner })).status, 200);

  const o = (method, url, body, c = owner) => app.request(method, url, { cookie: c, headers: { origin: app.origin }, body });
  assert.equal((await o('POST', '/owner/keys', { name: 'x', tier: 'SULTAN', duration: '1d' })).json.error, 'MIGRATION_REQUIRED');
  assert.equal((await o('GET', '/api/chat', undefined, cookie)).json.error, 'MIGRATION_REQUIRED');
  assert.equal((await o('POST', '/api/chat', { body: 'hi' }, cookie)).json.error, 'MIGRATION_REQUIRED');
  assert.equal((await o('PATCH', '/api/profile', { displayName: 'Pre Nine' }, cookie)).json.error, 'MIGRATION_REQUIRED');
});
