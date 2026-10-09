'use strict';
// Media links in API results open on our own domain (services/mediaProxyService.js + /media).
// Upstreams and media hosts are stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'), Buffer.alloc(64, 1)]);
const realFetch = global.fetch;
let calls = [];
let answer = () => ({ status: true, data: { audio: 'https://api.dongtube.id/media/a1b2.mp3' }, result: [
  { title: 'kucing', url: 'https://i.pinimg.com/736x/aa/bb/cat.jpg' },
  { title: 'Kucing - Wikipedia', url: 'https://id.wikipedia.org/wiki/Kucing' },
  { thumbnail: 'https://p16-sign.tiktokcdn.com/obj/abc?x=1' }
] });
let media = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(PNG.length) } });
let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.dongtube.id' && !u.pathname.startsWith('/media/')) {
      calls.push(u.href);
      return new Response(JSON.stringify(answer()), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    if (['i.pinimg.com', 'api.dongtube.id', 'evil.example', 'p16-sign.tiktokcdn.com'].includes(u.hostname) || u.hostname === '127.0.0.1') { calls.push(u.href); return media(u); }
    return realFetch(url, opts);
  };
  const dns = require('dns').promises;
  const realLookup = dns.lookup;
  dns.lookup = async (host, o) => (['i.pinimg.com', 'api.dongtube.id', 'evil.example', 'p16-sign.tiktokcdn.com'].includes(host) ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, o));
  await h.setupDatabase();
  app = await h.startApp({ PUBLIC_BASE_URL: 'https://apiz2z.web.id' });
  user = await app.login('media@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const local = link => link.replace('https://apiz2z.web.id', '');

it('media links in an answer point at our own /media; page links stay as they are', async () => {
  const r = await app.request('GET', '/api/tools/text2base64?text=x', app.asBrowser(user));
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.data.audio, /^https:\/\/apiz2z\.web\.id\/media\/[\w-]+\.[\w-]+\.mp3$/);
  assert.match(r.json.result[0].url, /^https:\/\/apiz2z\.web\.id\/media\/.+\.jpg$/);
  assert.match(r.json.result[2].thumbnail, /^https:\/\/apiz2z\.web\.id\/media\//, 'a CDN link without extension, by its key');
  assert.equal(r.json.result[1].url, 'https://id.wikipedia.org/wiki/Kucing', 'an article link is not a file');
  assert.ok(!r.text.includes('api.dongtube.id') && !r.text.includes('pinimg.com'), 'no source domain left in the answer');
});

it('opening a /media link serves the file from here, and keeps it: the second open does not touch the source', async () => {
  const r = await app.request('GET', '/api/tools/text2base64?text=x', app.asBrowser(user));
  const link = local(r.json.result[0].url);
  calls = [];
  const first = await app.request('GET', link);
  assert.equal(first.status, 200, first.text);
  assert.equal(first.headers['content-type'], 'image/png');
  assert.equal(first.headers.location, undefined, 'never a redirect to the source');
  assert.match(first.headers['content-security-policy'], /sandbox/);
  assert.deepEqual(calls, ['https://i.pinimg.com/736x/aa/bb/cat.jpg']);
  calls = [];
  const again = await app.request('GET', link);
  assert.equal(again.status, 200);
  assert.deepEqual(calls, [], 'served from our storage');
  const stored = (await h.db().query("SELECT count(*)::int AS n FROM cdn_files WHERE expires_at > now() + interval '6 days'")).rows[0].n;
  assert.ok(stored >= 1, 'kept for 7 days');
});

it('a made-up or edited /media link is refused (not an open proxy)', async () => {
  const svc = require('../../services/mediaProxyService');
  const good = svc.tokenFor('https://i.pinimg.com/736x/aa/bb/cat.jpg');
  const forged = Buffer.from('https://evil.example/x.png').toString('base64url') + '.' + good.split('.')[1];
  const r = await app.request('GET', '/media/' + forged);
  assert.equal(r.status, 404);
  assert.ok(!calls.some(c => c.includes('evil.example')));
});

it('links to private addresses are never fetched, even when signed', async () => {
  const svc = require('../../services/mediaProxyService');
  const r = await app.request('GET', '/media/' + svc.tokenFor('http://127.0.0.1/admin.png'));
  assert.equal(r.status, 502);
  assert.equal(calls.length, 0);
});

it('a source that answers with a web page is downloaded, never rendered on our domain', async () => {
  const svc = require('../../services/mediaProxyService');
  media = () => new Response('<script>alert(1)</script>', { status: 200, headers: { 'content-type': 'text/html' } });
  try {
    const r = await app.request('GET', '/media/' + svc.tokenFor('https://evil.example/page.png'));
    assert.equal(r.status, 200);
    assert.equal(r.headers['content-type'], 'application/octet-stream');
    assert.match(r.headers['content-disposition'], /^attachment/);
  } finally { media = () => new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } }); }
});

it('error answers are left alone', async () => {
  const svc = require('../../services/mediaProxyService');
  const body = { status: false, error: 'X', image: 'https://i.pinimg.com/a.jpg' };
  assert.equal(svc.isMediaLink('image', body.image, body), true);
  answer = () => ({ status: false, error: 'boom' });
  const r = await app.request('GET', '/api/tools/text2base64?text=x', app.asBrowser(user));
  assert.ok(r.status >= 400);
});
