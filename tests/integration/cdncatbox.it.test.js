'use strict';
// Large CDN uploads through catbox.moe when R2 is not set up: the browser uploads to catbox, then
// POST /cdn/upload/register records the link so the shared one is https://<domain>/cdn/<id>.<ext>.
// catbox is never contacted: global fetch is stubbed for files.catbox.moe.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
const files = new Map([['https://files.catbox.moe/abc123.mp4', 150 * 1024 * 1024], ['https://files.catbox.moe/big999.zip', 250 * 1024 * 1024], ['https://files.catbox.moe/doc777.pdf', 5 * 1024 * 1024]]);
let probes = [];

let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
    if (!url.startsWith('https://files.catbox.moe/')) return realFetch(input, init);
    probes.push({ url, range: new Headers(init.headers || {}).get('range') });
    const size = files.get(url);
    if (!size) return new Response('not found', { status: 404 });
    return new Response('x', { status: 206, headers: { 'content-range': `bytes 0-0/${size}`, 'content-length': '1' } });
  };
  // Passed-through files are fetched with the public-host check: these test hosts resolve publicly.
  const dns = require('dns').promises, realLookup = dns.lookup;
  dns.lookup = async (host, o) => (['files.catbox.moe'].includes(host) ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, o));
  await h.setupDatabase();
  app = await h.startApp({ PUBLIC_BASE_URL: 'https://apiz2z.test' });
  user = await app.login('cat@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { probes = []; delete process.env.CDN_ACCOUNT_LIMIT_MB; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const register = (body, cookie = user) => app.request('POST', '/cdn/upload/register', { cookie, body, headers: { origin: app.origin } });

it('a catbox link becomes our own /cdn link, passed through from here; size comes from catbox, not the browser', async () => {
  const r = await register({ url: 'https://files.catbox.moe/abc123.mp4', name: 'Video Liburan.mp4', type: 'video/mp4', size: 1 });
  assert.equal(r.status, 200, r.text);
  assert.match(r.json.result.url, /^https:\/\/apiz2z\.test\/cdn\/[a-f0-9]{32}\.mp4$/);
  assert.deepEqual([r.json.result.name, r.json.result.mime, r.json.result.size], ['Video Liburan.mp4', 'video/mp4', 150 * 1024 * 1024]);
  assert.equal(probes[0].range, 'bytes=0-0', 'only one byte is requested to learn the size');

  const got = await app.request('GET', '/cdn/' + r.json.result.url.split('/cdn/')[1], {});
  assert.ok([200, 206].includes(got.status), got.text);
  assert.equal(got.headers.location, undefined, 'never sent to catbox: the file comes through our domain');
  assert.equal(got.text, 'x');
  assert.equal(probes.at(-1).url, 'https://files.catbox.moe/abc123.mp4');
});

it('only real files.catbox.moe links are accepted; missing or over-200 MB files are refused', async () => {
  for (const url of ['https://evil.example/abc123.mp4', 'http://files.catbox.moe/abc123.mp4', 'https://files.catbox.moe/../x.mp4', 'https://files.catbox.moe.evil.example/abc123.mp4', 'javascript:alert(1)', '']) {
    const r = await register({ url });
    assert.equal(r.status, 400, url);
    assert.equal(r.json.error, 'INVALID_URL', url);
  }
  assert.equal(probes.length, 0, 'invalid links are never fetched');
  assert.equal((await register({ url: 'https://files.catbox.moe/nope00.mp4' })).json.error, 'UPLOAD_MISSING');
  const big = await register({ url: 'https://files.catbox.moe/big999.zip' });
  assert.equal(big.status, 413);
  assert.equal(big.json.error, 'FILE_TOO_LARGE');
});

it('account storage limit and sign-in apply to catbox uploads too', async () => {
  process.env.CDN_ACCOUNT_LIMIT_MB = '100';
  const full = await register({ url: 'https://files.catbox.moe/abc123.mp4' }, await app.login('cat2@example.test'));
  assert.equal(full.status, 413);
  assert.equal(full.json.error, 'ACCOUNT_STORAGE_FULL');
  assert.equal((await app.request('POST', '/cdn/upload/register', { body: { url: 'https://files.catbox.moe/doc777.pdf' }, headers: { origin: app.origin } })).status, 401);
});
