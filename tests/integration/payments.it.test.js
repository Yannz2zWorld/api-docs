'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require('./helpers');

const axios = require(path.join(__dirname, '..', '..', 'node_modules', 'axios'));
let app;
let owner;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ PAKASIR_PROJECT: 'yannz-test-project' });
  owner = await app.login(h.OWNER_EMAIL);
  // Manual DANA / GoPay transfers need destination accounts configured by the owner.
  const set = await app.request('PATCH', '/owner/server/payments', { cookie: owner, headers: { origin: app.origin }, body: { payment_dana_number: '081200000000', payment_dana_name: 'Owner', payment_gopay_number: '081300000000', payment_gopay_name: 'Owner' } });
  assert.equal(set.status, 200);
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const post = (cookie, url, body, headers = {}) => app.request('POST', url, { cookie, body, headers: { origin: app.origin, ...headers } });
const order = (cookie, tier, extra = {}) => post(cookie, '/api/orders', { tier, ...extra });
const tierOf = async email => (await h.userByEmail(email)).tier;
const webhook = body => app.request('POST', '/webhooks/pakasir', { body });
const PROOF = 'https://storage.example.test/proof.jpg';

it('orders are priced by the server; client-sent amounts are ignored', async () => {
  const cookie = await app.login('pprice@example.test');
  const r = await order(cookie, 'DEWA', { amount: 1 });
  assert.equal(r.status, 201);
  assert.deepEqual([r.json.order.amount, r.json.order.status], [25000, 'pending']);
  assert.equal((await order(cookie, 'SULTAN')).json.order.amount, 5000);
  assert.equal((await order(cookie, 'SEPUH')).json.order.amount, 10000);
  for (const tier of ['OWNER', 'FREE', 'nope']) assert.equal((await order(cookie, tier)).json.error, 'INVALID_TIER');
});

it('cannot buy a tier at or below the current one; pending orders are capped', async () => {
  const cookie = await app.login('pcap@example.test');
  await h.setTier('pcap@example.test', 'SEPUH');
  assert.equal((await order(cookie, 'SULTAN')).json.error, 'TIER_NOT_UPGRADE');
  assert.equal((await order(cookie, 'SEPUH')).json.error, 'TIER_NOT_UPGRADE');
  for (let i = 0; i < 5; i++) assert.equal((await order(cookie, 'DEWA')).status, 201);
  const sixth = await order(cookie, 'DEWA');
  assert.deepEqual([sixth.status, sixth.json.error], [429, 'TOO_MANY_PENDING_ORDERS']);
  const freshKey = await post(cookie, '/api/orders', { tier: 'DEWA' }, { 'idempotency-key': 'brand-new-key' });
  assert.deepEqual([freshKey.status, freshKey.json.error], [429, 'TOO_MANY_PENDING_ORDERS'], 'a new Idempotency-Key does not bypass the cap');
});

it('an Idempotency-Key replay returns the same order instead of creating another', async () => {
  const cookie = await app.login('pidem@example.test');
  const a = await post(cookie, '/api/orders', { tier: 'SULTAN' }, { 'idempotency-key': 'order-1' });
  const b = await post(cookie, '/api/orders', { tier: 'SULTAN' }, { 'idempotency-key': 'order-1' });
  assert.equal(a.json.order.id, b.json.order.id);
  const other = await post(cookie, '/api/orders', { tier: 'DEWA' }, { 'idempotency-key': 'order-1' });
  assert.deepEqual([other.status, other.json.error], [409, 'IDEMPOTENCY_CONFLICT']);
});

