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
  assert.equal(ok.json.notification, 'panel', 'never claims a message was sent')
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

it('Pakasir is fail-closed: in maintenance unless switched on, and not configured without keys', async () => {
  const cookie = await app.login('pnocfg@example.test');
  const o = (await order(cookie, 'SULTAN')).json.order;
  const r = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
  assert.deepEqual([r.status, r.json.error], [503, 'PAYMENT_GATEWAY_MAINTENANCE']);
  process.env.PAYMENT_GATEWAY = 'on';
  try {
    const noKeys = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.deepEqual([noKeys.status, noKeys.json.error], [503, 'PAYMENT_GATEWAY_MAINTENANCE'], 'the switch alone does not enable a gateway without keys');
  } finally {
    delete process.env.PAYMENT_GATEWAY;
  }
});

// ---------------------------------------------------------------- Pakasir API v2
// axios is stubbed: create → {txn_id, qr_string, …}; status → {status, order_id, amount}.
function stubPakasir(state) {
  const { post: realPost, get: realGet } = axios;
  state.calls = [];
  axios.post = async (url, body, opts) => {
    state.calls.push({ method: 'POST', url, body, headers: opts?.headers });
    if (/cancel-transaction/.test(url)) return { data: { message: 'Berhasil batalkan transaksi' } };
    const orderId = decodeURIComponent(url.split('/').pop());
    const txn = 'txn-' + orderId;
    state.txns[txn] = { order_id: orderId, amount: body.amount };
    return { data: { txn_id: txn, project: 'yannz-test-project', order_id: orderId, amount: body.amount, fee: 400, total_payment: body.amount + 400, payment_method: body.method,
      qr_string: '00020101021226610016ID.CO.QRIS', expired_at: new Date(Date.now() + 3600e3).toISOString(), is_sandbox: false } };
  };
  axios.get = async (url, opts) => {
    state.calls.push({ method: 'GET', url, headers: opts?.headers });
    if (state.getError) throw state.getError;
    const txn = decodeURIComponent(url.split('/').pop());
    const t = state.txns[txn] || {};
    return { data: { txn_id: txn, order_id: t.order_id, amount: state.amount ?? t.amount, is_sandbox: Boolean(state.sandbox), status: state.status, completed_at: null } };
  };
  return () => { axios.post = realPost; axios.get = realGet; };
}
const withGateway = async (fn, extra = {}) => {
  Object.assign(process.env, { PAYMENT_GATEWAY: 'on', PAKASIR_API_KEY: 'test-only-key', ...extra });
  const state = { txns: {}, status: 'pending' };
  const restore = stubPakasir(state);
  try { await fn(state); } finally {
    restore();
    for (const k of ['PAYMENT_GATEWAY', 'PAKASIR_API_KEY', 'PAKASIR_WEBHOOK_SECRET', 'PAKASIR_SANDBOX', ...Object.keys(extra)]) delete process.env[k];
  }
};

it('webhook: malformed, forged, wrong-order and wrong-amount payloads are rejected', async () => {
  await withGateway(async state => {
    const cookie = await app.login('pforged@example.test');
    const o = (await order(cookie, 'DEWA')).json.order;
    const created = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(created.status, 201, created.text);
    const valid = { txn_id: created.json.gateway.txn_id, order_id: o.order_code, amount: 25000, status: 'completed', is_sandbox: false };
    for (const body of [{}, { ...valid, status: 'pending' }, { ...valid, project: 'someone-else' }, { ...valid, amount: 5000 }, { ...valid, txn_id: 'nope', order_id: 'YAN-DEWA-DOESNOTEXIST' }]) {
      const r = await webhook(body);
      assert.deepEqual([r.status, r.json.error], [400, 'INVALID_PAYMENT'], JSON.stringify(body));
    }
    state.status = 'pending';
    const unverified = await webhook(valid);
    assert.deepEqual([unverified.status, unverified.json.error], [202, 'PAYMENT_NOT_VERIFIED'], 'Pakasir says not paid: the webhook body alone changes nothing');
    assert.equal(await tierOf('pforged@example.test'), 'FREE');
  });
});

