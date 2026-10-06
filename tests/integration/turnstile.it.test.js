'use strict';
// Cloudflare Turnstile on the email/password forms. Cloudflare is never contacted: global fetch
// is stubbed for challenges.cloudflare.com.
const { test, before, after, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
const realFetch = global.fetch;
let calls = [];
let verdict = { status: 200, json: { success: true } };

before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  global.fetch = async (url, opts = {}) => {
    if (!String(url).startsWith('https://challenges.cloudflare.com/')) return realFetch(url, opts);
    calls.push(Object.fromEntries(new URLSearchParams(String(opts.body))));
    if (verdict === 'down') throw new Error('network down');
    return new Response(JSON.stringify(verdict.json), { status: verdict.status, headers: { 'content-type': 'application/json' } });
  };
});
afterEach(() => { calls = []; verdict = { status: 200, json: { success: true } }; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; });
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const enable = () => { process.env.TURNSTILE_SITE_KEY = 'site-key-test'; process.env.TURNSTILE_SECRET_KEY = 'secret-test'; };
const login = body => app.request('POST', '/auth/login', { headers: { origin: app.origin }, body: { email: 'nobody@example.test', password: 'wrong-pass-1', ...body } });

it('off until both keys are set: forms work without a token and the page gets no site key', async () => {
  const r = await login({});
  assert.equal(r.json.error, 'INVALID_LOGIN');
  assert.equal(calls.length, 0);
  const cfg = await app.request('GET', '/auth/config');
  assert.equal(cfg.json.turnstileSiteKey, null);
});

it('when enabled the login page gets the site key, never the secret', async () => {
  enable();
  const cfg = await app.request('GET', '/auth/config');
  assert.equal(cfg.json.turnstileSiteKey, 'site-key-test');
  assert.doesNotMatch(cfg.text, /secret-test/);
});

it('every sign-in route needs a valid token: email/password, register, codes, reset and Google', async () => {
  enable();
  for (const [url, body] of [
    ['/auth/login', {}], ['/auth/register', { name: 'Bot', password: 'abcd1234' }], ['/auth/email/verify', { code: '123456' }],
    ['/auth/email/resend', {}], ['/auth/password/forgot', {}], ['/auth/password/reset', { code: '123456', password: 'abcd1234' }],
    ['/auth/google/credential', { credential: 'x.y.z' }]
  ]) {
    const r = await app.request('POST', url, { headers: { origin: app.origin }, body: { email: 'bot@example.test', ...body } });
    assert.deepEqual([r.status, r.json.error], [400, 'TURNSTILE_REQUIRED'], url);
  }
  assert.equal(calls.length, 0, 'no token: Cloudflare is not even asked');
});

it('the Google redirect flow is sent back to the login page without a passed check', async () => {
  enable();
  let r = await app.request('GET', '/auth/google');
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, '/?auth=turnstile');
  assert.doesNotMatch(String(r.headers['set-cookie'] || ''), /oauth_state/, 'no OAuth state is issued');
  verdict = { status: 200, json: { success: false } };
  r = await app.request('GET', '/auth/google?ts=tok-bad');
  assert.equal(r.headers.location, '/?auth=turnstile');
  verdict = { status: 200, json: { success: true } };
  r = await app.request('GET', '/auth/google?ts=tok-ok');
  assert.notEqual(r.headers.location, '/?auth=turnstile', 'a passed check continues to Google');
});

it('a passing token lets the request through; the secret and token go to Cloudflare only', async () => {
  enable();
  const r = await login({ turnstileToken: 'tok-ok' });
  assert.equal(r.json.error, 'INVALID_LOGIN', 'reached the password check');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].secret, 'secret-test');
  assert.equal(calls[0].response, 'tok-ok');
});

it('a rejected token is refused, and an unreachable Cloudflare fails closed', async () => {
  enable();
  verdict = { status: 200, json: { success: false, 'error-codes': ['invalid-input-response'] } };
  let r = await login({ turnstileToken: 'tok-bad' });
  assert.deepEqual([r.status, r.json.error], [403, 'TURNSTILE_FAILED']);
  verdict = 'down';
  r = await login({ turnstileToken: 'tok-any' });
  assert.deepEqual([r.status, r.json.error], [503, 'TURNSTILE_UNAVAILABLE']);
});

it('Google sign-in with a passing token reaches the Google token check', async () => {
  enable();
  const r = await app.request('POST', '/auth/google/credential', { headers: { origin: app.origin }, body: { credential: 'not-a-real-id-token', turnstileToken: 'tok-ok' } });
  assert.notEqual(r.json.error, 'TURNSTILE_REQUIRED');
  assert.notEqual(r.json.error, 'TURNSTILE_FAILED');
  assert.equal(calls.length, 1);
});
