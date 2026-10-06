'use strict';
// Part 3 audit coverage: Google token edge cases, the OAuth redirect flow, first-login races,
// cookie flags, client-supplied privilege fields, shared quota across keys, the TikTok
// plugin (stubbed upstream) and secret-free logs.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const path = require('node:path');
const h = require('./helpers');

let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const ROOT = path.join(__dirname, '..', '..');
const credential = (token, origin = app.origin) => app.request('POST', '/auth/google/credential', { body: { credential: token }, headers: { origin } });
const cookieOf = r => r.headers['set-cookie']?.[0]?.split(';')[0];

async function userWithTier(email, tier) {
  await app.login(email);
  if (tier) await h.setTier(email, tier);
  return app.login(email);
}
const createKey = async (cookie, name) => (await app.request('POST', '/api/keys', { cookie, headers: { origin: app.origin }, body: { name } })).json.key;

it('Google tokens with a wrong audience, wrong issuer, expiry or bad signature are rejected', async () => {
  const now = Math.floor(Date.now() / 1000);
  const cases = [
    [h.idToken({ sub: 'g1', email: 'g1@example.test', aud: 'someone-else.apps.googleusercontent.com' }), 'INVALID_CREDENTIAL'],
    [h.idToken({ sub: 'g2', email: 'g2@example.test', iss: 'https://evil.example' }), 'INVALID_CREDENTIAL'],
    [h.idToken({ sub: 'g3', email: 'g3@example.test', iat: now - 7200, exp: now - 3600 }), 'INVALID_CREDENTIAL']
  ];
  // Same claims, signed by a key Google never published.
  const valid = h.idToken({ sub: 'g4', email: 'g4@example.test' });
  const [head, body] = valid.split('.');
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  cases.push([`${head}.${body}.${crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), privateKey).toString('base64url')}`, 'INVALID_CREDENTIAL']);
  cases.push(['not-a-jwt', 'INVALID_CREDENTIAL']);
  for (const [token, error] of cases) {
    const r = await credential(token);
    assert.deepEqual([r.status, r.json.error], [401, error]);
    assert.equal(r.headers['set-cookie'], undefined, 'no session on failure');
  }
  for (const email of ['g1@example.test', 'g2@example.test', 'g3@example.test', 'g4@example.test']) {
    assert.equal(await h.userByEmail(email), undefined, `${email} was not created`);
  }
});

it('Google accounts without a verified email cannot log in', async () => {
  const r = await credential(h.idToken({ sub: 'unverified', email: 'unverified@example.test', email_verified: false }));
  assert.deepEqual([r.status, r.json.error], [403, 'EMAIL_NOT_VERIFIED']);
  assert.equal(await h.userByEmail('unverified@example.test'), undefined);
});

it('parallel first logins for the same Google account create exactly one user', async () => {
  const token = h.idToken({ sub: 'race-sub', email: 'race@example.test', name: 'Race' });
  const results = await Promise.all(Array.from({ length: 8 }, () => credential(token)));
  assert.deepEqual(results.map(r => r.status), Array(8).fill(200));
  const rows = await h.db().query("SELECT count(*)::int AS n FROM users WHERE lower(email)='race@example.test'");
  assert.equal(rows.rows[0].n, 1);
});

it('the session cookie is HttpOnly, Secure, SameSite=Lax and expires in 7 days', async () => {
  const r = await credential(h.idToken({ sub: 'cookie-sub', email: 'cookie@example.test' }));
  const header = r.headers['set-cookie'][0];
  assert.match(header, /^yannz_session=/);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', `Max-Age=${7 * 24 * 60 * 60}`]) assert.ok(header.includes(flag), flag);
  assert.doesNotMatch(header, /cookie@example|cookie-sub/, 'cookie content is encrypted');
});

