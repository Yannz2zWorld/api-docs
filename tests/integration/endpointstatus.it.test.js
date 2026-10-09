'use strict';
// ~/endpoints monitor: GET /api/endpoints/status gives every endpoint its latest real HTTP code
// (200 = works, otherwise the error code), from automatic checks and real calls. Endpoints are
// checked automatically (POST /api/endpoints/autocheck, daily cron, developer self-test).
// theresav and the third-party servers are stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const realFetch = global.fetch;
let reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
let seen = [];
const PNG = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'assets', 'check-sample.png'));
let app, user, owner, status;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => {
    const u = new URL(String(url));
    if (u.hostname === 'api.theresav.eu' || u.hostname === 'api.clutch.web.id' || u.hostname === 'api.termai.cc') {
      seen.push({ host: u.hostname, path: u.pathname, query: Object.fromEntries(u.searchParams) });
      const r = reply(u);
      if (r.delay) await new Promise(res => setTimeout(res, r.delay));
      return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    if (u.pathname === '/assets/check-sample.png') return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
    // Fake Call's background picture (any real picture will do here).
    if (u.hostname === 'cdn-alip.clutch.web.id') return new Response(PNG, { status: 200, headers: { 'content-type': 'image/png' } });
    return realFetch(url, opts);
  };
  // The TikTok plugin talks to tikwm through axios.
  const axios = require(path.join(__dirname, '..', '..', 'node_modules', 'axios'));
  const realPost = axios.post;
  axios.post = async (url, ...rest) => (String(url).startsWith('https://www.tikwm.com/') ? { data: { code: 0, data: { id: '1', title: 't', play: 'https://x/v.mp4', images: [] } } } : realPost(url, ...rest));
  const dns = require('node:dns');
  const realLookup = dns.promises.lookup;
  dns.promises.lookup = async (host, o) => (host === 'apiz2z.web.id' ? [{ address: '93.184.216.34', family: 4 }] : realLookup(host, o));
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: 'k', CLUTCH_API_KEY: 'c', TERMAI_API_KEY: 't', CRON_SECRET: 'cron-xyz', PUBLIC_BASE_URL: 'https://apiz2z.web.id' });
  user = await app.login('status@example.test');
  owner = await app.login(h.OWNER_EMAIL);
  status = require('../../services/endpointStatusService');   // after startApp: lib/db uses the test shim
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { status?.reset(); seen = []; reply = () => ({ status: 200, json: { status: true, result: 'ok' } }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = async () => { status.reset(); const r = await app.request('GET', '/api/endpoints/status'); assert.equal(r.status, 200, r.text); return r.json; };
const find = (d, p) => d.endpoints.find(e => e.path === p);
const autocheck = () => app.request('POST', '/api/endpoints/autocheck', { headers: { 'x-yannz-client': 'web' } });

it('is public and lists every endpoint; not checked yet = pending (no made-up 200s)', async () => {
  const d = await get();
  const total = (await h.db().query('SELECT count(*)::int AS n FROM endpoints')).rows[0].n;
  assert.equal(d.endpoints.length, total);
  assert.equal(d.summary.total, total);
  const ping = find(d, '/api/tools/ping');
  assert.deepEqual([ping.state, ping.code, ping.method], ['pending', null, 'GET']);
});

it('automatic check: checks a few old ones at a time, never the same twice, until every endpoint has a code', async () => {
  assert.equal((await app.request('POST', '/api/endpoints/autocheck')).status, 403, 'only from the website');
  reply = u => (u.pathname === '/api/ai/claude' ? { status: 200, json: { status: false, error: 'quota habis' } }
    : u.pathname === '/ai/hyperai' ? { status: 503, json: { status: false, message: 'down' } }
    : u.pathname === '/api/download/reddit' ? { status: 400, json: { status: false, message: 'url is required' } }
    : { status: 200, json: { status: true, result: 'ok' } });
  // Two visitors at the same time get different endpoints.
  const [a, b] = await Promise.all([autocheck(), autocheck()]);
  const pa = a.json.checked.map(x => x.path), pb = b.json.checked.map(x => x.path);
  assert.equal(pa.length, 6);
  assert.deepEqual(pa.filter(p => pb.includes(p)), []);
  for (let i = 0; i < 30; i++) { const r = await autocheck(); assert.equal(r.status, 200, r.text); if (!r.json.checked.length) break; }
  const d = await get();
  assert.equal(d.summary.pending, 0, JSON.stringify(d.endpoints.filter(e => e.state === 'pending').map(e => e.path)));
  // Works = 200 green; upstream answered with an error body = 502; upstream down = its code.
  assert.deepEqual([find(d, '/api/ai/gemini').code, find(d, '/api/ai/gemini').state], [200, 'ok']);
  assert.deepEqual([find(d, '/api/ai/claude').code, find(d, '/api/ai/claude').state], [502, 'down']);
  assert.deepEqual([find(d, '/api/ai/hyperai').code, find(d, '/api/ai/hyperai').state], [503, 'down']);
  // Photo endpoints were really run with the sample photo; link downloaders without a sample just
  // had to answer properly ("url is required" counts as up).
  assert.ok(seen.some(s => s.path === '/tools/ocr' && /check-sample\.png$/.test(s.query.url)));
  assert.equal(find(d, '/api/tools/ocr').code, 200);
  assert.equal(find(d, '/api/download/reddit').code, 200);
  // Local plugins too.
  assert.equal(find(d, '/api/tools/ping').code, 200);
  assert.equal(find(d, '/api/maker/fakecall').code, 200);
  assert.equal(find(d, '/api/download/tiktok').code, 200);
  // Nothing is old now, so the next automatic check does nothing.
  assert.deepEqual((await autocheck()).json.checked, []);
});

it('a failed endpoint is checked again after 30 minutes, a working one after 6 hours', async () => {
  await h.db().query("UPDATE endpoint_checks SET checked_at = now() - interval '31 minutes'");
  const r = await autocheck();
  const paths = r.json.checked.map(x => x.path);
  assert.ok(paths.includes('/api/ai/claude') || paths.includes('/api/ai/hyperai'), JSON.stringify(paths));
  for (const p of paths) assert.ok(['/api/ai/claude', '/api/ai/hyperai'].includes(p), `${p} was OK and is not due yet`);
});

it('Refresh (force) really checks everything again, signed-in only, at most every 5 minutes', async () => {
  const force = cookie => app.request('POST', '/api/endpoints/autocheck', { cookie, headers: { 'x-yannz-client': 'web', origin: app.origin }, body: { force: true } });
  assert.equal((await force()).status, 401);
  // Everything was just checked: nothing to do yet.
  await h.db().query('UPDATE endpoint_checks SET checked_at = now()');
  assert.deepEqual((await force(user)).json.checked, []);
  await h.db().query("UPDATE endpoint_checks SET checked_at = now() - interval '6 minutes'");
  seen = [];
  const done = new Set();
  for (let i = 0; i < 30; i++) { const r = await force(user); assert.equal(r.status, 200, r.text); if (!r.json.checked.length) break; r.json.checked.forEach(x => done.add(x.path)); }
  const total = (await get()).summary.total;
  assert.equal(done.size, total, 'every endpoint was checked again');
  assert.ok(seen.length > 50, `the upstreams were really called (${seen.length} calls)`);
});

it('leftover rows of removed plugins (the old CDN upload endpoint) are not endpoints', async () => {
  await h.db().query("INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES('Upload File (CDN)','/api/tools/upload','old','GET','FREE',false,'active','upload') ON CONFLICT (path) DO NOTHING");
  try {
    const d = await get();
    assert.equal(find(d, '/api/tools/upload'), undefined);
    assert.equal(d.summary.total, d.endpoints.length);
  } finally { await h.db().query("DELETE FROM endpoints WHERE path='/api/tools/upload'"); }
  // Migration 018 removes that row from existing databases.
  const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'migrations', '018_remove_cdn_endpoint.sql'), 'utf8');
  assert.match(sql, /DELETE FROM endpoints WHERE path = '\/api\/tools\/upload'/);
});

