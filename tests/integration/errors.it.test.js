'use strict';
// Developer Panel "Error" tab (services/errorLogService.js): endpoint errors from real requests and
// automatic checks are logged; a plan / quota / key problem from the upstream hides the endpoint
// everywhere until it works again. theresav is stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const realFetch = global.fetch;
let reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
let app, user, owner, status;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.theresav.eu') { const r = reply(u); return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } }); }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: 'k' });
  user = await app.login('errs@example.test');
  owner = await app.login(h.OWNER_EMAIL);
  status = require('../../services/endpointStatusService');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { status?.reset(); reply = () => ({ status: 200, json: { status: true, result: 'ok' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const call = p => app.request('GET', p, app.asBrowser(user));
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
const inCatalog = async p => Object.values((await app.request('GET', '/api/endpoints')).json.endpoints).flat().some(e => e.cleanPath === p);
const inMonitor = async p => { status.reset(); return (await app.request('GET', '/api/endpoints/status')).json.endpoints.some(e => e.path === p); };
const errorsFor = async p => (await o('GET', '/owner/api/errors')).json.errors.filter(e => e.path === p);

it('an upstream "plan quota" error hides the endpoint everywhere and shows why in the Error tab', async () => {
  const P = '/api/ai/chatgpt';
  assert.ok(await inCatalog(P));
  reply = () => ({ status: 403, json: { status: false, error: "You've reached your plan quota. Your credits will renew with your plan — top up a credit pack to continue now." } });
  const r = await call(`${P}?prompt=hi`);
  assert.ok(r.status >= 500, r.text);

  assert.equal(await inCatalog(P), false, 'gone from API Docs / Playground');
  assert.equal(await inMonitor(P), false, 'gone from the status monitor');
  const again = await call(`${P}?prompt=hi`);
  assert.deepEqual([again.status, again.json.error], [404, 'ENDPOINT_UNAVAILABLE']);

  const errs = await errorsFor(P);
  assert.equal(errs.length, 1);
  assert.match(errs[0].message, /plan quota/);
  assert.deepEqual([errs[0].source, errs[0].hidden, errs[0].auto_disabled, errs[0].endpoint_status], ['live', true, true, 'disabled']);
  const list = await o('GET', '/owner/api/errors');
  assert.ok(list.json.open >= 1 && list.json.hidden >= 1);
  const row = (await o('GET', '/owner/api/endpoints')).json.endpoints.find(e => e.path === P);
  assert.equal(row.auto_disabled, true);
  assert.match(row.disabled_reason, /plan quota/);
  assert.equal((await app.request('GET', '/owner/api/errors', { cookie: user })).status, 403);
});

it('the hidden endpoint keeps being checked and comes back by itself once it works', async () => {
  const P = '/api/ai/chatgpt';
  reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
  for (let i = 0; i < 30; i++) {
    const r = await app.request('POST', '/api/endpoints/autocheck', { headers: { 'x-yannz-client': 'web' } });
    if (!r.json.checked.length || r.json.checked.some(x => x.path === P)) break;
  }
  assert.equal(await inCatalog(P), true, 'shown again');
  assert.equal((await call(`${P}?prompt=hi`)).status, 200);
  const errs = await errorsFor(P);
  assert.ok(errs[0].resolved_at, 'marked as fixed');
  assert.equal(errs[0].auto_disabled, false);
});

it('a passing hiccup (server error without plan words) is logged but the endpoint stays visible', async () => {
  const P = '/api/ai/gemini';
  reply = () => ({ status: 500, json: { status: false, error: 'Internal error, try again' } });
  assert.ok((await call(`${P}?prompt=hi`)).status >= 500);
  assert.equal(await inCatalog(P), true);
  const errs = await errorsFor(P);
  assert.equal(errs.length, 1);
  assert.equal(errs[0].hidden, false);
  // The same error again is counted on the same row.
  await call(`${P}?prompt=hi`);
  assert.equal((await errorsFor(P))[0].count, 2);
});

it('failed automatic checks are logged too; a missing server key hides the endpoint', async () => {
  const svc = require('../../services/errorLogService');
  assert.equal(svc.isPlanError({ code: 'UPSTREAM_NOT_CONFIGURED' }), true);
  assert.equal(svc.isPlanError({ upstreamStatus: 401, message: 'x' }), true);
  assert.equal(svc.isPlanError({ status: 502, message: 'API Error (403): {"error":"plan"}' }), true);
  assert.equal(svc.isPlanError({ status: 504, message: 'timeout' }), false);
  reply = u => (u.pathname === '/api/ai/claude' ? { status: 402, json: { status: false, message: 'Payment Required: insufficient balance' } } : { status: 200, json: { status: true, result: 'ok' } });
  await h.db().query("UPDATE endpoint_checks SET checked_at = now() - interval '7 hours'");
  for (let i = 0; i < 30; i++) { const r = await app.request('POST', '/api/endpoints/autocheck', { headers: { 'x-yannz-client': 'web' } }); if (!r.json.checked.length) break; }
  const errs = await errorsFor('/api/ai/claude');
  assert.equal(errs[0]?.source, 'check', JSON.stringify(errs));
  assert.equal(await inCatalog('/api/ai/claude'), false);
});

it('the developer can show an endpoint again, delete an error and clear the fixed ones', async () => {
  const P = '/api/ai/claude';
  assert.equal((await app.request('POST', '/owner/api/errors/show', { cookie: user, headers: { origin: app.origin }, body: { path: P } })).status, 403);
  assert.equal((await o('POST', '/owner/api/errors/show', { path: P })).status, 200);
  assert.equal(await inCatalog(P), true);
  const id = (await errorsFor('/api/ai/gemini'))[0].id;
  assert.equal((await o('DELETE', `/owner/api/errors/${id}`)).status, 200);
  assert.equal((await errorsFor('/api/ai/gemini')).length, 0);
  const cleared = await o('POST', '/owner/api/errors/clear-resolved');
  assert.ok(cleared.json.removed >= 1);
  assert.ok((await o('GET', '/owner/api/errors')).json.errors.every(e => !e.resolved_at));
});
