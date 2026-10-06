'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('login creates a FREE user and /auth/me reflects server-side usage limits', async () => {
  const cookie = await app.login('free1@example.test');
  const me = await app.request('GET', '/auth/me', { cookie });
  assert.equal(me.status, 200);
  assert.equal(me.json.user.tier, 'FREE');
  assert.equal(me.json.user.isOwner, false);
  assert.deepEqual([me.json.usage.limit, me.json.apiKeys.limit], [100, 0]);
});

it('logout clears the cookie and revokes it server-side (a copied cookie stops working)', async () => {
  const cookie = await app.login('logout@example.test');
  const second = await app.login('logout@example.test');
  const out = await app.request('POST', '/auth/logout', { cookie, headers: { origin: app.origin } });
  assert.equal(out.status, 200);
  assert.match(out.headers['set-cookie'][0], /yannz_session=;.*Max-Age=0/);
  assert.equal((await app.request('GET', '/auth/me', { cookie })).status, 401);
  assert.equal((await app.request('GET', '/auth/me', { cookie: second })).status, 401, 'other sessions of the same account are revoked too');
  const again = await app.login('logout@example.test');
  assert.equal((await app.request('GET', '/auth/me', { cookie: again })).status, 200);
});

it('a forged or tampered cookie is rejected', async () => {
  const cookie = await app.login('tamper@example.test');
  const tampered = cookie.slice(0, -3) + (cookie.endsWith('AAA') ? 'BBB' : 'AAA');
  assert.equal((await app.request('GET', '/auth/me', { cookie: tampered })).status, 401);
  assert.equal((await app.request('GET', '/auth/me', { cookie: 'yannz_session=x.y.z' })).status, 401);
});

it('a banned user loses access immediately and cannot log back in', async () => {
  const cookie = await app.login('banned@example.test');
  await h.db().query("UPDATE users SET status='banned' WHERE email='banned@example.test'");
  assert.equal((await app.request('GET', '/auth/me', { cookie })).status, 403);
  assert.equal((await app.request('GET', '/api/dashboard', { cookie })).json.error, 'ACCOUNT_RESTRICTED');
  const relogin = await app.request('POST', '/auth/google/credential', { body: { credential: h.idToken({ sub: 'sub-banned@example.test', email: 'banned@example.test' }) }, headers: { origin: app.origin } });
  assert.equal(relogin.status, 403);
  assert.equal(relogin.json.error, 'ACCOUNT_RESTRICTED');
});

it('owner access comes from OWNER_EMAIL only, never from users.tier', async () => {
  const ownerCookie = await app.login(h.OWNER_EMAIL);
  const me = await app.request('GET', '/auth/me', { cookie: ownerCookie });
  assert.equal(me.json.user.isOwner, true);
  assert.equal(me.json.user.tier, 'OWNER');
  assert.equal((await app.request('GET', '/owner/dashboard', { cookie: ownerCookie })).status, 200);

  const cookie = await app.login('impostor@example.test');
  await h.setTier('impostor@example.test', 'OWNER');
  const impostor = await app.request('GET', '/auth/me', { cookie });
  assert.equal(impostor.json.user.tier, 'FREE');
  assert.equal(impostor.json.user.isOwner, false);
  const denied = await app.request('GET', '/owner/dashboard', { cookie });
  assert.deepEqual([denied.status, denied.json.error], [403, 'OWNER_REQUIRED']);
});

it('owner APIs and pages reject anonymous and normal users', async () => {
  const anon = await app.request('GET', '/owner/users');
  assert.deepEqual([anon.status, anon.json.error], [401, 'AUTH_REQUIRED']);
  const page = await app.request('GET', '/owner');
  assert.equal(page.status, 302);
  const cookie = await app.login('normal@example.test');
  assert.equal((await app.request('GET', '/owner', { cookie })).status, 403);
  for (const [method, url] of [['GET', '/owner/status'], ['GET', '/owner/payments'], ['GET', '/owner/backup'], ['PATCH', '/owner/server']]) {
    const r = await app.request(method, url, { cookie, headers: { origin: app.origin }, body: method === 'GET' ? undefined : {} });
    assert.equal(r.status, 403, `${method} ${url}`);
  }
});

it('state-changing requests from another origin are blocked (CSRF)', async () => {
  const cookie = await app.login('csrf@example.test');
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) {
    const r = await app.request('POST', '/api/orders', { cookie, headers, body: { tier: 'SULTAN' } });
    assert.deepEqual([r.status, r.json.error], [403, 'CSRF_BLOCKED']);
  }
  const login = await app.request('POST', '/auth/google/credential', { body: { credential: h.idToken({ sub: 's', email: 'x@example.test' }) }, headers: { origin: 'https://evil.example' } });
  assert.equal(login.status, 403);
});

it('protected pages redirect to login instead of returning JSON', async () => {
  for (const url of ['/home', '/keys', '/billing']) {
    const r = await app.request('GET', url);
    assert.equal(r.status, 302, url);
  }
});

it('malformed JSON bodies get 400 INVALID_JSON, not a 500', async () => {
  const r = await app.request('POST', '/auth/google/credential', { rawBody: '{"credential":', headers: { origin: app.origin } });
  assert.deepEqual([r.status, r.json.error], [400, 'INVALID_JSON']);
});

it('the shared theme stylesheet is served for the account pages', async () => {
  const r = await app.request('GET', '/assets/theme.css');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /text\/css/);
  assert.match(r.text, /--bg:\s*#0b0b0c/);
});

it('the WebGL scene module is served as JavaScript', async () => {
  const r = await app.request('GET', '/assets/scene3d.js');
  assert.equal(r.status, 200);
  assert.match(r.headers['content-type'], /javascript/);
  assert.match(r.text, /from 'three'/);
});

it('the 3D scene page is public and loads three.js from the CDN', async () => {
  for (const url of ['/3d', '/scythe']) {
    const r = await app.request('GET', url);
    assert.equal(r.status, 200, url);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.match(r.text, /three@0\.147\.0\/build\/three\.min\.js/);
    assert.match(r.text, /href="\/home"/);
  }
});
