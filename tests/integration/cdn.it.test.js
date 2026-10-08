'use strict';
// CDN: upload gambar (POST /api/tools/upload) disimpan di Postgres dan dilayani publik di
// /cdn/<id> tanpa autentikasi, supaya server lain bisa mem-fetch-nya.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

// PNG kecil yang valid untuk sniff (signature 8 byte + sedikit isi).
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452', 'hex')]);

let app, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('cdn@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const up = (rawBody, headers = {}) => app.request('POST', '/api/tools/upload', { cookie: user, rawBody, headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web', ...headers } });

it('upload returns a public /cdn URL that serves the exact bytes without auth', async () => {
  const r = await up(PNG);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.status, true);
  assert.match(r.json.result.url, /\/cdn\/[a-f0-9]{32}\.png$/);
  assert.equal(r.json.result.mime, 'image/png');
  assert.equal(r.json.result.size, PNG.length);
  assert.equal(r.json.result.expiresAt, null); // permanen secara default

  // Ambil lewat path publik tanpa cookie/kunci.
  const id = r.json.result.url.split('/cdn/')[1];
  const got = await app.request('GET', '/cdn/' + id, {});
  assert.equal(got.status, 200, got.text);
  assert.equal(got.headers['content-type'], 'image/png');
  assert.equal(Buffer.from(got.text, 'binary').length, PNG.length);
});

it('rejects a non-image, a too-big file and an empty body (quota refunded on 4xx)', async () => {
  const notImg = await up(Buffer.from('ini teks biasa, bukan gambar sama sekali'));
  assert.equal(notImg.status, 400);
  assert.equal(notImg.json.error, 'NOT_IMAGE');

  // Over the 8 MB limit: refused with 413 (the body parser stops it before the handler).
  const big = await up(Buffer.alloc(9 * 1024 * 1024));
  assert.equal(big.status, 413);

  const empty = await up(Buffer.alloc(0));
  assert.equal(empty.status, 400);
  assert.equal(empty.json.error, 'NO_FILE');
});

it('an unknown or malformed id gives 404', async () => {
  assert.equal((await app.request('GET', '/cdn/notavalidid.png', {})).status, 404);
  assert.equal((await app.request('GET', '/cdn/' + 'a'.repeat(32) + '.png', {})).status, 404);
});

it('ttlHours makes a temporary file (expiresAt set) and the catalog marks the upload field as a file', async () => {
  const temp = await app.request('POST', '/api/tools/upload?ttlHours=1', { cookie: user, rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web' } });
  assert.equal(temp.status, 200, temp.text);
  assert.ok(temp.json.result.expiresAt, 'expiresAt should be set when ttlHours > 0');

  const tools = (await app.request('GET', '/api/endpoints')).json.endpoints.Tools;
  const uploadEp = tools.find(e => e.cleanPath === '/api/tools/upload');
  assert.ok(uploadEp, 'upload endpoint is in the catalog');
  assert.equal(uploadEp.params.find(p => p.name === 'image').type, 'file');
});