it('manual payment: validation, pending state, one proof per order, no tier change yet', async () => {
  const email = 'pmanual@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'SULTAN')).json.order;
  const url = `/api/orders/${o.id}/manual`;
  assert.equal((await post(cookie, url, { method: 'PAYPAL', proof_url: PROOF })).json.error, 'INVALID_PAYMENT_METHOD');
  for (const proof of ['http://insecure.test/p.jpg', 'javascript:alert(1)', '/etc/passwd', '']) {
    assert.equal((await post(cookie, url, { method: 'DANA', proof_url: proof })).json.error, 'INVALID_PROOF_URL', proof);
  }
  const ok = await post(cookie, url, { method: 'DANA', proof_url: PROOF });
  assert.deepEqual([ok.status, ok.json.status, ok.json.payment.status], [201, 'PAYMENT_PENDING', 'pending']);
  assert.equal(ok.json.notification, 'not_configured', 'never claims a WhatsApp message was sent');
  assert.equal((await post(cookie, url, { method: 'DANA', proof_url: PROOF })).json.error, 'PAYMENT_ALREADY_SUBMITTED');
  assert.equal(await tierOf(email), 'FREE');
  const mine = await app.request('GET', '/api/orders', { cookie });
  assert.equal(mine.json.orders.find(x => x.id === o.id).payment_status, 'pending');
});

it("users cannot pay another user's order", async () => {
  const alice = await app.login('palice@example.test');
  const bob = await app.login('pbob@example.test');
  const o = (await order(alice, 'SULTAN')).json.order;
  const r = await post(bob, `/api/orders/${o.id}/manual`, { method: 'DANA', proof_url: PROOF });
  assert.deepEqual([r.status, r.json.error], [404, 'ORDER_NOT_FOUND']);
});

it('owner approval upgrades the tier exactly once; duplicates and reversals are rejected', async () => {
  const email = 'papprove@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'SEPUH')).json.order;
  const pay = (await post(cookie, `/api/orders/${o.id}/manual`, { method: 'QRIS', proof_url: PROOF })).json.payment;
  const user = await app.login('pnotowner@example.test');
  assert.equal((await post(user, `/owner/payments/${pay.id}/approve`)).json.error, 'OWNER_REQUIRED');

  const approved = await post(owner, `/owner/payments/${pay.id}/approve`);
  assert.deepEqual([approved.status, approved.json.status], [200, 'paid']);
  assert.equal(await tierOf(email), 'SEPUH');
  const twice = await Promise.all([post(owner, `/owner/payments/${pay.id}/approve`), post(owner, `/owner/payments/${pay.id}/reject`)]);
  assert.ok(twice.every(r => r.status === 409 && r.json.error === 'PAYMENT_NOT_PENDING'));
  const audits = await h.db().query("SELECT count(*)::int n FROM audit_logs WHERE action='payment_approve' AND target_id=$1", [pay.id]);
  assert.equal(audits.rows[0].n, 1);
});

it('owner rejection leaves the tier unchanged', async () => {
  const email = 'preject@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'DEWA')).json.order;
  const pay = (await post(cookie, `/api/orders/${o.id}/manual`, { method: 'GOPAY', proof_url: PROOF })).json.payment;
  assert.equal((await post(owner, `/owner/payments/${pay.id}/reject`)).json.status, 'rejected');
  assert.equal(await tierOf(email), 'FREE');
});

it('an order awaiting manual review is not expired before the owner decides', async () => {
  const email = 'pslow@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'SULTAN')).json.order;
  const pay = (await post(cookie, `/api/orders/${o.id}/manual`, { method: 'DANA', proof_url: PROOF })).json.payment;
  await h.db().query("UPDATE orders SET expires_at=now()-interval '1 day' WHERE id=$1", [o.id]);
  const unpaid = (await order(cookie, 'DEWA')).json.order;
  await h.db().query("UPDATE orders SET expires_at=now()-interval '1 day' WHERE id=$1", [unpaid.id]);
  const list = await app.request('GET', '/api/orders', { cookie });
  assert.equal(list.json.orders.find(x => x.id === o.id).status, 'pending');
  assert.equal(list.json.orders.find(x => x.id === unpaid.id).status, 'expired');
  assert.equal((await post(owner, `/owner/payments/${pay.id}/approve`)).status, 200);
  assert.equal(await tierOf(email), 'SULTAN');
});

