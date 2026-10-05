'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
let owner;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const send = (method, url, body) => app.request(method, url, { cookie: owner, body, headers: { origin: app.origin } });

it('user list supports search and tier/status filters', async () => {
  await app.login('olist-a@example.test');
  await app.login('olist-b@example.test');
  await h.setTier('olist-b@example.test', 'SEPUH');
  const all = await send('GET', '/owner/users?q=olist');
  assert.equal(all.json.users.length, 2);
  const sepuh = await send('GET', '/owner/users?q=olist&tier=SEPUH');
  assert.deepEqual(sepuh.json.users.map(u => u.email), ['olist-b@example.test']);
  const wildcard = await send('GET', '/owner/users?q=%25');
  assert.equal(wildcard.json.users.length, 0, 'LIKE wildcards in the search box are treated literally');
});

it('user detail shows usage, keys (no secrets) and orders', async () => {
  const email = 'odetail@example.test';
  await app.login(email);
  await h.setTier(email, 'SULTAN');
  const cookie = await app.login(email);
  const key = (await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: 'mine' } })).json;
  await app.request('GET', '/api/tools/ping', app.asBrowser(cookie));
  const u = await h.userByEmail(email);
  const d = await send('GET', `/owner/users/${u.id}`);
  assert.equal(d.status, 200);
  assert.deepEqual([d.json.user.tier, d.json.usage.used, d.json.usage.limit, d.json.apiKeyLimit], ['SULTAN', 1, 1000, 2]);
  assert.equal(d.json.apiKeys.length, 1);
  const body = JSON.stringify(d.json);
  assert.ok(!body.includes(key.key) && !body.includes('key_hash') && !body.includes('google_id'));
  assert.equal((await send('GET', '/owner/users/00000000-0000-0000-0000-000000000000')).status, 404);
  assert.equal((await send('GET', '/owner/users/not-a-uuid')).status, 404);
});

it('ban/unban, tier change, key revoke and delete work and are audited', async () => {
  const email = 'oactions@example.test';
  await app.login(email);
  await h.setTier(email, 'SULTAN');
  const cookie = await app.login(email);
  const key = (await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: 'k' } })).json;
  const { id } = await h.userByEmail(email);

  assert.equal((await send('POST', `/owner/users/${id}/ban`, { reason: 'abuse' })).status, 200);
  assert.equal((await app.request('GET', '/auth/me', { cookie })).status, 401, 'ban revokes existing sessions');
  assert.equal((await send('POST', `/owner/users/${id}/unban`)).status, 200);

  assert.equal((await send('PATCH', `/owner/users/${id}/tier`, { tier: 'DEWA' })).json.user.tier, 'DEWA');
  assert.equal((await send('PATCH', `/owner/users/${id}/tier`, { tier: 'OWNER' })).json.error, 'INVALID_TIER', 'OWNER cannot be granted through tier');

  assert.equal((await send('POST', `/owner/users/${id}/keys/${key.record.id}/revoke`)).status, 200);
  assert.equal((await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key.key}` } })).json.error, 'API_KEY_REVOKED');

  assert.equal((await send('DELETE', `/owner/users/${id}`)).status, 200);
  assert.equal(await h.userByEmail(email), undefined);
  assert.equal((await h.db().query('SELECT count(*)::int n FROM api_keys WHERE user_id=$1', [id])).rows[0].n, 0, 'keys cascade');

  const audit = await send('GET', '/owner/audit');
  const actions = audit.json.logs.filter(l => l.target_id === id || l.metadata?.userId === id).map(l => l.action);
  for (const a of ['user_ban', 'user_unban', 'user_tier_change', 'owner_api_key_revoke', 'user_delete']) assert.ok(actions.includes(a), a);
});

it('the owner account cannot be banned, demoted or deleted from the panel', async () => {
  const { id } = await h.userByEmail(h.OWNER_EMAIL);
  for (const [method, url, body] of [['POST', `/owner/users/${id}/ban`], ['PATCH', `/owner/users/${id}/tier`, { tier: 'FREE' }], ['DELETE', `/owner/users/${id}`]]) {
    assert.equal((await send(method, url, body)).json.error, 'SELF_ACTION_BLOCKED', `${method} ${url}`);
  }
});

it('system status reports configuration presence only, never values', async () => {
  const r = await send('GET', '/owner/status');
  assert.equal(r.status, 200);
  assert.equal(r.json.database.connected, true);
  assert.equal(r.json.database.ok, true, JSON.stringify(r.json.database.missing));
  assert.equal(r.json.config.AUTH_SECRET, true);
  assert.equal(r.json.config.PAKASIR_API_KEY, false);
  assert.equal(r.json.payments.automaticSettlement, 'disabled_fail_closed');
  assert.equal(r.json.notifications.configured, false);
  assert.ok(r.json.plugins.loaded.includes('/api/tools/ping'));
  const text = r.text;
  for (const secret of [process.env.AUTH_SECRET, process.env.DATABASE_URL, process.env.GOOGLE_CLIENT_ID]) assert.ok(!text.includes(secret));
});

it('backup is owner-only and never contains plaintext keys', async () => {
  await app.login('obackup@example.test');
  await h.setTier('obackup@example.test', 'SULTAN');
  const cookie = await app.login('obackup@example.test');
  const { key } = (await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name: 'b' } })).json;
  assert.equal((await app.request('GET', '/owner/backup', { cookie })).status, 403);
  const r = await send('GET', '/owner/backup');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-disposition'], /attachment/);
  // Only the short display prefix (key_prefix) is stored; the full secret never is.
  assert.ok(r.text.includes(key.slice(0, 19)));
  assert.ok(!r.text.includes(key));
});
