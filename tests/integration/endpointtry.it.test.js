'use strict';
// Developer panel → Endpoints → "Tes": the developer runs an endpoint from the panel, signed in and
// without an API key, and sees what it answers (JSON, a picture, a video…). It works while the
// endpoint is disabled or hidden; for everyone else those stay closed. Upstreams are stubbed.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');
let app, owner, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.nexray.eu.cc') return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ NEXRAY: 'on' });
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('endpointtry@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const rows = async () => (await app.request('GET', '/owner/api/endpoints', { cookie: owner })).json.endpoints;
const info = (id, cookie = owner) => app.request('GET', `/owner/api/endpoints/${id}/test-info`, { cookie });
const devCall = (p, cookie = owner) => app.request('GET', p, app.asBrowser(cookie, { 'x-yannz-test': '1' }));

it('test-info gives the address, the parameters and a sample input', async () => {
  const naruto = (await rows()).find(r => r.path === '/api/textpro/naruto');
  const r = await info(naruto.id);
  assert.equal(r.status, 200, r.text);
  const e = r.json.endpoint;
  assert.equal(e.call_path, '/api/textpro/naruto');
  assert.ok(e.params.some(p => p.name === 'text' && p.required), JSON.stringify(e.params));
  assert.ok(e.sample.text, 'a sample value to start from');
  assert.equal((await info(naruto.id, user)).status, 403, 'developer only');
});

it('the developer runs an endpoint without an API key; a picture comes back as a picture', async () => {
  const r = await devCall('/api/textpro/naruto?text=yannz');
  assert.equal(r.status, 200, r.text);
  assert.match(r.headers['content-type'], /^image\/png/);
  const ping = await devCall('/api/tools/ping');
  assert.equal(ping.status, 200);
  assert.match(ping.headers['content-type'], /json/);
});

it('a disabled endpoint can still be tested by the developer, nobody else', async () => {
  const ping = (await rows()).find(r => r.path === '/api/tools/ping');
  const off = await app.request('PATCH', `/owner/api/endpoints/${ping.id}`, { cookie: owner, headers: { origin: app.origin }, body: { status: 'disabled' } });
  assert.equal(off.status, 200, off.text);
  assert.equal((await devCall('/api/tools/ping')).status, 200, 'the panel\'s test');
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(owner))).status, 404, 'without the test header it is disabled as usual');
  assert.equal((await devCall('/api/tools/ping', user)).status, 404, 'the header does nothing for other accounts');
  assert.equal((await info(ping.id)).json.endpoint.status, 'disabled');
  await app.request('PATCH', `/owner/api/endpoints/${ping.id}`, { cookie: owner, headers: { origin: app.origin }, body: { status: 'active' } });
});

it('a changed path is tested at its new address', async () => {
  const ping = (await rows()).find(r => r.path === '/api/tools/ping');
  const r = await app.request('PUT', `/owner/api/endpoints/${ping.id}/edit`, { cookie: owner, headers: { origin: app.origin }, body: { path: '/api/server/ping' } });
  assert.equal(r.status, 200, r.text);
  assert.equal((await info(ping.id)).json.endpoint.call_path, '/api/server/ping');
  assert.equal((await devCall('/api/server/ping')).status, 200);
  await app.request('PUT', `/owner/api/endpoints/${ping.id}/edit`, { cookie: owner, headers: { origin: app.origin }, body: { path: '' } });
});

it('sample inputs and placeholders never name an upstream server', () => {
  const apiproxy = require('../../lib/apiproxy');
  const brands = /elrayy|nexray|botcahx|dongtube|theresav/i;
  const bad = apiproxy.registry().filter(e => brands.test(JSON.stringify(e.sample || {}))).map(e => e.path);
  for (const [p, params] of app.app.locals.pluginParams) if (brands.test(JSON.stringify(params))) bad.push(p);
  assert.deepEqual(bad, []);
});
