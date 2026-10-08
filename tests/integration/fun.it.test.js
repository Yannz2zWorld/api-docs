'use strict';
// Fake Call (gambar dibuat di server) dan NGL Send (satu pesan per request, ngl.link di-stub).
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let ngl = [];
let nglReply = () => ({ status: 200, json: { questionId: 'q1', userRegion: 'ID' } });

let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://ngl.link/api/submit') {
      ngl.push({ body: new URLSearchParams(String(opts.body)), headers: opts.headers || {} });
      const r = nglReply();
      return new Response(JSON.stringify(r.json || {}), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('fun@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { ngl = []; nglReply = () => ({ status: 200, json: { questionId: 'q1', userRegion: 'ID' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = (path) => app.request('GET', path, app.asBrowser(user));
const web = { origin: () => app.origin };

it('fake call: draws a JPEG with or without an uploaded photo; name is required; bad photo is refused', async () => {
  const plain = await get('/api/maker/fakecall?name=Budi&time=12.00');
  assert.equal(plain.status, 200, plain.text);
  assert.match(plain.headers['content-type'], /^image\/jpeg/);

  const { createCanvas } = require('@napi-rs/canvas');
  const photo = createCanvas(64, 64).toBuffer('image/png');
  const up = await app.request('POST', '/api/maker/fakecall?name=Ayang', { cookie: user, rawBody: photo, headers: { 'content-type': 'image/png', origin: web.origin(), 'x-yannz-client': 'web' } });
  assert.equal(up.status, 200, up.text);
  assert.match(up.headers['content-type'], /^image\/jpeg/);

  assert.equal((await get('/api/maker/fakecall')).json.error, 'PARAM_REQUIRED');
  const bad = await app.request('POST', '/api/maker/fakecall?name=x', { cookie: user, rawBody: Buffer.from('bukan gambar'), headers: { 'content-type': 'image/png', origin: web.origin(), 'x-yannz-client': 'web' } });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'NOT_IMAGE');
});

it('NGL: starts at the SULTAN tier; FREE users are refused before anything is sent', async () => {
  const r = await get('/api/tools/ngl?username=someone&message=halo');
  assert.equal(r.status, 403);
  assert.equal(r.json.error, 'TIER_RESTRICTED');
  assert.equal(ngl.length, 0);
});

it('NGL: sends exactly one message per request, accepts a ngl.link URL, then enforces a short cooldown', async () => {
  await h.setTier('fun@example.test', 'SULTAN');
  const r = await get('/api/tools/ngl?username=' + encodeURIComponent('https://ngl.link/teman_ku') + '&message=' + encodeURIComponent('semangat ya!'));
  assert.equal(r.status, 200, r.text);
  assert.deepEqual([r.json.status, r.json.result.sent, r.json.result.username], [true, true, 'teman_ku']);
  assert.equal(ngl.length, 1);
  assert.equal(ngl[0].body.get('username'), 'teman_ku');
  assert.equal(ngl[0].body.get('question'), 'semangat ya!');

  const again = await get('/api/tools/ngl?username=teman_ku&message=lagi');
  assert.equal(again.status, 429);
  assert.equal(again.json.error, 'COOLDOWN');
  assert.equal(ngl.length, 1, 'nothing more is sent during the cooldown');
});

it('NGL: validation and upstream errors (unknown user) are refused without sending twice', async () => {
  await h.setTier('fun@example.test', 'SULTAN');
  const other = await app.login('fun2@example.test');
  await h.setTier('fun2@example.test', 'SULTAN');
  const as2 = (p) => app.request('GET', p, app.asBrowser(other));
  assert.equal((await as2('/api/tools/ngl?username=bad%20name&message=hi')).json.error, 'INVALID_PARAMETER');
  assert.equal((await as2('/api/tools/ngl?username=ok')).json.error, 'PARAM_REQUIRED');
  assert.equal((await as2('/api/tools/ngl?username=ok&message=' + 'a'.repeat(301))).json.error, 'INVALID_PARAMETER');
  assert.equal(ngl.length, 0);
  nglReply = () => ({ status: 404 });
  const missing = await as2('/api/tools/ngl?username=tidakada&message=hi');
  assert.equal(missing.status, 400);
  assert.equal(missing.json.error, 'USER_NOT_FOUND');
});
