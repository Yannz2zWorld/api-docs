'use strict';
// Large CDN uploads through Cloudflare R2 (lib/r2.js + services/cdnService.js). R2 is never contacted:
// global fetch is stubbed for the account's r2.cloudflarestorage.com host and keeps objects in memory.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const R2_HOST = 'acct123.r2.cloudflarestorage.com';
const PUBLIC = 'https://pub-test.r2.dev';
const realFetch = global.fetch;
const objects = new Map();   // key -> { size, contentType, disposition }
let calls = [];

let app, user, other;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const req = typeof input === 'string' || input instanceof URL ? new Request(String(input), init) : input;
    const u = new URL(req.url);
    if (u.hostname !== R2_HOST) return realFetch(input, init);
    const key = decodeURIComponent(u.pathname.split('/').pop());
    calls.push({ method: req.method, key, signed: u.searchParams.has('X-Amz-Signature') || Boolean(req.headers.get('authorization')) });
    if (req.method === 'PUT') {
      const body = Buffer.from(await req.arrayBuffer());
      objects.set(key, { size: body.length, contentType: req.headers.get('content-type') || '', disposition: req.headers.get('content-disposition') || '' });
      return new Response(null, { status: 200 });
    }
    if (req.method === 'HEAD') {
      const o = objects.get(key);
      return o ? new Response(null, { status: 200, headers: { 'content-length': String(o.size), 'content-type': o.contentType } }) : new Response(null, { status: 404 });
    }
    if (req.method === 'DELETE') { objects.delete(key); return new Response(null, { status: 204 }); }
    return new Response(null, { status: 405 });
  };
  await h.setupDatabase();
  app = await h.startApp({ R2_ACCOUNT_ID: 'acct123', R2_ACCESS_KEY_ID: 'AKIDTEST', R2_SECRET_ACCESS_KEY: 'secret-not-real', R2_BUCKET: 'yannz-cdn', R2_PUBLIC_URL: PUBLIC + '/', PUBLIC_BASE_URL: 'https://apiz2z.test' });
  user = await app.login('big@example.test');
  other = await app.login('other@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; delete process.env.CDN_ACCOUNT_LIMIT_MB; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (path, body, cookie = user) => app.request('POST', path, { cookie, body, headers: { origin: app.origin } });
// What the upload page does after /start: PUT the bytes to the presigned URL with the given headers.
const browserPut = (upload, bytes, overrideType) => fetch(upload.url, { method: 'PUT', body: bytes, headers: { ...upload.headers, ...(overrideType ? { 'Content-Type': overrideType } : {}) } });

it('config reports large uploads (200 MB) when R2 is set up', async () => {
  const r = await app.request('GET', '/cdn/upload/config', { cookie: user });
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.large, r.json.mode, r.json.maxBytes, r.json.smallMaxBytes], [true, 'r2', 200 * 1024 * 1024, 4 * 1024 * 1024]);
  assert.ok(!r.text.includes('secret-not-real') && !r.text.includes('AKIDTEST'));
});

it('start -> browser PUT to R2 -> finish gives a /cdn link that redirects to the bucket', async () => {
  const bytes = Buffer.alloc(6 * 1024 * 1024, 7);   // bigger than the 4 MB direct limit
  const start = await post('/cdn/upload/start', { name: 'Video Liburan.mp4', type: 'video/mp4', size: bytes.length });
  assert.equal(start.status, 200, start.text);
  const up = new URL(start.json.upload.url);
  assert.equal(up.hostname, R2_HOST);
  assert.equal(up.pathname, `/yannz-cdn/${start.json.id}`);
  assert.ok(up.searchParams.get('X-Amz-Signature'));
  assert.match(start.json.id, /^[a-f0-9]{32}\.mp4$/);
  assert.equal(start.json.upload.headers['Content-Type'], 'video/mp4');
  assert.equal(start.json.upload.headers['Content-Disposition'], "inline; filename*=UTF-8''Video%20Liburan.mp4");
  assert.ok(!start.text.includes('secret-not-real'));

  // not finished yet: the link does not work
  assert.equal((await app.request('GET', '/cdn/' + start.json.id, {})).status, 404);

  assert.equal((await browserPut(start.json.upload, bytes)).status, 200);
  const done = await post('/cdn/upload/finish', { id: start.json.id });
  assert.equal(done.status, 200, done.text);
  assert.equal(done.json.result.url, `https://apiz2z.test/cdn/${start.json.id}`);
  assert.deepEqual([done.json.result.size, done.json.result.mime, done.json.result.name], [bytes.length, 'video/mp4', 'Video Liburan.mp4']);
  assert.ok(calls.some(c => c.method === 'HEAD' && c.signed), 'finish checks the object in R2 with a signed request');

  const got = await app.request('GET', '/cdn/' + start.json.id, {});
  assert.equal(got.status, 302);
  assert.equal(got.headers.location, `${PUBLIC}/${start.json.id}`);
});

