'use strict';
// "Not a robot" check in front of the endpoint list (services/humanCheckService.js). Bots and
// scrapers get 403; signed-in visitors and visitors who solved the check get the list.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const h = require('./helpers');

const realFetch = global.fetch;
let app, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (url, opts = {}) => (String(url).startsWith('https://challenges.cloudflare.com/')
    ? new Response(JSON.stringify({ success: new URLSearchParams(String(opts.body)).get('response') === 'good-token' }), { status: 200, headers: { 'content-type': 'application/json' } })
    : realFetch(url, opts));
  await h.setupDatabase();
  app = await h.startApp();
  user = await app.login('human@example.test');
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { process.env.HUMAN_CHECK = 'on'; delete process.env.TURNSTILE_SITE_KEY; delete process.env.TURNSTILE_SECRET_KEY; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const zeroBits = buf => { let n = 0; for (const b of buf) { if (b === 0) { n += 8; continue; } n += Math.clz32(b) - 24; break; } return n; };
function solve({ salt, bits }) {
  for (let i = 0; ; i++) { const nonce = i.toString(36); if (zeroBits(crypto.createHash('sha256').update(`${salt}:${nonce}`).digest()) >= bits) return nonce; }
}
const passCookie = r => String([].concat(r.headers['set-cookie'] || []).find(c => c.startsWith('yannz_human=')) || '').split(';')[0];
const post = (body, headers = {}) => app.request('POST', '/human-check', { body, headers: { origin: app.origin, ...headers } });

it('a bot asking for the endpoint list (no session, no pass) is refused with a challenge', async () => {
  for (const p of ['/api/endpoints', '/api/endpoints/status']) {
    const r = await app.request('GET', p);
    assert.equal(r.status, 403, p);
    assert.equal(r.json.error, 'HUMAN_CHECK_REQUIRED');
    assert.equal(r.json.endpoints, undefined, 'nothing of the list leaks');
    assert.equal(r.json.check.mode, 'pow');
  }
});

it('signed-in visitors get the list without any box', async () => {
  const r = await app.request('GET', '/api/endpoints', { cookie: user });
  assert.equal(r.status, 200, r.text);
  assert.ok(Object.keys(r.json.endpoints).length > 5);
});

it('solving the box gives a 12-hour pass; the same puzzle cannot be used twice; a wrong answer fails', async () => {
  const { check } = (await app.request('GET', '/api/endpoints')).json;
  assert.equal((await post({ salt: check.salt, nonce: 'wrong' })).status, 403);
  const nonce = solve(check);
  const ok = await post({ salt: check.salt, nonce });
  assert.equal(ok.status, 200, ok.text);
  const cookie = passCookie(ok);
  assert.match(cookie, /^yannz_human=\d+\.[\w-]+$/);
  assert.match(String(ok.headers['set-cookie']), /HttpOnly/);
  assert.match(String(ok.headers['set-cookie']), /Max-Age=43200/);
  const list = await app.request('GET', '/api/endpoints', { cookie });
  assert.equal(list.status, 200, list.text);
  assert.equal((await post({ salt: check.salt, nonce })).status, 403, 'a solved puzzle works once');
  // The pass belongs to the browser that earned it.
  assert.equal((await app.request('GET', '/api/endpoints', { cookie, headers: { 'user-agent': 'curl/8.0' } })).status, 403);
});

it('made-up puzzles and passes are refused', async () => {
  const exp = Date.now() + 60000;
  const salt = `${exp}.abc.forged`;
  assert.equal((await post({ salt, nonce: solve({ salt, bits: 15 }) })).status, 403);
  assert.equal((await app.request('GET', '/api/endpoints', { cookie: `yannz_human=${exp}.forged` })).status, 403);
  assert.equal((await post({ salt: 'x' }, { origin: 'https://evil.example' })).status, 403, 'other sites cannot ask for a pass');
});

it('with Turnstile keys set, the box is Cloudflare Turnstile', async () => {
  process.env.TURNSTILE_SITE_KEY = 'site-key'; process.env.TURNSTILE_SECRET_KEY = 'secret';
  const { check } = (await app.request('GET', '/api/endpoints')).json;
  assert.deepEqual(check, { mode: 'turnstile', siteKey: 'site-key' });
  assert.equal((await post({ turnstileToken: 'bad-token' })).status, 403);
  const ok = await post({ turnstileToken: 'good-token' });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await app.request('GET', '/api/endpoints', { cookie: passCookie(ok) })).status, 200);
});

it('API calls are not affected, and HUMAN_CHECK=off turns the box off', async () => {
  const r = await app.request('GET', '/api/tools/ping');
  assert.notEqual(r.json.error, 'HUMAN_CHECK_REQUIRED', 'endpoints themselves keep their own API key rules');
  process.env.HUMAN_CHECK = 'off';
  assert.equal((await app.request('GET', '/api/endpoints')).status, 200);
});

it('API Docs and Playground load the box script; it is small and not full screen', async () => {
  const fs = require('fs'), path = require('path');
  for (const page of ['api.html', 'playground.html']) {
    const html = fs.readFileSync(path.join(__dirname, '..', '..', 'views', page), 'utf8');
    assert.match(html, /\/assets\/human-check\.js/);
    assert.match(html, /YannzHuman\.json\('\/api\/endpoints'/);
  }
  const js = await app.request('GET', '/assets/human-check.js');
  assert.equal(js.status, 200);
  assert.match(js.text, /max-width:360px/);
  assert.ok(!/position:\s*fixed|100vh|inset:\s*0/.test(js.text), 'no full-screen overlay');
});
