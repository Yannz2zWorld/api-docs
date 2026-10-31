'use strict';
// CDN uploads from WhatsApp bots: a shared token (CDN_BOT_TOKEN) instead of a login,
// files without an owner that never expire.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const TOKEN = 'bot-upload-token-'.padEnd(48, 'x');
let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ CDN_BOT_TOKEN: TOKEN });
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const up = (rawBody, auth, qs = '?name=menu.jpg&bot=6281234567890') => app.request('POST', '/cdn/bot/upload' + qs, { rawBody, headers: { 'content-type': 'image/jpeg', ...(auth ? { authorization: auth } : {}) } });

it('needs the bot token: none or a wrong one is refused', async () => {
  assert.equal((await up(Buffer.from('x'))).status, 401);
  assert.equal((await up(Buffer.from('x'), 'Bearer wrong')).status, 401);
});

it('with the token the file is stored permanently and served at its /cdn link', async () => {
  const body = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(2000, 7)]);
  const r = await up(body, `Bearer ${TOKEN}`);
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.result.url, /\/cdn\/[a-f0-9]{32}\.jpg$/);
  assert.equal(r.json.result.size, body.length);
  assert.ok(!r.json.result.expiresAt, 'never expires');
  const got = await app.request('GET', '/cdn/' + r.json.result.url.split('/cdn/')[1], {});
  assert.equal(got.status, 200);
  const row = (await h.db().query('SELECT owner_id FROM cdn_files WHERE id=$1', [r.json.result.id])).rows[0];
  assert.equal(row.owner_id, null, 'belongs to no account');
});

it('an empty body is refused', async () => {
  assert.equal((await up(Buffer.alloc(0), `Bearer ${TOKEN}`)).status, 400);
});
