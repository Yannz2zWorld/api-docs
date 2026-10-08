'use strict';
// Proxy generik server pihak ketiga (lib/apiproxy.js). Upstream tidak pernah dihubungi: global
// fetch di-stub. Menguji injeksi key (query & header), penerusan parameter, media, dan error —
// tanpa bergantung pada endpoint nyata di plugin/servers.js.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const apiproxy = require('../../lib/apiproxy');

const realFetch = global.fetch;
let calls = [];
let reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } });

// Server uji yang disuntikkan ke registry config (query-key) dan satu lagi (header-key).
apiproxy.SERVERS.testq = { base: 'https://q.example.test', keyEnv: 'TESTQ_KEY', keyMode: 'query', keyName: 'apikey' };
apiproxy.SERVERS.testh = { base: 'https://h.example.test', keyEnv: 'TESTH_KEY', keyMode: 'header', keyName: 'x-api-key' };

const resMock = () => {
  const r = { statusCode: 200, headers: {}, body: null, sent: false };
  r.status = (c) => (r.statusCode = c, r);
  r.json = (o) => (r.body = o, r.sent = true, r);
  r.set = () => r;
  r.type = () => r;
  r.send = (b) => (r.body = b, r.sent = true, r);
  return r;
};
const run = (ep, query, body) => { const res = resMock(); return ep.run({ query, body, get: () => '' }, res).then(() => res); };

before(() => {
  process.env.TESTQ_KEY = 'secret-q';
  process.env.TESTH_KEY = 'secret-h';
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    const call = { url: u, method: opts.method || 'GET', headers: opts.headers || {} };
    calls.push(call);
    const r = reply(call);
    if (r.bytes) return new Response(r.bytes, { status: r.status, headers: { 'content-type': r.type } });
    return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
  };
});
after(() => { global.fetch = realFetch; delete process.env.TESTQ_KEY; delete process.env.TESTH_KEY; });
beforeEach(() => { calls = []; reply = () => ({ status: 200, json: { status: true, creator: 'Upstream', result: 'ok' } }); });

test('query-mode server: key goes in the query string, params forwarded, our creator replaces theirs', async () => {
  const ep = apiproxy.makeEndpoint({ server: 'testq', name: 'Echo', desc: 'd', category: 'Tools', path: '/api/t/echo', upstream: '/echo', params: [{ name: 'q', required: true }] });
  reply = () => ({ status: 200, json: { status: true, creator: 'Them', result: 'hai' } });
  const res = await run(ep, { q: 'halo' });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].url.pathname, '/echo');
  assert.equal(calls[0].url.searchParams.get('q'), 'halo');
  assert.equal(calls[0].url.searchParams.get('apikey'), 'secret-q');
  assert.equal(res.body.result, 'hai');
  assert.notEqual(res.body.creator, 'Them');
});

test('header-mode server: key goes in the header, never the query string', async () => {
  const ep = apiproxy.makeEndpoint({ server: 'testh', name: 'Echo2', desc: 'd', category: 'Tools', path: '/api/t/echo2', upstream: '/echo', params: [{ name: 'q', required: true }] });
  const res = await run(ep, { q: 'x' });
  assert.equal(res.statusCode, 200);
  assert.equal(calls[0].headers['x-api-key'], 'secret-h');
  assert.equal(calls[0].url.searchParams.get('apikey'), null);
  assert.equal(calls[0].url.searchParams.get('x-api-key'), null);
});

test('missing required param is rejected before any upstream call', async () => {
  const ep = apiproxy.makeEndpoint({ server: 'testq', name: 'E3', desc: 'd', category: 'Tools', path: '/api/t/e3', upstream: '/e', params: [{ name: 'q', required: true }] });
  const res = await run(ep, {});
  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('unconfigured server (no key env) answers 503 and does not call upstream', async () => {
  apiproxy.SERVERS.nokey = { base: 'https://n.example.test', keyEnv: 'DEFINITELY_UNSET_KEY', keyMode: 'query' };
  const ep = apiproxy.makeEndpoint({ server: 'nokey', name: 'E4', desc: 'd', category: 'Tools', path: '/api/t/e4', upstream: '/e', params: [] });
  const res = await run(ep, {});
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error, 'UPSTREAM_NOT_CONFIGURED');
  assert.equal(calls.length, 0);
});

test('upstream failure maps to 502 with quota-not-charged message; the key never appears in the response', async () => {
  const ep = apiproxy.makeEndpoint({ server: 'testq', name: 'E5', desc: 'd', category: 'Tools', path: '/api/t/e5', upstream: '/e', params: [{ name: 'q', required: true }] });
  reply = () => ({ status: 500, json: { status: false, message: 'boom' } });
  const res = await run(ep, { q: 'x' });
  assert.equal(res.statusCode, 502);
  assert.ok(!JSON.stringify(res.body).includes('secret-q'));
});

test('media response is passed through with its content-type', async () => {
  const ep = apiproxy.makeEndpoint({ server: 'testq', name: 'E6', desc: 'd', category: 'Maker', path: '/api/t/e6', upstream: '/img', params: [{ name: 'text', required: true }] });
  reply = () => ({ status: 200, bytes: Buffer.from('PNGDATA'), type: 'image/png' });
  const res = await run(ep, { text: 'hi' });
  assert.equal(res.statusCode, 200);
  assert.ok(Buffer.isBuffer(res.body));
});
