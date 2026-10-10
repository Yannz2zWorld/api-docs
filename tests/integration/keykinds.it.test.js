'use strict';
// Numeric user IDs, website password from the Profile, Public / Private / Owner API keys
// (access lists, reset, enable/disable) and Maintenance Info Website.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner, alice, bob;
before(async () => {
  if (h.skip) return;
  delete process.env.GITHUB_TOKEN;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  alice = await app.login('alice@example.test');
  bob = await app.login('bob@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
const as = (cookie, method, url, body) => app.request(method, url, { cookie, headers: { origin: app.origin }, body });
const ping = (key, cookie) => app.request('GET', '/api/tools/ping', { cookie, headers: { authorization: `Bearer ${key}` } });
const publicIdOf = async email => Number((await h.db().query('SELECT public_id FROM users WHERE lower(email)=lower($1)', [email])).rows[0].public_id);

// ---------------------------------------------------------------- numeric IDs
it('every account gets a random numeric ID in 10100000..12345678; the owner is 10000000', async () => {
  const a = await publicIdOf('alice@example.test'), b = await publicIdOf('bob@example.test');
  for (const v of [a, b]) assert.ok(v >= 10100000 && v <= 12345678, String(v));
  assert.notEqual(a, b);
  const pa = await as(alice, 'GET', '/api/profile');
  assert.equal(pa.json.profile.publicId, a);
  assert.equal(pa.json.profile.id, String(a));
  const po = await o('GET', '/api/profile');
  assert.equal(po.json.profile.publicId, 10000000);
});

it('the owner panel finds users by numeric ID (search, reset password, key access)', async () => {
  const a = await publicIdOf('alice@example.test');
  const list = await o('GET', `/owner/users?q=${a}`);
  assert.deepEqual(list.json.users.map(u => u.email), ['alice@example.test']);
  assert.equal(list.json.users[0].publicId, a);
  const own = await o('GET', '/owner/users?q=10000000');
  assert.deepEqual(own.json.users.map(u => u.email), [h.OWNER_EMAIL]);
  const reset = await o('POST', '/owner/users/reset-password', { user: String(a), password: 'Reset1234' });
  assert.equal(reset.status, 200, reset.text);
  assert.equal(reset.json.user.email, 'alice@example.test');
  alice = await app.login('alice@example.test');           // the reset signed alice out
});

// ---------------------------------------------------------------- website password
it('a Google account creates a website password without an old one; then the old one is required', async () => {
  const carl = await app.login('carl@example.test');
  let p = await as(carl, 'GET', '/api/profile');
  assert.equal(p.json.profile.hasPassword, false);
  const made = await as(carl, 'POST', '/api/profile/password', { password: 'Website123' });
  assert.equal(made.status, 200, made.text);
  assert.equal(made.json.created, true);
  const cookie = made.headers['set-cookie'][0].split(';')[0];
  p = await as(cookie, 'GET', '/api/profile');
  assert.equal(p.json.profile.hasPassword, true, 'this browser stays signed in');
  const login = await app.request('POST', '/auth/login', { headers: { origin: app.origin }, body: { email: 'carl@example.test', password: 'Website123' } });
  assert.equal(login.status, 200, login.text);
  const noOld = await as(cookie, 'POST', '/api/profile/password', { password: 'Another123' });
  assert.deepEqual([noOld.status, noOld.json.error], [400, 'WRONG_PASSWORD']);
  const wrong = await as(cookie, 'POST', '/api/profile/password', { current: 'nope12345', password: 'Another123' });
  assert.equal(wrong.json.error, 'WRONG_PASSWORD');
  const ok = await as(cookie, 'POST', '/api/profile/password', { current: 'Website123', password: 'Another123' });
  assert.equal(ok.status, 200, ok.text);
  assert.notEqual(ok.json.created, true);
});

// ---------------------------------------------------------------- key kinds
it('public key: anyone with the key may use it, with the key\'s own tier (never the owner\'s)', async () => {
  const r = await o('POST', '/owner/keys', { kind: 'public', name: 'Publik', custom_key: 'YANN-PUBLIC-001', tier: 'FREE', duration: '7d' });
  assert.equal(r.status, 201, r.text);
  assert.equal(r.json.record.visibility, 'public');
  assert.equal(r.json.key, 'YANN-PUBLIC-001');
  const anon = await ping('YANN-PUBLIC-001');
  assert.equal(anon.status, 200, anon.text);
  assert.equal(anon.json.result.tier, 'FREE');
  assert.equal((await ping('YANN-PUBLIC-001', bob)).status, 200);
  const dup = await o('POST', '/owner/keys', { kind: 'private', name: 'dup', custom_key: 'YANN-PUBLIC-001', tier: 'FREE', duration: '1d', access: ['bob@example.test'] });
  assert.deepEqual([dup.status, dup.json.error], [409, 'CUSTOM_KEY_TAKEN'], 'a custom value already in use is refused');
});

it('public key reset: the old value stops working, the new one works', async () => {
  const id = (await h.db().query("SELECT id FROM api_keys WHERE name='Publik'")).rows[0].id;
  const r = await o('POST', `/owner/keys/${id}/regenerate`, {});
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.key, /^yannz_live_/);
  assert.equal((await ping('YANN-PUBLIC-001')).json.error, 'INVALID_API_KEY');
  assert.equal((await ping(r.json.key)).status, 200);
  const custom = await o('POST', `/owner/keys/${id}/regenerate`, { custom_key: 'YANN-PUBLIC-002' });
  assert.equal(custom.json.key, 'YANN-PUBLIC-002');
  assert.equal((await ping(r.json.key)).json.error, 'INVALID_API_KEY');
  assert.equal((await ping('YANN-PUBLIC-002')).status, 200);
});

it('private key: only listed accounts (checked by their sign-in), others refused even with the key', async () => {
  const r = await o('POST', '/owner/keys', { kind: 'private', name: 'Privat', custom_key: 'YANN-PRIVATE-USER01', tier: 'SULTAN', duration: 'permanent', access: 'alice@example.test' });
  assert.equal(r.status, 201, r.text);
  assert.deepEqual(r.json.record.access.map(u => u.email), ['alice@example.test']);
  const key = 'YANN-PRIVATE-USER01';
  const ok = await ping(key, alice);
  assert.equal(ok.status, 200, ok.text);
  assert.equal(ok.json.result.tier, 'SULTAN');
  assert.deepEqual([(await ping(key, bob)).status, (await ping(key, bob)).json.error], [403, 'PRIVATE_KEY_DENIED']);
  assert.deepEqual([(await ping(key)).status, (await ping(key)).json.error], [401, 'PRIVATE_KEY_LOGIN_REQUIRED']);

  // add bob by numeric ID, then reset access to bob only, then remove bob
  const id = r.json.record.id;
  const add = await o('POST', `/owner/keys/${id}/access`, { users: [String(await publicIdOf('bob@example.test'))] });
  assert.deepEqual(add.json.access.map(u => u.email).sort(), ['alice@example.test', 'bob@example.test']);
  assert.equal((await ping(key, bob)).status, 200);
  const reset = await o('PUT', `/owner/keys/${id}/access`, { users: ['bob@example.test'] });
  assert.deepEqual(reset.json.access.map(u => u.email), ['bob@example.test']);
  assert.equal((await ping(key, alice)).json.error, 'PRIVATE_KEY_DENIED', 'reset removed the old access');
  const bobId = reset.json.access[0].id;
  const rm = await o('DELETE', `/owner/keys/${id}/access/${bobId}`);
  assert.deepEqual(rm.json.access, []);
  assert.equal((await ping(key, bob)).json.error, 'PRIVATE_KEY_DENIED');
  const unknown = await o('POST', `/owner/keys/${id}/access`, { users: ['ghost@example.test'] });
  assert.deepEqual([unknown.status, unknown.json.error], [404, 'USER_NOT_FOUND']);

  // the user sees the private key shared with them on the Keys page
  await o('POST', `/owner/keys/${id}/access`, { users: ['alice@example.test'] });
  const mine = await as(alice, 'GET', '/api/keys');
  assert.deepEqual(mine.json.shared.map(k => k.name), ['Privat']);
});

it('private key needs at least one user; non-owners cannot manage keys', async () => {
  const none = await o('POST', '/owner/keys', { kind: 'private', name: 'x', tier: 'FREE', duration: '1d', access: [] });
  assert.equal(none.json.error, 'ACCESS_REQUIRED');
  const nope = await as(alice, 'POST', '/owner/keys', { kind: 'public', name: 'x', tier: 'DEWA', duration: '1d' });
  assert.deepEqual([nope.status, nope.json.error], [403, 'OWNER_REQUIRED']);
  const id = (await h.db().query("SELECT id FROM api_keys WHERE name='Privat'")).rows[0].id;
  for (const [m, u] of [['POST', `/owner/keys/${id}/regenerate`], ['POST', `/owner/keys/${id}/access`], ['PUT', `/owner/keys/${id}/access`], ['POST', `/owner/keys/${id}/disable`]]) {
    assert.equal((await as(alice, m, u, { users: ['alice@example.test'] })).status, 403, u);
  }
});

it('owner key "Yannz2z": created for the owner, usable only by the owner, with the special refusal', async () => {
  const list = await o('POST', '/owner/keys/search', { kind: 'owner' });
  assert.equal(list.json.ownerKey, 'created');
  assert.equal(list.json.keys.length, 1);
  assert.equal(list.json.keys[0].visibility, 'owner');
  const mine = await ping('Yannz2z', owner);
  assert.equal(mine.status, 200, mine.text);
  assert.equal(mine.json.result.tier, 'OWNER');
  for (const cookie of [alice, undefined]) {
    const r = await ping('Yannz2z', cookie);
    assert.deepEqual([r.status, r.json.error, r.json.message], [403, 'OWNER_KEY_ONLY', 'Yahaha mau ngambil key gwa ya 😹😝']);
  }
  const again = await o('POST', '/owner/keys/search', {});
  assert.equal(again.json.ownerKey, 'exists');
  const second = await o('POST', '/owner/keys', { kind: 'owner', name: 'second', custom_key: 'OwnerTwo', duration: 'permanent' });
  assert.deepEqual([second.status, second.json.error], [409, 'OWNER_KEY_EXISTS']);
  const revoke = await o('POST', `/owner/keys/${list.json.keys[0].id}/revoke`);
  assert.equal(revoke.json.error, 'OWNER_KEY_KEEP');

  // reset: the old value is invalid, the new one is still owner-only
  const reset = await o('POST', `/owner/keys/${list.json.keys[0].id}/regenerate`, { custom_key: 'Yannz2z-baru' });
  assert.equal(reset.status, 200, reset.text);
  assert.equal((await ping('Yannz2z', owner)).json.error, 'INVALID_API_KEY');
  assert.equal((await ping('Yannz2z-baru', owner)).status, 200);
  assert.equal((await ping('Yannz2z-baru', bob)).json.message, 'Yahaha mau ngambil key gwa ya 😹😝');
});

it('an existing personal "Yannz2z" key of the owner becomes the owner key; another user\'s is never taken', async () => {
  await h.db().query("DELETE FROM api_keys WHERE visibility='owner'");
  const made = await o('POST', '/api/keys', { name: 'mine', custom_key: 'Yannz2z' });
  assert.equal(made.status, 201, made.text);
  const list = await o('POST', '/owner/keys/search', { kind: 'owner' });
  assert.equal(list.json.ownerKey, 'converted');
  assert.equal((await ping('Yannz2z', alice)).json.error, 'OWNER_KEY_ONLY');
});

it('enable / disable and edit (name, tier, lifetime)', async () => {
  const id = (await h.db().query("SELECT id FROM api_keys WHERE name='Publik'")).rows[0].id;
  const dis = await o('POST', `/owner/keys/${id}/disable`);
  assert.equal(dis.json.status, 'disabled', dis.text);
  const off = await ping('YANN-PUBLIC-002');
  assert.deepEqual([off.status, off.json.error], [403, 'API_KEY_DISABLED']);
  assert.equal((await o('POST', `/owner/keys/${id}/enable`)).json.status, 'active');
  assert.equal((await ping('YANN-PUBLIC-002')).status, 200);
  const edit = await o('PATCH', `/owner/keys/${id}`, { name: 'Publik baru', tier: 'SEPUH', extend: '3d' });
  assert.equal(edit.status, 200, edit.text);
  assert.deepEqual([edit.json.key.name, edit.json.key.tier], ['Publik baru', 'SEPUH']);
  const acct = await o('PATCH', `/owner/keys/${id}`, { tier: 'ACCOUNT' });
  assert.equal(acct.json.error, 'INVALID_TIER', 'public keys always keep their own tier');
  const revoked = await o('POST', `/owner/keys/${id}/revoke`);
  assert.equal(revoked.status, 200);
  assert.equal((await o('POST', `/owner/keys/${id}/enable`)).json.error, 'KEY_REVOKED');
});

// ---------------------------------------------------------------- maintenance
it('Maintenance Info Website: pages, API and every sign-in are closed to users; the owner keeps full access', async () => {
  const on = await o('PATCH', '/owner/server', { maintenance_enabled: true, maintenance_message: 'Upgrade server <b>malam ini</b>' });
  assert.equal(on.status, 200, on.text);
  try {
    for (const url of ['/profile', '/keys', '/api', '/pricing']) {
      const r = await app.request('GET', url, { cookie: alice, headers: { accept: 'text/html' } });
      assert.equal(r.status, 503, url);
      assert.match(r.text, /Website lagi maintenance/, url);
      assert.match(r.text, /Upgrade server &lt;b&gt;malam ini&lt;\/b&gt;/, 'message is escaped');
    }
    // Sign-in page and Home: the sign-in page with the maintenance announcement card over it.
    for (const url of ['/', '/home']) {
      const r = await app.request('GET', url, { cookie: alice, headers: { accept: 'text/html' } });
      assert.equal(r.status, 503, url);
      assert.match(r.text, /window\.__yannzAnnounce=\{"maintenance":\{"message":"Upgrade server \\u003cb\\u003emalam ini\\u003c\/b\\u003e","since":"/, url + ': message escaped, start time included');
      assert.match(r.text, /\/assets\/announce\.js/, url);
    }
    const apiCall = await app.request('GET', '/api/profile', { cookie: alice });
    assert.deepEqual([apiCall.status, apiCall.json.error], [503, 'MAINTENANCE']);
    const sess = await app.request('GET', '/api/tools/ping', app.asBrowser(alice));
    assert.equal(sess.json.error, 'MAINTENANCE');
    const key = await o('POST', '/owner/keys', { kind: 'public', name: 'maint', tier: 'FREE', duration: '1d' });
    assert.equal(key.status, 201, 'the owner can still manage keys');
    assert.equal((await ping(key.json.key)).json.error, 'MAINTENANCE', 'keys of others are refused too');

    // sign-in: Google, email + password, register, codes — all refused for users
    const google = await app.request('POST', '/auth/google/credential', { headers: { origin: app.origin }, body: { credential: h.idToken({ sub: 'sub-alice@example.test', email: 'alice@example.test' }) } });
    assert.deepEqual([google.status, google.json.error], [503, 'MAINTENANCE']);
    const fresh = await app.request('POST', '/auth/google/credential', { headers: { origin: app.origin }, body: { credential: h.idToken({ sub: 'sub-new', email: 'newbie@example.test' }) } });
    assert.equal(fresh.json.error, 'MAINTENANCE');
    assert.equal(await h.userByEmail('newbie@example.test'), undefined, 'no account is created');
    for (const [url, body] of [['/auth/login', { email: 'carl@example.test', password: 'Another123' }], ['/auth/register', { name: 'X', email: 'x@example.test', password: 'abcd1234' }], ['/auth/password/forgot', { email: 'carl@example.test' }]]) {
      const r = await app.request('POST', url, { headers: { origin: app.origin }, body });
      assert.deepEqual([r.status, r.json.error], [503, 'MAINTENANCE'], url);
    }

    // the owner: still signs in (Google), sees pages, uses the API and the owner panel
    const ownerLogin = await app.request('POST', '/auth/google/credential', { headers: { origin: app.origin }, body: { credential: h.idToken({ sub: 'sub-' + h.OWNER_EMAIL, email: h.OWNER_EMAIL }) } });
    assert.equal(ownerLogin.status, 200, ownerLogin.text);
    owner = ownerLogin.headers['set-cookie'][0].split(';')[0];
    assert.equal((await app.request('GET', '/home', { cookie: owner })).status, 200);
    assert.equal((await app.request('GET', '/owner', { cookie: owner })).status, 200);
    assert.equal((await app.request('GET', '/owner-login')).status, 200, 'the owner sign-in page stays reachable');
    assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(owner))).status, 200);
    assert.equal((await o('GET', '/owner/server')).json.settings.maintenance_enabled, true);
  } finally {
    const off = await o('PATCH', '/owner/server', { maintenance_enabled: false });
    assert.equal(off.status, 200);
  }
  assert.equal((await app.request('GET', '/home', { cookie: alice })).status, 200, 'back to normal');
  assert.equal((await as(alice, 'GET', '/api/profile')).status, 200);
});
