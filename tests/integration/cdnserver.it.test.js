'use strict';
// CDN uploads from the developer's other servers (e.g. YS-Digital backups): a shared token instead
// of a login, files without an owner that always expire.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const TOKEN = 'server-upload-token-'.padEnd(40, 'x');
let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ CDN_SERVER_TOKEN: TOKEN });
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const up = (rawBody, auth, qs = '?name=ys-db-2026-10-20.sql.gz&ttlHours=48') => app.request('POST', '/cdn/server/upload' + qs, { rawBody, headers: { 'content-type': 'application/gzip', ...(auth ? { authorization: auth } : {}) } });

it('needs the token: none or a wrong one is refused', async () => {
  assert.equal((await up(Buffer.from('x'))).status, 401);
  assert.equal((await up(Buffer.from('x'), 'Bearer wrong')).status, 401);
});

it('with the token the file is stored, served at its /cdn link, and expires', async () => {
  const body = Buffer.from('INSERT INTO t VALUES (1);\n'.repeat(50));
  const r = await up(body, `Bearer ${TOKEN}`);
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.result.url, /\/cdn\/[a-f0-9]{32}\.gz$/);
  assert.equal(r.json.result.name, 'ys-db-2026-10-20.sql.gz');
  assert.equal(r.json.result.size, body.length);
  const hours = (new Date(r.json.result.expiresAt) - Date.now()) / 3600e3;
  assert.ok(hours > 47 && hours <= 48, `expires in about 48 h (got ${hours})`);
  const got = await app.request('GET', '/cdn/' + r.json.result.url.split('/cdn/')[1], {});
  assert.equal(got.status, 200);
  assert.equal(Buffer.from(got.text, 'binary').length, body.length);
  const row = (await h.db().query('SELECT owner_id FROM cdn_files WHERE id=$1', [r.json.result.id])).rows[0];
  assert.equal(row.owner_id, null, 'belongs to no account');
});

it('never permanent: no ttl means 72 hours, and at most 30 days', async () => {
  const a = await up(Buffer.from('a'), `Bearer ${TOKEN}`, '?name=a.txt');
  assert.ok(Math.abs((new Date(a.json.result.expiresAt) - Date.now()) / 3600e3 - 72) < .1);
  const b = await up(Buffer.from('b'), `Bearer ${TOKEN}`, '?name=b.txt&ttlHours=99999');
  assert.ok((new Date(b.json.result.expiresAt) - Date.now()) / 3600e3 <= 24 * 30 + .1);
});

it('large files need R2/B2 storage; without it the server says so', async () => {
  const r = await app.request('POST', '/cdn/server/start', { body: { name: 'big.zip', type: 'application/zip', size: 9e6 }, headers: { authorization: `Bearer ${TOKEN}` } });
  assert.equal(r.status, 503);
  assert.equal(r.json.code || r.json.error, 'LARGE_UPLOAD_UNAVAILABLE');
});