it('Pakasir is fail-closed when not configured', async () => {
  const cookie = await app.login('pnocfg@example.test');
  const o = (await order(cookie, 'SULTAN')).json.order;
  const r = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
  assert.deepEqual([r.status, r.json.error], [503, 'PAYMENT_NOT_CONFIGURED']);
});

it('webhook: malformed, forged, wrong-order and wrong-amount payloads are rejected', async () => {
  const cookie = await app.login('pforged@example.test');
  const o = (await order(cookie, 'DEWA')).json.order;
  const valid = { project: 'yannz-test-project', order_id: o.order_code, amount: 25000, status: 'completed' };
  const cases = [
    {},
    { ...valid, status: 'pending' },
    { ...valid, project: 'someone-else' },
    { ...valid, amount: 5000 },
    { ...valid, order_id: 'YAN-DEWA-DOESNOTEXIST' }
  ];
  for (const body of cases) {
    const r = await webhook(body);
    assert.deepEqual([r.status, r.json.error], [400, 'INVALID_PAYMENT'], JSON.stringify(body));
  }
  const unverified = await webhook(valid);
  assert.deepEqual([unverified.status, unverified.json.error], [202, 'PAYMENT_NOT_VERIFIED'], 'no verification URL configured: fail closed');
  assert.equal(await tierOf('pforged@example.test'), 'FREE');
});

it('webhook: trusted verification settles once; replays and concurrent duplicates do nothing', async () => {
  const email = 'pgateway@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'SEPUH')).json.order;
  Object.assign(process.env, { PAKASIR_API_KEY: 'test-only-key', PAKASIR_V2_VERIFY_URL: 'https://verify.example.test/{project}/{order_id}?amount={amount}' });
  const { post: realPost, get: realGet } = axios;
  let verifyStatus = 'completed';
  axios.post = async () => ({ data: { transaction: { txn_id: 'TXN-' + o.order_code, payment_link: 'https://pay.example.test/x', qr_string: '000201...', expired_at: new Date(Date.now() + 3600e3).toISOString() } } });
  axios.get = async url => {
    assert.match(url, new RegExp(encodeURIComponent(o.order_code)));
    return { data: { transaction: { order_id: o.order_code, amount: 10000, status: verifyStatus } } };
  };
  try {
    const created = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(created.status, 201);
    assert.equal(created.json.payment.status, 'pending', 'creating a payment never marks it paid');
    const reloaded = (await app.request('GET', '/api/orders', { cookie })).json.orders.find(x => x.id === o.id);
    assert.equal(reloaded.payment_url, 'https://pay.example.test/x', 'gateway details survive a reload');

    const body = { project: 'yannz-test-project', order_id: o.order_code, amount: 10000, status: 'completed' };
    verifyStatus = 'pending';
    assert.equal((await webhook(body)).json.error, 'PAYMENT_NOT_VERIFIED', 'provider says not paid: forged webhook ignored');
    assert.equal(await tierOf(email), 'FREE');

    verifyStatus = 'completed';
    const results = await Promise.all([webhook(body), webhook(body), webhook(body)]);
    assert.equal(results.filter(r => r.json.processed === true).length, 1);
    assert.equal(await tierOf(email), 'SEPUH');
    const replay = await webhook(body);
    assert.deepEqual([replay.status, replay.json.duplicate, replay.json.processed], [200, true, false]);
    const settled = await h.db().query("SELECT count(*)::int n FROM audit_logs WHERE action='pakasir_webhook_paid' AND target_id=$1", [o.id]);
    assert.equal(settled.rows[0].n, 1);
  } finally {
    axios.post = realPost;
    axios.get = realGet;
    delete process.env.PAKASIR_API_KEY;
    delete process.env.PAKASIR_V2_VERIFY_URL;
  }
});
