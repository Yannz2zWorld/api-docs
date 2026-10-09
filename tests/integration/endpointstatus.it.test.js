'use strict';
// ~/endpoints monitor: GET /api/endpoints/status shows the latest real HTTP status per endpoint,
// from real calls (activity_log) and endpoint checks (self-test, daily cron). theresav is stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
// Loaded after startApp(): lib/db must pick up the test database shim.
let status;

const realFetch = global.fetch;
let reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
let app, user, owner;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = String(url);
    if (u.startsWith('https://api.theresav.eu/')) {
      const r = reply(new URL(u));
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(url, opts);
  };
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: 'k', CRON_SECRET: 'cron-xyz' });
  user = await app.login('status@example.test');
  owner = await app.login(h.OWNER_EMAIL);
  status = require('../../services/endpointStatusService');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { status?.reset(); reply = () => ({ status: 200, json: { status: true, result: 'ok' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = async () => { status.reset(); const r = await app.request('GET', '/api/endpoints/status'); assert.equal(r.status, 200, r.text); return r.json; };
const find = (d, p) => d.endpoints.find(e => e.path === p);

it('is public and lists every endpoint; nothing known yet = IDLE (no made-up 200s)', async () => {
  const d = await get();
  const total = (await h.db().query('SELECT count(*)::int AS n FROM endpoints')).rows[0].n;
  assert.equal(d.endpoints.length, total);
  assert.equal(d.summary.total, total);
  const ping = find(d, '/api/tools/ping');
  assert.deepEqual([ping.state, ping.code, ping.text, ping.method], ['idle', null, 'IDLE', 'GET']);
});

it('real calls show their status code and time; the caller\'s own mistakes (400/401/403) are skipped', async () => {
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(user))).status, 200);
  let ping = find(await get(), '/api/tools/ping');
  assert.deepEqual([ping.state, ping.code, ping.text, ping.source], ['ok', 200, '200 OK', 'live']);
  assert.equal(typeof ping.ms, 'number');
  // A request without the required parameter (400) does not turn the endpoint red.
  assert.equal((await app.request('GET', '/api/ai/chatgpt', app.asBrowser(user))).status, 400);
  const chat = find(await get(), '/api/ai/chatgpt');
  assert.equal(chat.state, 'idle');
  // An upstream failure does.
  reply = () => ({ status: 500, json: { status: false, error: 'boom' } });
  const r = await app.request('GET', '/api/ai/chatgpt?prompt=hi', app.asBrowser(user));
  assert.ok(r.status >= 500, r.text);
  const chat2 = find(await get(), '/api/ai/chatgpt');
  assert.deepEqual([chat2.state, chat2.code, chat2.source], ['down', r.status, 'live']);
});

it('the developer self-test is stored: OK and failures (status:false → 502) show up', async () => {
  reply = u => (u.pathname === '/api/ai/claude' ? { status: 200, json: { status: false, error: 'quota habis' } } : { status: 200, json: { status: true, result: 'ok' } });
  const r = await app.request('POST', '/owner/api/selftest', { cookie: owner, headers: { origin: app.origin }, body: {} });
  assert.equal(r.status, 200, r.text);
  const d = await get();
  const claude = find(d, '/api/ai/claude');
  assert.deepEqual([claude.state, claude.code, claude.text, claude.source], ['down', 502, '502 Bad Gateway', 'check']);
  const gemini = find(d, '/api/ai/gemini');
  assert.deepEqual([gemini.state, gemini.code, gemini.source], ['ok', 200, 'check']);
  assert.ok(d.summary.ok > 10);
  // Endpoints that need a real link/photo were not checked and stay IDLE.
  assert.equal(find(d, '/api/image/lumiart').state, 'idle');
});

it('disabled endpoints show OFF', async () => {
  await h.db().query("UPDATE endpoints SET status='disabled' WHERE path='/api/tools/ping'");
  try { assert.deepEqual([find(await get(), '/api/tools/ping').state, find(await get(), '/api/tools/ping').text], ['off', 'OFF']); }
  finally { await h.db().query("UPDATE endpoints SET status='active' WHERE path='/api/tools/ping'"); }
});

it('the daily automatic check needs CRON_SECRET and stores results', async () => {
  assert.equal((await app.request('GET', '/cron/endpoint-check')).status, 401);
  await h.db().query('DELETE FROM endpoint_checks');
  reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
  const r = await app.request('GET', '/cron/endpoint-check', { headers: { authorization: 'Bearer cron-xyz' } });
  assert.equal(r.status, 200, r.text);
  assert.ok(r.json.summary.ok > 10);
  const n = (await h.db().query('SELECT count(*)::int AS n FROM endpoint_checks WHERE ok')).rows[0].n;
  assert.equal(n, r.json.summary.ok);
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  assert.ok(v.crons.some(c => c.path === '/cron/endpoint-check'));
});

it('the dashboard loads the monitor and API Docs has cURL / Node.js / Python / PHP examples', async () => {
  const js = await app.request('GET', '/assets/endpoint-monitor.js');
  assert.equal(js.status, 200);
  assert.match(js.text, /\/api\/endpoints\/status/);
  const home = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'index.html'), 'utf8');
  assert.match(home, /id="ep-monitor"/);
  const docs = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'api.html'), 'utf8');
  for (const lang of ['curl', 'node', 'python', 'php']) assert.match(docs, new RegExp(`data-lang="${lang}"`));
});
