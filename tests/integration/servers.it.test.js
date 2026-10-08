'use strict';
// Endpoint server pihak ketiga (plugin/servers.js + lib/apiproxy.js). Upstream tidak pernah
// dihubungi: global fetch di-stub untuk host clutch & termai. Menguji katalog, penerusan key,
// dan alur unggah foto -> CDN -> URL dikirim ke upstream.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.from('0000000d49484452', 'hex')]);
const realFetch = global.fetch;
let calls = [];
let reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } });

let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.clutch.web.id/') || u.startsWith('https://api.termai.cc/')) {
      const call = { url: new URL(u), method: opts.method || 'GET', headers: opts.headers || {} };
      calls.push(call);
      const r = reply(call);
      if (r.bytes) return new Response(r.bytes, { status: r.status, headers: { 'content-type': r.type } });
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ CLUTCH_API_KEY: 'ckey', TERMAI_API_KEY: 'tkey', PUBLIC_BASE_URL: 'https://cdn.test.local' });
  user = await app.login('srv@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = (path) => app.request('GET', path, app.asBrowser(user));

it('catalog lists the clutch + termai endpoints across categories', async () => {
  const cat = (await app.request('GET', '/api/endpoints')).json.endpoints;
  assert.ok(cat.AI.some(e => e.cleanPath === '/api/ai/gemini'));
  assert.ok(cat.Downloader.some(e => e.cleanPath === '/api/download/ytmp3'));
  assert.ok(cat.Stalk.some(e => e.cleanPath === '/api/stalk/github'));
  assert.ok(cat.Maker.some(e => e.cleanPath === '/api/maker/bananaai'));
  // the photo endpoint exposes its image parameter as a file (upload button)
  const banana = cat.Maker.find(e => e.cleanPath === '/api/maker/bananaai');
  assert.equal(banana.params.find(p => p.name === 'url').type, 'file');
});

it('clutch: apikey goes in the query, params forwarded, our creator replaces theirs', async () => {
  reply = () => ({ status: 200, json: { status: true, creator: 'Clutch', result: 'jawaban' } });
  const r = await get('/api/ai/hyperai?prompt=halo');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].url.hostname, 'api.clutch.web.id');
  assert.equal(calls[0].url.pathname, '/ai/hyperai');
  assert.equal(calls[0].url.searchParams.get('prompt'), 'halo');
  assert.equal(calls[0].url.searchParams.get('apikey'), 'ckey');
  assert.equal(r.json.result, 'jawaban');
  assert.notEqual(r.json.creator, 'Clutch');
  assert.ok(!r.text.includes('ckey'));
});

it('termai: key goes in the `key` param on the api.termai.cc host', async () => {
  const r = await get('/api/ai/bard?query=hi');
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].url.hostname, 'api.termai.cc');
  assert.equal(calls[0].url.pathname, '/api/chat/bard');
  assert.equal(calls[0].url.searchParams.get('query'), 'hi');
  assert.equal(calls[0].url.searchParams.get('key'), 'tkey');
  assert.equal(calls[0].url.searchParams.get('apikey'), null);
});

it('photo endpoint: an uploaded image is stored in our CDN and its URL is sent to upstream', async () => {
  const r = await app.request('POST', '/api/maker/remini', { cookie: user, rawBody: PNG, headers: { 'content-type': 'image/png', origin: app.origin, 'x-yannz-client': 'web' } });
  assert.equal(r.status, 200, r.text);
  const sentUrl = calls[0].url.searchParams.get('url');
  assert.ok(sentUrl && sentUrl.startsWith('https://cdn.test.local/cdn/'), 'upstream url points at our CDN: ' + sentUrl);
  // and that CDN URL actually serves the bytes, no auth
  const id = sentUrl.split('/cdn/')[1];
  const got = await app.request('GET', '/cdn/' + id, {});
  assert.equal(got.status, 200);
  assert.equal(got.headers['content-type'], 'image/png');
});

it('photo endpoint also accepts an https url directly (for API users)', async () => {
  const r = await get('/api/maker/remini?url=' + encodeURIComponent('https://img.example.test/a.png'));
  assert.equal(r.status, 200, r.text);
  assert.equal(calls[0].url.searchParams.get('url'), 'https://img.example.test/a.png');
});

it('photo endpoint without a file or url is rejected before calling upstream', async () => {
  const r = await get('/api/maker/remini');
  assert.equal(r.status, 400);
  assert.equal(calls.length, 0);
});

it('photo endpoint still takes images only (the CDN accepting any file does not change that)', async () => {
  const r = await app.request('POST', '/api/maker/remini', { cookie: user, rawBody: Buffer.from('%PDF-1.4 bukan foto'), headers: { 'content-type': 'application/pdf', origin: app.origin, 'x-yannz-client': 'web' } });
  assert.equal(r.status, 400);
  assert.equal(r.json.error, 'NOT_IMAGE');
  assert.equal(calls.length, 0);
});