it('OAuth redirect flow: state is required and the callback verifies the returned ID token', async () => {
  const start = await app.request('GET', '/auth/google');
  assert.equal(start.status, 302);
  const location = new URL(start.headers.location);
  assert.equal(location.hostname, 'accounts.google.com');
  const state = location.searchParams.get('state');
  assert.ok(state && state.length >= 40);
  const stateCookie = cookieOf(start);
  assert.match(stateCookie, /^oauth_state=/);

  const bad = await app.request('GET', `/auth/google/callback?code=c&state=${state}x`, { cookie: stateCookie });
  assert.equal(bad.status, 400);
  const noCookie = await app.request('GET', `/auth/google/callback?code=c&state=${state}`);
  assert.equal(noCookie.status, 400);

  const { OAuth2Client } = require(path.join(ROOT, 'node_modules', 'google-auth-library'));
  const original = OAuth2Client.prototype.getToken;
  try {
    OAuth2Client.prototype.getToken = async () => ({ tokens: { access_token: 'stub-access', id_token: h.idToken({ sub: 'redirect-sub', email: 'redirect@example.test', name: 'Redirect' }) } });
    const ok = await app.request('GET', `/auth/google/callback?code=c&state=${state}`, { cookie: stateCookie });
    assert.deepEqual([ok.status, ok.headers.location], [302, '/home']);
    const session = ok.headers['set-cookie'].find(c => c.startsWith('yannz_session=') && !c.startsWith('yannz_session=;'));
    const me = await app.request('GET', '/auth/me', { cookie: session.split(';')[0] });
    assert.equal(me.json.user.email, 'redirect@example.test');

    OAuth2Client.prototype.getToken = async () => ({ tokens: { access_token: 'stub', id_token: h.idToken({ sub: 'redirect-unv', email: 'redirect-unv@example.test', email_verified: false }) } });
    const unverified = await app.request('GET', `/auth/google/callback?code=c&state=${state}`, { cookie: stateCookie });
    assert.equal(unverified.status, 403);

    OAuth2Client.prototype.getToken = async () => ({ tokens: { access_token: 'stub', id_token: h.idToken({ sub: 'redirect-aud', email: 'redirect-aud@example.test', aud: 'other-client' }) } });
    const wrongAudience = await app.request('GET', `/auth/google/callback?code=c&state=${state}`, { cookie: stateCookie });
    assert.deepEqual([wrongAudience.status, wrongAudience.headers.location], [302, '/?oauth=error']);
    assert.equal(await h.userByEmail('redirect-aud@example.test'), undefined);
  } finally {
    OAuth2Client.prototype.getToken = original;
  }
});

it('client-supplied tier, owner and price fields are ignored; __proto__ payloads pollute nothing', async () => {
  const cookie = await app.login('privilege@example.test');
  const order = await app.request('POST', '/api/orders', {
    cookie, headers: { origin: app.origin },
    rawBody: '{"tier":"SULTAN","amount":1,"price":1,"status":"paid","isOwner":true,"user_id":"00000000-0000-0000-0000-000000000000","__proto__":{"isOwner":true,"tier":"OWNER"}}'
  });
  assert.equal(order.status, 201);
  assert.notEqual(order.json.order.amount, 1);
  assert.equal(order.json.order.status, 'pending');
  assert.equal(({}).isOwner, undefined);
  assert.equal(({}).tier, undefined);
  const me = await app.request('GET', '/auth/me', { cookie });
  assert.deepEqual([me.json.user.tier, me.json.user.isOwner], ['FREE', false]);
  assert.equal((await app.request('GET', '/owner/dashboard', { cookie })).status, 403);
  assert.equal((await h.userByEmail('privilege@example.test')).tier, 'FREE');
});

