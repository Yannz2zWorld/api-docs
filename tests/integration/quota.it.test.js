'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require('./helpers');

let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

async function sessionUser(email, tier) {
  await app.login(email);
  if (tier) await h.setTier(email, tier);
  const cookie = await app.login(email);
  return { cookie, id: (await h.userByEmail(email)).id };
}
const pingAs = cookie => app.request('GET', '/api/tools/ping', app.asBrowser(cookie));
async function presetUsage(userId, n, date = "(now() AT TIME ZONE 'UTC')::date") {
  await h.db().query(`INSERT INTO daily_quota_counters(user_id,usage_date,request_count) VALUES($1,${date},$2) ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count=EXCLUDED.request_count`, [userId, n]);
}

it('FREE: requests 1..100 succeed, request 101 is QUOTA_EXCEEDED with reset info', async () => {
  const u = await sessionUser('qfree@example.test');
  const first = await pingAs(u.cookie);
  assert.equal(first.status, 200);
  assert.deepEqual([first.headers['x-ratelimit-limit'], first.headers['x-ratelimit-remaining']], ['100', '99']);
  for (let i = 2; i <= 100; i++) assert.equal((await pingAs(u.cookie)).status, 200, `request ${i}`);
  const last = await pingAs(u.cookie);
  assert.equal(last.status, 429);
  assert.equal(last.json.error, 'QUOTA_EXCEEDED');
  assert.deepEqual([last.json.used, last.json.limit, last.json.remaining], [100, 100, 0]);
  assert.ok(Number(last.headers['retry-after']) > 0);
  assert.ok(Date.parse(last.json.resetAt) > Date.now());
  assert.equal(await h.usedToday(u.id), 100, 'rejected request is not counted');
});

it('the quota resets on the next UTC day', async () => {
  const u = await sessionUser('qreset@example.test');
  await presetUsage(u.id, 100);
  assert.equal((await pingAs(u.cookie)).status, 429);
  await h.db().query("UPDATE daily_quota_counters SET usage_date=usage_date-1 WHERE user_id=$1", [u.id]);
  const r = await pingAs(u.cookie);
  assert.equal(r.status, 200);
  assert.equal(r.json.result.quota.used, 1);
});

it('concurrent requests cannot overrun the limit (SULTAN at 990/1000, 30 in parallel)', async () => {
  const u = await sessionUser('qrace@example.test', 'SULTAN');
  await presetUsage(u.id, 990);
  const results = await Promise.all(Array.from({ length: 30 }, () => pingAs(u.cookie)));
  assert.equal(results.filter(r => r.status === 200).length, 10);
  assert.equal(results.filter(r => r.status === 429).length, 20);
  assert.equal(await h.usedToday(u.id), 1000);
});

it('tier limits: SULTAN 1000, SEPUH 10000, DEWA 100000, OWNER unlimited', async () => {
  for (const [tier, limit] of [['SULTAN', '1000'], ['SEPUH', '10000'], ['DEWA', '100000']]) {
    const u = await sessionUser(`q${tier.toLowerCase()}@example.test`, tier);
    await presetUsage(u.id, Number(limit) - 1);
    const ok = await pingAs(u.cookie);
    assert.deepEqual([ok.status, ok.headers['x-ratelimit-limit'], ok.headers['x-ratelimit-remaining']], [200, limit, '0']);
    assert.equal((await pingAs(u.cookie)).json.error, 'QUOTA_EXCEEDED');
  }
  const owner = await sessionUser(h.OWNER_EMAIL);
  await presetUsage(owner.id, 5000000);
  const r = await pingAs(owner.cookie);
  assert.deepEqual([r.status, r.headers['x-ratelimit-limit']], [200, 'unlimited']);
});

it('different users have independent quotas', async () => {
  const a = await sessionUser('qa@example.test');
  const b = await sessionUser('qb@example.test');
  await presetUsage(a.id, 100);
  assert.equal((await pingAs(a.cookie)).status, 429);
  assert.equal((await pingAs(b.cookie)).status, 200);
});

it('auth failures never consume quota (invalid key, revoked key, CSRF, anonymous)', async () => {
  const u = await sessionUser('qauth@example.test', 'SULTAN');
  const key = (await app.request('POST', '/api/keys', { cookie: u.cookie, headers: { origin: app.origin }, body: { name: 'x' } })).json;
  await app.request('POST', `/api/keys/${key.record.id}/revoke`, { cookie: u.cookie, headers: { origin: app.origin } });
  const before = await h.usedToday(u.id);
  const results = [
    await app.request('GET', '/api/tools/ping', { headers: { authorization: 'Bearer yannz_live_bogus' } }),
    await app.request('GET', '/api/tools/ping', { headers: { authorization: `Bearer ${key.key}` } }),
    await app.request('GET', '/api/tools/ping', { cookie: u.cookie }),
    await app.request('GET', '/api/tools/ping')
  ];
  assert.deepEqual(results.map(r => r.json.error), ['INVALID_API_KEY', 'API_KEY_REVOKED', 'CSRF_BLOCKED', 'AUTH_REQUIRED']);
  assert.equal(await h.usedToday(u.id), before);
});

it('failed handler calls are refunded: invalid parameter (400) and upstream failure (502)', async () => {
  const u = await sessionUser('qrefund@example.test');
  const missing = await app.request('GET', '/api/download/tiktok', app.asBrowser(u.cookie));
  assert.deepEqual([missing.status, missing.json.error], [400, 'INVALID_PARAMETER']);
  const axios = require(path.join(__dirname, '..', '..', 'node_modules', 'axios'));
  const original = axios.post;
  axios.post = async () => { throw Object.assign(new Error('upstream down'), { code: 'ECONNRESET' }); };
  try {
    const upstream = await app.request('GET', '/api/download/tiktok?url=https%3A%2F%2Fwww.tiktok.com%2F%40x%2Fvideo%2F1', app.asBrowser(u.cookie));
    assert.deepEqual([upstream.status, upstream.json.error], [502, 'UPSTREAM_FAILED']);
  } finally {
    axios.post = original;
  }
  assert.equal(await h.usedToday(u.id), 0, 'neither failure was charged');
  assert.equal((await pingAs(u.cookie)).status, 200);
  assert.equal(await h.usedToday(u.id), 1);
});
