'use strict';
// Alur lengkap terhadap PostgreSQL sungguhan. Jalankan dengan TEST_DATABASE_URL (database kosong / sekali pakai).
// Tidak memanggil provider: semua yang dites berhenti sebelum request diteruskan.
const test = require('node:test');
const assert = require('node:assert');

const URL_DB = process.env.TEST_DATABASE_URL;
test('platform flow', { skip: !URL_DB && 'TEST_DATABASE_URL belum diisi' }, async t => {
  process.env.DATABASE_URL = URL_DB;
  process.env.AUTH_SECRET = 'test-secret-test-secret-test-secret-123';
  process.env.DEVELOPER_USERNAMES = 'devboss';
  const db = require('../lib/db');
  await db.q('DROP TABLE IF EXISTS chat_messages, orders, custom_endpoints, endpoint_settings, settings, blacklist, reset_codes, usage_daily, api_keys, users CASCADE').catch(() => {});
  await db.close();
  const app = require('../index');
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => { server.close(); await db.close(); });

  const jar = {};
  async function call(who, method, path, body) {
    const headers = { Origin: base, 'Content-Type': 'application/json' };
    if (jar[who]) headers.Cookie = jar[who];
    const r = await fetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const c = r.headers.get('set-cookie'); if (c) jar[who] = c.split(';')[0];
    let data = null; try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }

  let r = await call('dev', 'POST', '/auth/register', { username: 'devboss', password: 'secret12', phone: '081200000001', email: 'dev@x.io' });
  assert.strictEqual(r.status, 200);
  r = await call('u', 'POST', '/auth/register', { username: 'ani', password: 'secret12', phone: '081200000002', email: 'ani@x.io' });
  assert.strictEqual(r.status, 200);
  r = await call('x', 'POST', '/auth/register', { username: 'ani', password: 'secret12', phone: '0812', email: 'z@x.io' });
  assert.strictEqual(r.status, 400, 'invalid phone / duplicate refused');

  const me = (await call('u', 'GET', '/me')).data;
  assert.strictEqual(me.plan.id, 'free');
  assert.strictEqual(me.keys.length, 1);
  const key = me.keys[0].key;
  assert.strictEqual((await call('dev', 'GET', '/me')).data.user.tier, 'developer');

  // key limit + custom key needs Premium
  assert.strictEqual((await call('u', 'POST', '/me/keys', {})).status, 403);
  // gateway checks
  assert.strictEqual((await call('u', 'GET', '/api/islamic/doaharian')).data.error, 'APIKEY_REQUIRED');
  assert.strictEqual((await call('u', 'GET', '/api/islamic/doaharian?apikey=nope')).data.error, 'INVALID_APIKEY');
  assert.strictEqual((await call('u', 'GET', `/api/ai/nano-banana?apikey=${key}`)).data.error, 'PLAN_REQUIRED');
  assert.strictEqual((await call('u', 'GET', `/api/nope/nope?apikey=${key}`)).status, 404);

  // developer: lock, hide, plan
  assert.strictEqual((await call('u', 'GET', '/dev/stats')).status, 403);
  await call('dev', 'PATCH', '/dev/endpoints', { path: '/api/islamic/doaharian', locked: true });
  assert.strictEqual((await call('u', 'GET', `/api/islamic/doaharian?apikey=${key}`)).data.error, 'ENDPOINT_LOCKED');
  await call('dev', 'PATCH', '/dev/endpoints', { path: '/api/islamic/doaharian', locked: false, hidden: true, plan: 'nebula' });
  const list = (await call('u', 'GET', '/api/list')).data.endpoints;
  assert.ok(!list.some(e => e.path === '/api/islamic/doaharian'), 'hidden from list');
  assert.strictEqual((await call('u', 'GET', `/api/islamic/doaharian?apikey=${key}`)).data.requiredPlan, 'nebula');

  // plan via manual order + approval
  const pm = (await call('dev', 'PUT', '/dev/payments', { payments: [{ name: 'DANA', holder: 'W** N***', number: '0812' }] })).data.payments[0];
  r = await call('u', 'POST', '/billing/order', { kind: 'plan', tier: 'premium', method: pm.id, sender: 'Ani' });
  assert.strictEqual(r.status, 200);
  const orders = (await call('dev', 'GET', '/dev/orders?status=pending')).data.orders;
  assert.strictEqual((await call('dev', 'POST', `/dev/orders/${orders[0].id}/approve`, {})).status, 200);
  const me2 = (await call('u', 'GET', '/me')).data;
  assert.strictEqual(me2.plan.id, 'premium');
  assert.strictEqual((await call('u', 'POST', '/me/keys', { custom: 'ani-custom-key' })).status, 200);

  // buy with balance
  assert.strictEqual((await call('u', 'POST', '/billing/buy', { tier: 'super' })).status, 402);
  await call('dev', 'PATCH', `/dev/users/${me2.user.id}`, { balanceDelta: 15000 });
  assert.strictEqual((await call('u', 'POST', '/billing/buy', { tier: 'super' })).status, 200);
  assert.strictEqual((await call('u', 'GET', '/me')).data.user.balance, 0);

  // quota exhausted
  const uid = (await db.one("SELECT id FROM users WHERE username = 'ani'")).id;
  await db.q('INSERT INTO usage_daily (user_id, day, count) VALUES ($1, $2, 10000) ON CONFLICT (user_id, day) DO UPDATE SET count = 10000', [uid, require('../lib/keys').today()]);
  assert.strictEqual((await call('u', 'GET', `/api/islamic/kisahnabi?apikey=ani-custom-key`)).data.error, 'QUOTA_EXCEEDED');

  // maintenance blocks users, bubble visible
  await call('dev', 'PUT', '/dev/maintenance', { on: true, message: 'Update bentar' });
  assert.strictEqual((await call('u', 'GET', `/api/islamic/kisahnabi?apikey=${key}`)).data.error, 'MAINTENANCE');
  assert.strictEqual((await call('anon', 'GET', '/site/status')).data.maintenance.message, 'Update bentar');
  await call('dev', 'PUT', '/dev/maintenance', { on: false, message: 'x' });

  // custom endpoint
  r = await call('dev', 'POST', '/dev/endpoints', { server: 'custom', path: '/api/tools/echo', name: 'Echo', url: 'https://example.com/echo', params: [{ name: 'text', required: true }] });
  assert.strictEqual(r.status, 200);
  assert.ok((await call('u', 'GET', '/api/list')).data.endpoints.some(e => e.path === '/api/tools/echo'));

  // chat, profile, password
  assert.strictEqual((await call('u', 'POST', '/chat/messages', { text: 'halo' })).status, 200);
  const msgs = (await call('dev', 'GET', '/chat/messages')).data.messages;
  assert.strictEqual(msgs[0].user.username, 'ani');
  assert.strictEqual((await call('u', 'POST', '/me/password', { current: 'wrong', password: 'newpass1' })).status, 400);
  assert.strictEqual((await call('u', 'POST', '/me/password', { current: 'secret12', password: 'newpass1' })).status, 200);
  assert.strictEqual((await call('u2', 'POST', '/auth/login', { username: 'ani', password: 'newpass1' })).status, 200);

  // ban + blacklist: session ends, re-register refused
  await call('dev', 'PATCH', `/dev/users/${me2.user.id}`, { banned: true, reason: 'spam', blacklist: true });
  assert.strictEqual((await call('u2', 'GET', '/me')).status, 401);
  assert.strictEqual((await call('u3', 'POST', '/auth/login', { username: 'ani', password: 'newpass1' })).status, 403);
  assert.strictEqual((await call('z', 'POST', '/auth/register', { username: 'ani2', password: 'secret12', phone: '081200000002', email: 'other@x.io' })).status, 403);

  // CSRF
  const ev = await fetch(base + '/chat/messages', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json', Cookie: jar.dev }, body: '{"text":"x"}' });
  assert.strictEqual(ev.status, 403);
});
