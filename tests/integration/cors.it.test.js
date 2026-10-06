'use strict';
// Deployed-mode CORS: with VERCEL set, only the platform's own origins (plus CORS_ORIGINS)
// get CORS headers; any other origin gets none, so browsers block the response.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ VERCEL: '1', CORS_ORIGINS: 'https://partner.example' });
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('foreign origins get no CORS headers; the platform and configured origins do', async () => {
  const evil = await app.request('GET', '/api/tiers', { headers: { origin: 'https://evil.example' } });
  assert.equal(evil.headers['access-control-allow-origin'], undefined);
  for (const origin of ['https://apiz2z.vercel.app', 'https://partner.example']) {
    const r = await app.request('GET', '/api/tiers', { headers: { origin } });
    assert.equal(r.headers['access-control-allow-origin'], origin);
    assert.equal(r.headers['access-control-allow-credentials'], 'true');
  }
});

it('preflight from a foreign origin is not approved', async () => {
  const headers = { origin: 'https://evil.example', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type' };
  const r = await app.request('OPTIONS', '/api/keys', { headers });
  assert.equal(r.headers['access-control-allow-origin'], undefined);
  const ok = await app.request('OPTIONS', '/api/keys', { headers: { ...headers, origin: 'https://apiz2z.vercel.app' } });
  assert.equal(ok.headers['access-control-allow-origin'], 'https://apiz2z.vercel.app');
});

it('a foreign origin cannot use the session cookie even though the request reaches the server', async () => {
  const cookie = await app.login('cors@example.test');
  const r = await app.request('POST', '/api/orders', { cookie, headers: { origin: 'https://evil.example' }, body: { tier: 'SULTAN' } });
  assert.deepEqual([r.status, r.json.error], [403, 'CSRF_BLOCKED']);
  const sandbox = await app.request('GET', '/api/tools/ping', { cookie, headers: { origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', 'x-yannz-client': 'web' } });
  assert.equal(sandbox.status, 403);
});
