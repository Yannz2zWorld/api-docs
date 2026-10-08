'use strict';
// Fake Call (port fitur bot; background clutch di-stub karena tidak terjangkau dari lingkungan test).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;

let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    if (String(url) === 'https://cdn-alip.clutch.web.id/api/u/mrg7jq0l.jpg') {
      // stand-in for the bot's background: dark screen with a green circle where the photo goes
      const { createCanvas } = require('@napi-rs/canvas');
      const c = createCanvas(720, 1280); const x = c.getContext('2d');
      x.fillStyle = '#080e11'; x.fillRect(0, 0, 720, 1280);
      x.fillStyle = '#00ff00'; x.beginPath(); x.arc(360, 600, 150, 0, Math.PI * 2); x.fill();
      return new Response(c.toBuffer('image/jpeg'), { status: 200, headers: { 'content-type': 'image/jpeg' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('fun@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = (path) => app.request('GET', path, app.asBrowser(user));
const web = { origin: () => app.origin };

it('fake call (bot port): uploaded photo + name + time -> JPEG; name, time and photo are required; bad photo is refused', async () => {
  const { createCanvas } = require('@napi-rs/canvas');
  const photo = createCanvas(64, 64).toBuffer('image/png');
  const post = (q, body) => app.request('POST', '/api/maker/fakecall?' + q, { cookie: user, rawBody: body, headers: { 'content-type': 'image/png', origin: web.origin(), 'x-yannz-client': 'web' } });
  const up = await post('name=Ayang&time=12.00', photo);
  assert.equal(up.status, 200, up.text);
  assert.match(up.headers['content-type'], /^image\/jpeg/);

  assert.equal((await get('/api/maker/fakecall?name=Budi')).json.error, 'PARAM_REQUIRED');
  assert.equal((await get('/api/maker/fakecall?name=Budi&time=12.00')).json.error, 'PARAM_REQUIRED', 'photo is required like in the bot');
  const bad = await post('name=x&time=1', Buffer.from('bukan gambar'));
  assert.equal(bad.status, 400);
  assert.equal(bad.json.error, 'NOT_IMAGE');
});