it('limits: over 200 MB is refused; unsafe types are stored as downloads', async () => {
  const big = await post('/cdn/upload/start', { name: 'film.mkv', type: 'video/x-matroska', size: 201 * 1024 * 1024 });
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'FILE_TOO_LARGE');
  assert.match(big.json.message, /200 MB/);

  const zip = await post('/cdn/upload/start', { name: 'arsip.zip', type: 'application/zip', size: 5 * 1024 * 1024 });
  assert.equal(zip.status, 200, zip.text);
  assert.equal(zip.json.upload.headers['Content-Type'], 'application/octet-stream');
  assert.match(zip.json.upload.headers['Content-Disposition'], /^attachment;/);
  const html = await post('/cdn/upload/start', { name: 'page.html', type: 'text/html', size: 5 * 1024 * 1024 });
  assert.equal(html.json.upload.headers['Content-Type'], 'application/octet-stream');
});

it('finish refuses a missing, resized or retyped upload and removes it', async () => {
  const missing = await post('/cdn/upload/start', { name: 'a.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 });
  const r1 = await post('/cdn/upload/finish', { id: missing.json.id });
  assert.equal(r1.json.error, 'UPLOAD_MISSING');
  assert.equal((await post('/cdn/upload/finish', { id: missing.json.id })).status, 404, 'the record is gone');

  const resized = await post('/cdn/upload/start', { name: 'b.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 });
  await browserPut(resized.json.upload, Buffer.alloc(5 * 1024 * 1024 + 10));
  assert.equal((await post('/cdn/upload/finish', { id: resized.json.id })).json.error, 'UPLOAD_SIZE_MISMATCH');
  assert.ok(!objects.has(resized.json.id), 'the object is deleted from R2');

  const retyped = await post('/cdn/upload/start', { name: 'c.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 });
  await browserPut(retyped.json.upload, Buffer.alloc(5 * 1024 * 1024), 'text/html');
  assert.equal((await post('/cdn/upload/finish', { id: retyped.json.id })).json.error, 'UPLOAD_TYPE_MISMATCH');
  assert.ok(!objects.has(retyped.json.id));
});

it("another account cannot finish someone else's upload; account storage limit applies", async () => {
  const mine = await post('/cdn/upload/start', { name: 'd.mp4', type: 'video/mp4', size: 5 * 1024 * 1024 });
  await browserPut(mine.json.upload, Buffer.alloc(5 * 1024 * 1024));
  assert.equal((await post('/cdn/upload/finish', { id: mine.json.id }, other)).status, 404);

  process.env.CDN_ACCOUNT_LIMIT_MB = '8';
  const full = await post('/cdn/upload/start', { name: 'e.mp4', type: 'video/mp4', size: 6 * 1024 * 1024 }, other);
  assert.equal(full.status, 200, 'first 6 MB fits in 8 MB');
  const over = await post('/cdn/upload/start', { name: 'f.mp4', type: 'video/mp4', size: 6 * 1024 * 1024 }, other);
  assert.equal(over.status, 413);
  assert.equal(over.json.error, 'ACCOUNT_STORAGE_FULL');
});

it('large upload needs a signed-in account', async () => {
  assert.equal((await app.request('POST', '/cdn/upload/start', { body: { name: 'x.mp4', size: 10 }, headers: { origin: app.origin } })).status, 401);
  assert.equal((await app.request('GET', '/cdn/upload/config', {})).status, 401);
});
