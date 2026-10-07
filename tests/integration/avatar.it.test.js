'use strict';
// Profile pictures: upload (validated by signature, size-capped), serve, delete, chat avatars.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const h = require('./helpers');

let app, ana, bob;
// 1×1 PNG and a minimal JPEG header + body (signature is what matters for the check).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  ana = await app.login('avatar-ana@example.test');
  bob = await app.login('avatar-bob@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const as = (cookie, method, url, body) => app.request(method, url, { cookie, headers: { origin: app.origin }, body });
// Raw GET that keeps the body as bytes.
const getBytes = (url, cookie) => new Promise((resolve, reject) => {
  http.get(app.origin + url, { headers: cookie ? { cookie } : {} }, res => {
    const chunks = []; res.on('data', c => chunks.push(c));
    res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
  }).on('error', reject);
});

it('upload, then the picture is on the profile and served to signed-in users as the same bytes', async () => {
  assert.equal((await as(ana, 'GET', '/api/profile')).json.profile.avatarUrl, null);
  const up = await as(ana, 'PUT', '/api/profile/avatar', { image: PNG });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  assert.match(up.json.avatarUrl, /^\/api\/avatar\/[0-9a-f-]{36}\?v=\d+$/);
  assert.equal((await as(ana, 'GET', '/api/profile')).json.profile.avatarUrl, up.json.avatarUrl);
  const img = await getBytes(up.json.avatarUrl, bob);
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.equal(img.headers['x-content-type-options'], 'nosniff');
  assert.deepEqual(img.body, Buffer.from(PNG.split(',')[1], 'base64'));
  assert.equal((await getBytes(up.json.avatarUrl)).status, 401, 'signed-in users only');
});

it('rejects non-images, spoofed types and oversized files; cross-site uploads are refused', async () => {
  for (const [image, error] of [
    ['data:text/html;base64,PGgxPmhpPC9oMT4=', 'INVALID_IMAGE'],
    ['data:image/png;base64,' + Buffer.from('<svg onload=alert(1)>').toString('base64'), 'INVALID_IMAGE'],
    ['not a data url', 'INVALID_IMAGE'],
    ['data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(530 * 1024)]).toString('base64'), 'IMAGE_TOO_LARGE']
  ]) assert.equal((await as(bob, 'PUT', '/api/profile/avatar', { image })).json.error, error);
  const csrf = await app.request('PUT', '/api/profile/avatar', { cookie: bob, headers: { origin: 'https://evil.example' }, body: { image: PNG } });
  assert.equal(csrf.status, 403);
});

it('the chat shows the sender\'s picture; deleting it falls back to the initial', async () => {
  const sent = await as(ana, 'POST', '/api/chat', { body: 'pakai foto baru' });
  assert.match(sent.json.message.avatar, /^\/api\/avatar\//);
  const feed = await as(bob, 'GET', '/api/chat');
  assert.match(feed.json.messages.find(m => m.id === sent.json.message.id).avatar, /^\/api\/avatar\//);

  const del = await as(ana, 'DELETE', '/api/profile/avatar');
  assert.deepEqual([del.status, del.json.deleted], [200, true]);
  assert.equal((await as(ana, 'GET', '/api/profile')).json.profile.avatarUrl, null);
  const ana_id = (await h.userByEmail('avatar-ana@example.test')).id;
  assert.equal((await getBytes(`/api/avatar/${ana_id}`, bob)).status, 404);
  assert.equal((await as(bob, 'GET', '/api/chat')).json.messages.find(m => m.id === sent.json.message.id).avatar, null);
  assert.equal((await as(ana, 'DELETE', '/api/profile/avatar')).json.deleted, false, 'deleting twice is harmless');
});

it('without migration 010 the profile and chat keep working; upload says MIGRATION_REQUIRED', async () => {
  await h.db().query('DROP TABLE user_avatars');
  assert.equal((await as(ana, 'GET', '/api/profile')).json.profile.avatarUrl, null);
  assert.equal((await as(ana, 'GET', '/api/chat')).status, 200);
  assert.equal((await as(ana, 'PUT', '/api/profile/avatar', { image: PNG })).json.error, 'MIGRATION_REQUIRED');
  assert.equal((await as(ana, 'DELETE', '/api/profile/avatar')).status, 200);
});