it('timeouts and unreachable servers get 504 / 503', async () => {
  const svc = require('../../services/endpointCheckService');
  assert.equal(svc.codeOf({ result: 'error', status: 0, timeout: true }), 504);
  assert.equal(svc.codeOf({ result: 'error', status: 0 }), 503);
  assert.equal(svc.codeOf({ result: 'error', status: 429 }), 429);
  assert.equal(svc.codeOf({ result: 'error', status: 200 }), 502);
  assert.equal(svc.codeOf({ result: 'not_configured' }), 503);
  assert.equal(svc.codeOf({ result: 'ok', status: 201 }), 200);
});

it('real calls count too; the caller\'s own mistakes (400/401/403) are skipped', async () => {
  assert.equal((await app.request('GET', '/api/tools/ping', app.asBrowser(user))).status, 200);
  assert.equal(find(await get(), '/api/tools/ping').source, 'live');
  await h.db().query("UPDATE endpoint_checks SET checked_at = now() WHERE path='/api/ai/chatgpt'");
  assert.equal((await app.request('GET', '/api/ai/chatgpt', app.asBrowser(user))).status, 400);
  assert.equal(find(await get(), '/api/ai/chatgpt').source, 'check');
  reply = () => ({ status: 500, json: { status: false, error: 'boom' } });
  const r = await app.request('GET', '/api/ai/chatgpt?prompt=hi', app.asBrowser(user));
  const chat = find(await get(), '/api/ai/chatgpt');
  assert.deepEqual([chat.state, chat.code, chat.source], ['down', r.status, 'live']);
});