it('webhook v2: only with the right X-Secret, confirmed by the status API; settles once, replays do nothing', async () => {
  await withGateway(async state => {
    const email = 'pgateway@example.test';
    const cookie = await app.login(email);
    const o = (await order(cookie, 'SEPUH')).json.order;
    const created = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(created.status, 201, created.text);
    assert.equal(created.json.payment.status, 'pending', 'creating a payment never marks it paid');
    assert.equal(created.json.gateway.total_payment, 10400, 'total with the gateway fee');
    const create = state.calls.find(c => c.method === 'POST');
    assert.match(create.url, /\/api\/v2\/create-transaction\/yannz-test-project\//);
    assert.equal(create.headers['X-Api-Key'], 'test-only-key');
    assert.deepEqual(create.body, { method: 'qris', amount: 10000 });

    const body = { txn_id: created.json.gateway.txn_id, order_id: o.order_code, amount: 10000, status: 'completed', is_sandbox: false };
    const send = (b, secret) => app.request('POST', '/webhooks/pakasir', { body: b, headers: secret ? { 'x-secret': secret } : {} });
    assert.equal((await send(body)).status, 401, 'secret set: a webhook without it is refused');
    assert.equal((await send(body, 'wrong')).status, 401);
    state.status = 'completed';
    const results = await Promise.all([send(body, 'whsec-123'), send(body, 'whsec-123'), send(body, 'whsec-123')]);
    assert.equal(results.filter(r => r.json.processed === true).length, 1);
    assert.equal(await tierOf(email), 'SEPUH');
    const check = state.calls.find(c => c.method === 'GET');
    assert.match(check.url, new RegExp(`/api/v2/transaction-status/yannz-test-project/${body.txn_id}$`));
    const replay = await send(body, 'whsec-123');
    assert.deepEqual([replay.status, replay.json.duplicate, replay.json.processed], [200, true, false]);
    const settled = await h.db().query("SELECT count(*)::int n FROM audit_logs WHERE action='pakasir_paid' AND target_id=$1", [o.id]);
    assert.equal(settled.rows[0].n, 1);
  }, { PAKASIR_WEBHOOK_SECRET: 'whsec-123' });
});

it('the billing page checks the status itself: paid without any webhook; wrong amount or sandbox never counts', async () => {
  await withGateway(async state => {
    const email = 'ppoll@example.test';
    const cookie = await app.login(email);
    const o = (await order(cookie, 'SEPUH')).json.order;
    await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    const status = () => app.request('GET', `/api/orders/${o.id}/payment-status`, { cookie });
    assert.equal((await status()).json.status, 'pending');
    state.status = 'completed'; state.amount = 5000;
    await new Promise(r => setTimeout(r, 4100));   // the status API allows one check per 4 seconds
    assert.equal((await status()).json.status, 'pending', 'a different amount is not this order');
    state.amount = undefined; state.sandbox = true;
    await new Promise(r => setTimeout(r, 4100));
    assert.equal((await status()).json.status, 'pending', 'a sandbox payment is not real money');
    state.sandbox = false;
    await new Promise(r => setTimeout(r, 4100));
    assert.equal((await status()).json.status, 'paid');
    assert.equal(await tierOf(email), 'SEPUH');
    const other = await app.login('ppoll-other@example.test');
    assert.equal((await app.request('GET', `/api/orders/${o.id}/payment-status`, { cookie: other })).status, 404, 'only the buyer');
  });
});

it('QRIS only: other methods are refused; an expired QR is cancelled and replaced; late payments still count', async () => {
  await withGateway(async state => {
    const email = 'pswitch@example.test';
    const cookie = await app.login(email);
    const o = (await order(cookie, 'DEWA')).json.order;
    for (const method of ['bri_va', 'bni_va', 'payment_link']) {
      assert.equal((await post(cookie, `/api/orders/${o.id}/pakasir`, { method })).json.error, 'INVALID_PAYMENT_METHOD', method);
    }
    const qris = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(qris.status, 201, qris.text);
    assert.equal(qris.json.gateway.qr_string, '00020101021226610016ID.CO.QRIS');
    assert.equal('va_number' in qris.json.gateway, false);
    const again = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(again.json.gateway.txn_id, qris.json.gateway.txn_id, 'a valid QR is shown again');
    await h.db().query("UPDATE payments SET gateway_expires_at=now()-interval '1 minute' WHERE transaction_id=$1", [qris.json.gateway.txn_id]);
    const fresh = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(fresh.status, 201, fresh.text);
    assert.notEqual(fresh.json.gateway.txn_id, qris.json.gateway.txn_id);
    assert.ok(state.calls.some(c => /cancel-transaction\/yannz-test-project\//.test(c.url) && c.url.endsWith(qris.json.gateway.txn_id)), 'the old QR is cancelled at Pakasir');
    assert.equal(fresh.json.payment.provider_reference, `${o.order_code}-2`);
    // The order window closes, then the buyer pays: the money arrived, so it still counts.
    await h.db().query("UPDATE orders SET expires_at=now()-interval '1 minute' WHERE id=$1", [o.id]);
    await app.request('GET', '/api/orders', { cookie });   // runs the expiry
    assert.equal((await h.db().query('SELECT status FROM orders WHERE id=$1', [o.id])).rows[0].status, 'expired');
    state.status = 'completed';
    const late = await webhook({ txn_id: fresh.json.gateway.txn_id, order_id: `${o.order_code}-2`, amount: 25000, status: 'completed', is_sandbox: false });
    assert.equal(late.json.processed, true, late.text);
    assert.equal(await tierOf(email), 'DEWA');
  });
});

it('Developer panel → Tes Pakasir: key accepted or refused, webhook URL shown', async () => {
  await withGateway(async state => {
    state.getError = Object.assign(new Error('nf'), { response: { status: 404 } });
    let r = await post(owner, '/owner/pakasir/check', {});
    assert.deepEqual([r.json.ok, r.json.enabled], [true, true]);
    assert.match(r.json.webhookUrl, /\/webhooks\/pakasir$/);
    state.getError = Object.assign(new Error('auth'), { response: { status: 401 } });
    r = await post(owner, '/owner/pakasir/check', {});
    assert.equal(r.json.ok, false);
    assert.match(r.json.message, /ditolak/);
    assert.doesNotMatch(r.text, /test-only-key/);
    const user = await app.login('pcheck-user@example.test');
    assert.equal((await post(user, '/owner/pakasir/check', {})).status, 403);
  });
});

