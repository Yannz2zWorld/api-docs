'use strict';
// Developer panel → Endpoints → "Edit" (services/endpointEditService.js): name, path, description and
// category as the site shows them. A new path only changes the address; the old one says where it went.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({});
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('edits@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const rows = async () => (await app.request('GET', '/owner/api/endpoints', { cookie: owner })).json.endpoints;
const edit = (id, body, cookie = owner) => app.request('PUT', `/owner/api/endpoints/${id}/edit`, { cookie, headers: { origin: app.origin }, body });
const catalog = async () => (await app.request('GET', '/api/endpoints')).json.endpoints;
const call = p => app.request('GET', p, app.asBrowser(user));

it('name, path, description and category change what the site shows; the new path works, the old one says where it went', async () => {
  const ping = (await rows()).find(r => r.path === '/api/tools/ping');
  assert.equal((await call('/api/tools/ping')).status, 200);
  const r = await edit(ping.id, { name: 'Cek Server', path: '/api/server/ping', description: 'Cek server hidup atau nggak.', category: 'Server' });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.message, 'Telah disimpan.');
  assert.deepEqual([r.json.endpoint.public_path, r.json.endpoint.shown_name], ['/api/server/ping', 'Cek Server']);

  const cat = await catalog();
  assert.ok(!(cat.Tools || []).some(e => e.cleanPath === '/api/tools/ping'), 'gone from its old place');
  const item = cat.Server.find(e => e.cleanPath === '/api/server/ping');
  assert.deepEqual([item.name, item.desc, item.access.minimum_tier], ['Cek Server', 'Cek server hidup atau nggak.', 'FREE'], 'still the same endpoint (its access rules)');

  assert.equal((await call('/api/server/ping')).status, 200);
  const old = await call('/api/tools/ping');
  assert.deepEqual([old.status, old.json.error, old.json.path], [404, 'ENDPOINT_MOVED', '/api/server/ping']);
  const status = (await app.request('GET', '/api/endpoints/status')).json.endpoints.map(e => e.path);
  assert.ok(status.includes('/api/server/ping') && !status.includes('/api/tools/ping'), 'the monitor shows the new path');
  const row = (await rows()).find(x => x.path === '/api/tools/ping');
  assert.deepEqual([row.public_path, row.shown_name, row.custom_category], ['/api/server/ping', 'Cek Server', 'Server']);
});

it('a path that is taken, malformed, a backup path or one of the site\'s own pages is refused', async () => {
  const ping = (await rows()).find(r => r.path === '/api/tools/ping');
  for (const [path, status, code] of [
    ['/api/tools/translate', 409, 'PATH_TAKEN'],
    ['/api/endpoints', 409, 'PATH_TAKEN'],
    ['/api/alt/tools/x', 400, 'INVALID_PATH'],
    ['/ping', 400, 'INVALID_PATH'],
    ['/api/Bad Path', 400, 'INVALID_PATH']
  ]) {
    const r = await edit(ping.id, { path });
    assert.deepEqual([r.status, r.json.error], [status, code], path);
  }
  assert.equal((await edit(ping.id, { category: '<b>x</b>' })).json.error, 'INVALID_CATEGORY');
  assert.equal((await edit(ping.id, { name: 'x' }, user)).status, 403, 'developer only');
});

it('"Reset ke bawaan" puts everything back to the code\'s own', async () => {
  const ping = (await rows()).find(r => r.path === '/api/tools/ping');
  const r = await edit(ping.id, { name: '', path: '', description: '', category: '' });
  assert.equal(r.status, 200, r.text);
  assert.equal((await call('/api/tools/ping')).status, 200);
  assert.equal((await call('/api/server/ping')).status, 404);
  const cat = await catalog();
  assert.ok(cat.Tools.some(e => e.cleanPath === '/api/tools/ping' && e.name === 'Ping'));
  assert.ok(!cat.Server);
});
