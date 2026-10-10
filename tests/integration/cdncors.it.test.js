'use strict';
// Developer panel → CDN → "Pasang izin upload": the server sets the storage bucket's CORS rules
// (S3 PutBucketCors) so /upload can send big files straight to it. The storage is stubbed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let calls = [], reply = () => new Response('', { status: 200 });
let app, owner, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const req = url instanceof Request ? url : new Request(url, opts);
    if (new URL(req.url).hostname === 's3.us-east-005.backblazeb2.com') {
      calls.push({ url: req.url, method: req.method, headers: Object.fromEntries(req.headers), body: await req.text() });
      return reply();
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ S3_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com', S3_BUCKET: 'webcdn22', S3_ACCESS_KEY_ID: 'kid005', S3_SECRET_ACCESS_KEY: 'secret-not-real', PUBLIC_BASE_URL: 'https://apiz2z.web.id' });
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('cdncors@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (cookie = owner) => app.request('POST', '/owner/api/cdn/storage/cors', { cookie, headers: { origin: app.origin }, body: {} });

it('the panel shows which storage is set up, never the keys', async () => {
  const r = await app.request('GET', '/owner/api/cdn/storage', { cookie: owner });
  assert.deepEqual(r.json.storage, { configured: true, kind: 's3', host: 's3.us-east-005.backblazeb2.com', bucket: 'webcdn22', private: true });
  assert.doesNotMatch(r.text, /kid005|secret-not-real/);
});

it('"Pasang izin upload" sets PUT/GET/HEAD for the site on the bucket, signed with the key', async () => {
  calls = [];
  const r = await post();
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.message, 'Telah disimpan. Upload file besar dari website udah diizinkan.');
  const c = calls[0];
  assert.equal(c.method, 'PUT');
  assert.equal(c.url, 'https://s3.us-east-005.backblazeb2.com/webcdn22?cors');
  assert.match(c.headers.authorization, /^AWS4-HMAC-SHA256 Credential=kid005\/\d{8}\/us-east-005\/s3\/aws4_request/);
  assert.ok(c.headers['content-md5']);
  assert.match(c.body, /<AllowedOrigin>https:\/\/apiz2z\.web\.id<\/AllowedOrigin>/);
  assert.match(c.body, /<AllowedMethod>PUT<\/AllowedMethod>/);
  assert.doesNotMatch(c.body + r.text, /secret-not-real/);
});

it('a key without bucket rights is explained; only the developer can do this', async () => {
  reply = () => new Response('<Error><Code>AccessDenied</Code><Message>not entitled</Message></Error>', { status: 403 });
  const r = await post();
  assert.equal(r.status, 502);
  assert.equal(r.json.error, 'STORAGE_CORS_FAILED');
  assert.match(r.json.message, /All buckets/);
  assert.match(r.json.message, /403: not entitled/);
  reply = () => new Response('', { status: 200 });
  assert.equal((await post(user)).status, 403);
});