it('disabled endpoints show 503 (red)', async () => {
  await h.db().query("UPDATE endpoints SET status='disabled' WHERE path='/api/tools/ping'");
  try { const p = find(await get(), '/api/tools/ping'); assert.deepEqual([p.state, p.code, p.source], ['down', 503, 'off']); }
  finally { await h.db().query("UPDATE endpoints SET status='active' WHERE path='/api/tools/ping'"); }
});

it('the developer self-test and the daily cron check everything and store it', async () => {
  reply = () => ({ status: 200, json: { status: true, result: 'ok' } });
  const r = await app.request('POST', '/owner/api/selftest', { cookie: owner, headers: { origin: app.origin }, body: {} });
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.summary.manual, undefined, 'every endpoint can be checked now');
  assert.ok(r.json.summary.ok > 70, JSON.stringify(r.json.summary));
  const all = await get();
  assert.deepEqual(all.endpoints.filter(e => e.state !== 'ok').map(e => [e.path, e.code, e.source]), []);

  assert.equal((await app.request('GET', '/cron/endpoint-check')).status, 401);
  const c = await app.request('GET', '/cron/endpoint-check', { headers: { authorization: 'Bearer cron-xyz' } });
  assert.equal(c.status, 200, c.text);
  assert.ok(c.json.summary.ok > 70);
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  assert.ok(v.crons.some(x => x.path === '/cron/endpoint-check'));
});

it('the dashboard loads the monitor (codes + meanings) and API Docs has cURL / Node.js / Python / PHP examples', async () => {
  const js = await app.request('GET', '/assets/endpoint-monitor.js');
  assert.equal(js.status, 200);
  assert.match(js.text, /\/api\/endpoints\/autocheck/);
  assert.match(js.text, /The server took too long to respond/);
  assert.ok(!/Another server took too long/.test(js.text));
  for (const t of ['Metode request tidak didukung', 'Request terlalu lama', 'Ukuran data terlalu besar', 'Format data tidak didukung', 'Data tidak dapat diproses', 'Terlalu banyak request', 'Terjadi kesalahan pada server', 'Fitur belum didukung', 'Server menerima respons tidak valid', 'Server sedang tidak tersedia', 'Server lain terlalu lama merespons']) assert.ok(js.text.includes(t), t);
  const img = await app.request('GET', '/assets/check-sample.png');
  assert.deepEqual([img.status, img.headers['content-type']], [200, 'image/png']);
  const home = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'index.html'), 'utf8');
  assert.match(home, /id="ep-monitor"/);
  const docs = fs.readFileSync(path.join(__dirname, '..', '..', 'views', 'api.html'), 'utf8');
  for (const lang of ['curl', 'node', 'python', 'php']) assert.match(docs, new RegExp(`data-lang="${lang}"`));
});