it('all keys of one account share a single daily quota; a key wins over a session cookie', async () => {
  const cookie = await userWithTier('sharedq@example.test', 'SULTAN');
  const user = await h.userByEmail('sharedq@example.test');
  const [a, b] = [await createKey(cookie, 'a'), await createKey(cookie, 'b')];
  await h.db().query("INSERT INTO daily_quota_counters(user_id,usage_date,request_count) VALUES($1,(now() AT TIME ZONE 'UTC')::date,998)", [user.id]);
  const ping = (key, extra = {}) => app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}`, ...extra } });
  assert.equal((await ping(a)).status, 200);
  assert.equal((await ping(b)).status, 200);
  const over = await ping(a);
  assert.deepEqual([over.status, over.json.error], [429, 'QUOTA_EXCEEDED']);
  assert.equal((await ping(b)).json.error, 'QUOTA_EXCEEDED');
  assert.equal(await h.usedToday(user.id), 1000);

  // A request carrying both a revoked key and a valid session is judged by the key.
  const other = await userWithTier('keywins@example.test', 'SULTAN');
  const key = await createKey(other, 'x');
  const id = (await h.db().query("SELECT k.id FROM api_keys k JOIN users u ON u.id=k.user_id WHERE u.email='keywins@example.test'")).rows[0].id;
  await app.request('POST', `/api/keys/${id}/revoke`, { cookie: other, headers: { origin: app.origin } });
  const mixed = await app.request('GET', '/api/tools/ping', app.asBrowser(other, { authorization: `Bearer ${key}` }));
  assert.deepEqual([mixed.status, mixed.json.error], [401, 'API_KEY_REVOKED']);
});

it('TikTok: only TikTok links are accepted and a successful upstream answer is returned and charged once', async () => {
  const cookie = await app.login('tiktok@example.test');
  const user = await h.userByEmail('tiktok@example.test');
  for (const url of ['https://evil.example/video/1', 'javascript:alert(1)', 'https://tiktok.com.evil.example/x', 'ftp://www.tiktok.com/x']) {
    const r = await app.request('GET', `/api/download/tiktok?url=${encodeURIComponent(url)}`, app.asBrowser(cookie));
    assert.deepEqual([r.status, r.json.error], [400, 'INVALID_PARAMETER'], url);
  }
  assert.equal(await h.usedToday(user.id), 0, 'validation failures are refunded');

  const axios = require(path.join(ROOT, 'node_modules', 'axios'));
  const original = axios.post;
  let forwarded;
  axios.post = async (url, body, opts) => {
    forwarded = opts.params.url;
    return { data: { code: 0, data: {
      id: '7', title: 'clip', region: 'ID', duration: 9, create_time: 1700000000, cover: '/cover.jpg',
      play: '/play.mp4', wmplay: '/wm.mp4', hdplay: '/hd.mp4', music: '/m.mp3',
      music_info: { id: 'm', title: 'song', author: 'a' }, author: { id: 'u', unique_id: 'user', nickname: 'User', avatar: '/a.jpg' },
      play_count: 1200, digg_count: 3, comment_count: 1, share_count: 0, download_count: 0
    } } };
  };
  try {
    const r = await app.request('GET', '/api/download/tiktok?url=' + encodeURIComponent('https://vt.tiktok.com/ZSabc/'), app.asBrowser(cookie));
    assert.equal(r.status, 200);
    assert.equal(forwarded, 'https://vt.tiktok.com/ZSabc/');
    assert.equal(r.json.result.data.find(m => m.type === 'nowatermark').url, 'https://www.tikwm.com/play.mp4');
    assert.equal(r.json.result.stats.views, '1.200');
    assert.equal(r.json.result.author.nickname, 'User');
  } finally {
    axios.post = original;
  }
  assert.equal(await h.usedToday(user.id), 1);
});

it('manual payment on an expired order is refused and changes nothing', async () => {
  const owner = await app.login('payer@example.test');
  const order = (await app.request('POST', '/api/orders', { cookie: owner, headers: { origin: app.origin }, body: { tier: 'SULTAN' } })).json.order;
  await h.db().query("UPDATE orders SET status='expired' WHERE id=$1", [order.id]);
  const body = { method: 'QRIS', proof_url: 'https://example.test/proof.png' };
  const expired = await app.request('POST', `/api/orders/${order.id}/manual`, { cookie: owner, headers: { origin: app.origin }, body });
  assert.equal(expired.json.error, 'ORDER_NOT_FOUND', `expired order answered ${expired.status} ${expired.text}`);
  assert.equal((await h.db().query('SELECT count(*)::int AS n FROM payments WHERE order_id=$1', [order.id])).rows[0].n, 0);
  assert.equal((await h.userByEmail('payer@example.test')).tier, 'FREE');
});

it('security headers are present on pages and API responses', async () => {
  for (const url of ['/', '/api/tiers']) {
    const r = await app.request('GET', url);
    assert.equal(r.headers['x-content-type-options'], 'nosniff', url);
    assert.equal(r.headers['x-frame-options'], 'DENY', url);
    assert.match(r.headers['permissions-policy'], /camera=\(\)/, url);
    assert.match(r.headers['content-security-policy'], /frame-ancestors 'none'/, url);
    assert.equal(r.headers['x-powered-by'], undefined, url);
  }
});

it('logs never contain Google ID tokens, API keys or session cookies', async () => {
  const cookie = await userWithTier('logsafe@example.test', 'SULTAN');
  const key = await createKey(cookie, 'log');
  const token = h.idToken({ sub: 'logsafe-bad', email: 'logsafe@example.test', aud: 'wrong' });
  await credential(token);
  await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}x` } });
  await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key}` } });
  const all = h.logs.join('\n');
  assert.ok(!all.includes(token), 'id token');
  assert.ok(!all.includes(token.split('.')[1]), 'id token payload');
  assert.ok(!all.includes(key), 'api key');
  assert.ok(!all.includes(cookie.split('=')[1]), 'session cookie');
  assert.ok(!all.includes(process.env.AUTH_SECRET), 'AUTH_SECRET');
});
