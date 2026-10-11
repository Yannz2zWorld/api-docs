'use strict';
// cdn-server.js (CDN on a VPS): the same /cdn/<id> links, whole files in one answer (no Vercel
// limit), ranges as asked; CDN_PUBLIC_URL makes new links point at it. The bucket is stubbed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const R2_HOST = 'acct123.r2.cloudflarestorage.com', PUBLIC = 'https://pub-test.r2.dev';
const realFetch = global.fetch;
const objects = new Map();
let app, user, vps, vpsUrl;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const req = typeof input === 'string' || input instanceof URL ? new Request(String(input), init) : input;
    const u = new URL(req.url);
    if (u.origin === PUBLIC) {
      const o = objects.get(decodeURIComponent(u.pathname.slice(1)));
      if (!o) return new Response(null, { status: 404 });
      const m = /^bytes=(\d+)-(\d*)$/.exec(req.headers.get('range') || '');
      if (!m) return new Response(o.body, { headers: { 'content-type': o.type, 'content-length': String(o.body.length) } });
      const s = Number(m[1]), e = m[2] ? Math.min(Number(m[2]), o.body.length - 1) : o.body.length - 1;
      return new Response(o.body.subarray(s, e + 1), { status: 206, headers: { 'content-type': o.type, 'content-length': String(e - s + 1), 'content-range': `bytes ${s}-${e}/${o.body.length}` } });
    }
    if (u.hostname !== R2_HOST) return realFetch(input, init);
    const key = decodeURIComponent(u.pathname.split('/').pop());
    if (req.method === 'PUT') { objects.set(key, { body: Buffer.from(await req.arrayBuffer()), type: req.headers.get('content-type') }); return new Response(null, { status: 200 }); }
    if (req.method === 'HEAD') { const o = objects.get(key); return o ? new Response(null, { status: 200, headers: { 'content-length': String(o.body.length), 'content-type': o.type } }) : new Response(null, { status: 404 }); }
    return new Response(null, { status: 405 });
  };
  const dns = require('dns').promises, realLookup = dns.lookup;
  dns.lookup = async (host, o) => (host === 'pub-test.r2.dev' ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, o));
  await h.setupDatabase();
  app = await h.startApp({ R2_ACCOUNT_ID: 'acct123', R2_ACCESS_KEY_ID: 'AKIDTEST', R2_SECRET_ACCESS_KEY: 'secret-not-real', R2_BUCKET: 'yannz-cdn', R2_PUBLIC_URL: PUBLIC, CDN_PUBLIC_URL: 'https://cdn.apiz2z.test/' });
  user = await app.login('vps@example.test');
  vps = await new Promise(r => { const s = require('../../cdn-server').listen(0, '127.0.0.1', () => r(s)); });
  vpsUrl = `http://127.0.0.1:${vps.address().port}`;
});
after(async () => { global.fetch = realFetch; delete process.env.CDN_PUBLIC_URL; if (h.skip) return; vps?.close(); await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (path, body) => app.request('POST', path, { cookie: user, body, headers: { origin: app.origin } });

it('a big file: new link on CDN_PUBLIC_URL; the VPS sends it whole, and ranges as asked', async () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024, 5);
  const start = await post('/cdn/upload/start', { name: 'film.mp4', type: 'video/mp4', size: bytes.length });
  await global.fetch(start.json.upload.url, { method: 'PUT', body: bytes, headers: start.json.upload.headers });
  const done = await post('/cdn/upload/finish', { id: start.json.id });
  assert.equal(done.status, 200, done.text);
  assert.equal(done.json.result.url, `https://cdn.apiz2z.test/cdn/${start.json.id}`);

  const whole = await realFetch(`${vpsUrl}/cdn/${start.json.id}`, { redirect: 'manual' });
  assert.equal(whole.status, 200);
  assert.equal(whole.headers.get('content-type'), 'video/mp4');
  assert.equal((await whole.arrayBuffer()).byteLength, bytes.length, 'the whole 9 MB in one answer');
  const part = await realFetch(`${vpsUrl}/cdn/${start.json.id}`, { headers: { range: 'bytes=0-' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('content-range'), `bytes 0-${bytes.length - 1}/${bytes.length}`, 'not cut into 4 MB pieces');
  await part.arrayBuffer();
  // the old address on the website keeps working (pieces there)
  assert.equal((await app.request('GET', '/cdn/' + start.json.id, { headers: { range: 'bytes=0-' } })).status, 206);
});

it('a small file kept in the database is served by the VPS too; unknown ids are 404', async () => {
  const small = await app.request('POST', '/cdn/upload?name=a.png', { cookie: user, headers: { origin: app.origin, 'content-type': 'image/png' }, rawBody: Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c40000000049454e44ae426082', 'hex') });
  assert.equal(small.status, 200, small.text);
  const id = small.json.result.id;
  const r = await realFetch(`${vpsUrl}/cdn/${id}`);
  assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/png');
  assert.equal((await realFetch(`${vpsUrl}/cdn/${'0'.repeat(32)}.png`)).status, 404);
  assert.equal((await realFetch(`${vpsUrl}/`)).status, 200);
});
