'use strict';
// Several domains at once: the Google redirect flow returns to the domain the visitor is on
// (when it is listed in CORS_ORIGINS), so the session cookie is set on that domain.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => {
  if (h.skip) return;
  delete process.env.GITHUB_TOKEN;
  await h.setupDatabase();
  app = await h.startApp({ VERCEL: '1', CORS_ORIGINS: 'https://domain2.test, https://domain3.test/', GOOGLE_CALLBACK_URL: 'https://main.test/auth/google/callback' });
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const start = host => app.request('GET', '/auth/google', { headers: { host, 'x-forwarded-proto': 'https' } });
const redirectUri = r => new URL(r.headers.location).searchParams.get('redirect_uri');

it('each allowed domain gets its own Google callback; others fall back to GOOGLE_CALLBACK_URL', async () => {
  assert.equal(redirectUri(await start('domain2.test')), 'https://domain2.test/auth/google/callback');
  assert.equal(redirectUri(await start('domain3.test')), 'https://domain3.test/auth/google/callback', 'a trailing slash in CORS_ORIGINS is fine');
  assert.equal(redirectUri(await start('evil.test')), 'https://main.test/auth/google/callback', 'unknown hosts never become a callback');
});

it('every listed domain is allowed for CORS; others are not', async () => {
  const cors = async origin => (await app.request('GET', '/api/tiers', { headers: { origin } })).headers['access-control-allow-origin'];
  assert.equal(await cors('https://domain2.test'), 'https://domain2.test');
  assert.equal(await cors('https://domain3.test'), 'https://domain3.test');
  assert.equal(await cors('https://evil.test'), undefined);
});
