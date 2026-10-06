'use strict';
// Tier durations (7..365 days), expiry/extension on approval, the four payment methods,
// proof image upload, owner proof viewing, Telegram owner notification and WhatsApp links.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const h = require('./helpers');

const axios = require(path.join(__dirname, '..', '..', 'node_modules', 'axios'));
const BOT_TOKEN = 'test-bot-token-123456:ABCDEF';
const telegramCalls = [];
let telegramMode = 'ok';
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.telegram.org/')) {
    const form = opts.body;
    telegramCalls.push({ url: String(url), caption: form.get('caption'), chat: form.get('chat_id'), photo: form.get('photo') });
    if (telegramMode === 'down') throw new TypeError('fetch failed');
    return new Response(JSON.stringify({ ok: telegramMode === 'ok' }), { status: telegramMode === 'ok' ? 200 : 400 });
  }
  return realFetch(url, opts);
};

let app;
let owner;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ PAKASIR_PROJECT: 'yannz-test-project', PAKASIR_API_KEY: 'pakasir-test-key', TELEGRAM_BOT_TOKEN: BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID: '777' });
  owner = await app.login(h.OWNER_EMAIL);
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const post = (cookie, url, body) => app.request('POST', url, { cookie, body, headers: { origin: app.origin } });
const order = (cookie, tier, days) => post(cookie, '/api/orders', days === undefined ? { tier } : { tier, duration_days: days });
const user = email => h.userByEmail(email);
const daysFromNow = d => (new Date(d) - Date.now()) / 86400000;
// 1x1 PNG
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const pngUrl = 'data:image/png;base64,' + PNG.toString('base64');

async function payManual(cookie, tier, days, method = 'QRIS') {
  const o = (await order(cookie, tier, days)).json.order;
  const r = await post(cookie, `/api/orders/${o.id}/manual`, { method, proof_image: pngUrl });
  assert.equal(r.status, 201, r.text);
  return { order: o, payment: r.json.payment, response: r.json };
}
const approve = paymentId => post(owner, `/owner/payments/${paymentId}/approve`);

it('duration: default 30 days, 7..365 allowed, price scales from the 30-day price', async () => {
  const cookie = await app.login('dur@example.test');
  const def = (await order(cookie, 'SULTAN')).json.order;
  assert.deepEqual([def.duration_days, def.amount], [30, 5000]);
  assert.equal((await order(cookie, 'SULTAN', 7)).json.order.amount, 1200);
  assert.equal((await order(cookie, 'DEWA', 365)).json.order.amount, 304200);
  for (const bad of [6, 366, 7.5, 'abc', -30]) {
    const r = await order(cookie, 'SEPUH', bad);
    assert.deepEqual([r.status, r.json.error], [400, 'INVALID_DURATION'], String(bad));
  }
  const list = await app.request('GET', '/api/orders', { cookie });
  assert.deepEqual(list.json.duration, { min: 7, max: 365, default: 30 });
  assert.equal(list.json.methods.QRIS.image, '/assets/qris-manual.jpg');
  assert.equal(list.json.methods.QRIS_GATEWAY.available, true);
});

it('approval sets an expiry; buying the same tier extends it; a stale cheaper order cannot downgrade', async () => {
  const email = 'expiry@example.test';
  const cookie = await app.login(email);
  const first = await payManual(cookie, 'SULTAN', 30);
  assert.equal((await approve(first.payment.id)).status, 200);
  let u = await user(email);
  assert.equal(u.tier, 'SULTAN');
  assert.ok(Math.abs(daysFromNow(u.tier_expires_at) - 30) < 0.01);
  const me = await app.request('GET', '/auth/me', { cookie });
  assert.equal(me.json.user.tierExpiresAt, new Date(u.tier_expires_at).toISOString());

  const extend = await payManual(cookie, 'SULTAN', 7);
  await approve(extend.payment.id);
  u = await user(email);
  assert.ok(Math.abs(daysFromNow(u.tier_expires_at) - 37) < 0.01, 'extended from the old expiry');

  const stale = (await order(cookie, 'SULTAN', 14)).json.order; // pending while upgrading
  const up = await payManual(cookie, 'SEPUH', 14);
  await approve(up.payment.id);
  u = await user(email);
  assert.equal(u.tier, 'SEPUH');
  assert.ok(Math.abs(daysFromNow(u.tier_expires_at) - 14) < 0.01);
  const late = await post(cookie, `/api/orders/${stale.id}/manual`, { method: 'QRIS', proof_image: pngUrl });
  await approve(late.json.payment.id);
  u = await user(email);
  assert.equal(u.tier, 'SEPUH', 'cheaper order paid later does not downgrade');
  assert.ok(Math.abs(daysFromNow(u.tier_expires_at) - 14) < 0.01);

  assert.equal((await order(cookie, 'SULTAN', 30)).json.error, 'TIER_NOT_UPGRADE');
});

it('a permanent tier cannot be "extended"; an expired tier can buy any tier again', async () => {
  const cookie = await app.login('perm@example.test');
  await h.setTier('perm@example.test', 'SEPUH');
  assert.equal((await order(cookie, 'SEPUH', 30)).json.error, 'TIER_NOT_UPGRADE');
  assert.equal((await order(cookie, 'DEWA', 30)).status, 201);
  await h.db().query("UPDATE users SET tier_expires_at=now()-interval '1 day' WHERE email='perm@example.test'");
  assert.equal((await order(cookie, 'SULTAN', 7)).status, 201);
});

it('proof upload: real images only, at most 2 MB, owner-only viewing as an inert image', async () => {
  const cookie = await app.login('proof@example.test');
  const o = (await order(cookie, 'SULTAN')).json.order;
  const fake = 'data:image/png;base64,' + Buffer.from('<html><script>alert(1)</script></html>').toString('base64');
  assert.equal((await post(cookie, `/api/orders/${o.id}/manual`, { method: 'QRIS', proof_image: fake })).json.error, 'INVALID_PROOF_IMAGE');
  assert.equal((await post(cookie, `/api/orders/${o.id}/manual`, { method: 'QRIS', proof_image: 'data:image/svg+xml;base64,PHN2Zy8+' })).json.error, 'INVALID_PROOF_IMAGE');
  const big = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(2 * 1024 * 1024)]).toString('base64');
  const tooBig = await post(cookie, `/api/orders/${o.id}/manual`, { method: 'QRIS', proof_image: big });
  assert.deepEqual([tooBig.status, tooBig.json.error], [413, 'PROOF_TOO_LARGE']);
  assert.equal((await post(cookie, `/api/orders/${o.id}/manual`, { method: 'PAYPAL', proof_image: pngUrl })).json.error, 'INVALID_PAYMENT_METHOD');
  assert.equal((await post(cookie, `/api/orders/${o.id}/manual`, { method: 'DANA', proof_image: pngUrl })).json.error, 'PAYMENT_METHOD_UNAVAILABLE', 'DANA hidden until the owner sets a number');

  const ok = await post(cookie, `/api/orders/${o.id}/manual`, { method: 'QRIS', proof_image: pngUrl });
  assert.equal(ok.status, 201);
  assert.equal(ok.json.payment.has_proof, true);
  assert.equal((await user('proof@example.test')).tier, 'FREE', 'nothing changes before approval');

  const listed = (await app.request('GET', '/owner/payments', { cookie: owner })).json.payments.find(p => p.id === ok.json.payment.id);
  assert.deepEqual([listed.has_proof, listed.duration_days, listed.payment_method], [true, 30, 'QRIS']);
  const img = await new Promise((resolve, reject) => {
    require('node:http').get(`${app.origin}/owner/payments/${ok.json.payment.id}/proof`, { headers: { cookie: owner } }, res => {
      const chunks = []; res.on('data', c => chunks.push(c)); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
  assert.equal(img.status, 200);
  assert.equal(img.headers['content-type'], 'image/png');
  assert.match(img.headers['content-security-policy'], /sandbox/);
  assert.ok(img.body.equals(PNG), 'exact bytes returned');
  assert.equal((await app.request('GET', `/owner/payments/${ok.json.payment.id}/proof`, { cookie })).status, 403);
});

it('Telegram: the owner gets the proof photo with order details; delivery failures never block the payment', async () => {
  telegramCalls.length = 0;
  telegramMode = 'ok';
  const cookie = await app.login('tele@example.test');
  const sent = await payManual(cookie, 'SEPUH', 90);
  assert.equal(sent.response.notification, 'sent');
  assert.equal(telegramCalls.length, 1);
  const call = telegramCalls[0];
  assert.match(call.url, /\/sendPhoto$/);
  assert.equal(call.chat, '777');
  assert.match(call.caption, new RegExp(sent.order.order_code));
  assert.match(call.caption, /SEPUH · 90 hari/);
  assert.match(call.caption, /Rp30\.000/);
  assert.match(call.caption, /tele@example\.test/);
  assert.equal(call.photo.type, 'image/png');
  assert.ok(Buffer.from(await call.photo.arrayBuffer()).equals(PNG));
  const row = (await h.db().query('SELECT owner_notified FROM payments WHERE id=$1', [sent.payment.id])).rows[0];
  assert.equal(row.owner_notified, 'telegram');

  // WhatsApp cannot be automated here: the buyer gets a prefilled wa.me link instead.
  assert.match(sent.response.links.whatsapp, /^https:\/\/wa\.me\/\d+\?text=/);
  assert.match(decodeURIComponent(sent.response.links.whatsapp), new RegExp(sent.order.order_code));

  for (const mode of ['rejected', 'down']) {
    telegramMode = mode;
    const c = await app.login(`tele-${mode}@example.test`);
    const r = await payManual(c, 'SULTAN', 30);
    assert.equal(r.response.notification, 'failed');
  }
  telegramMode = 'ok';
  assert.ok(!h.logs.join('\n').includes(BOT_TOKEN), 'bot token never logged');
});

it('QRIS gateway: the QR payload is rendered as an SVG for the buyer only; the owner can approve it by hand', async () => {
  const email = 'gw@example.test';
  const cookie = await app.login(email);
  const o = (await order(cookie, 'SULTAN', 30)).json.order;
  const original = axios.post;
  axios.post = async () => ({ data: { payment: { project: 'yannz-test-project', order_id: o.order_code, amount: 5000, total_payment: 5310, payment_method: 'qris', payment_number: '00020101021226610016ID.CO.SHOPEE.WWW', expired_at: new Date(Date.now() + 3600e3).toISOString() } } });
  try {
    const r = await post(cookie, `/api/orders/${o.id}/pakasir`, { method: 'qris' });
    assert.equal(r.status, 201, r.text);
  } finally {
    axios.post = original;
  }
  const qr = await app.request('GET', `/api/orders/${o.id}/qr.svg`, { cookie });
  assert.equal(qr.status, 200, qr.text);
  assert.match(qr.headers['content-type'], /image\/svg\+xml/);
  assert.match(qr.text, /^<svg/);
  const other = await app.login('gw-other@example.test');
  assert.equal((await app.request('GET', `/api/orders/${o.id}/qr.svg`, { cookie: other })).status, 404);

  const payment = (await app.request('GET', '/owner/payments', { cookie: owner })).json.payments.find(p => p.order_id === o.id);
  assert.equal(payment.provider, 'pakasir');
  assert.equal((await approve(payment.id)).status, 200);
  assert.equal((await user(email)).tier, 'SULTAN');
  assert.equal((await approve(payment.id)).status, 409, 'idempotent');
});

it('owner payment settings: DANA/GoPay appear for buyers once set; validation and owner-only', async () => {
  const cookie = await app.login('settings@example.test');
  const patch = (c, body) => app.request('PATCH', '/owner/server/payments', { cookie: c, headers: { origin: app.origin }, body });
  assert.equal((await patch(cookie, { payment_dana_number: '081234567890' })).status, 403);
  assert.equal((await patch(owner, { payment_dana_number: '12' })).json.error, 'INVALID_NUMBER');
  assert.equal((await patch(owner, { payment_dana_number: '0812-3456-7890', payment_dana_name: 'Yannz', payment_gopay_number: '', payment_gopay_name: '' })).status, 200);
  const methods = (await app.request('GET', '/api/orders', { cookie })).json.methods;
  assert.deepEqual(methods.DANA, { available: true, account: { number: '081234567890', name: 'Yannz' } });
  assert.deepEqual(methods.GOPAY, { available: false, account: null });
  const server = (await app.request('GET', '/owner/server', { cookie: owner })).json;
  assert.equal(server.settings.payment_dana_number, '081234567890');
  assert.equal(server.notifications.telegram, true);
  const o = (await order(cookie, 'SULTAN')).json.order;
  assert.equal((await post(cookie, `/api/orders/${o.id}/manual`, { method: 'DANA', proof_image: pngUrl })).status, 201);
});

it('owner tier changes can carry a duration; empty means permanent', async () => {
  const email = 'ownerset@example.test';
  await app.login(email);
  const id = (await user(email)).id;
  const set = body => app.request('PATCH', `/owner/users/${id}/tier`, { cookie: owner, headers: { origin: app.origin }, body });
  assert.equal((await set({ tier: 'DEWA', days: 10 })).status, 200);
  let u = await user(email);
  assert.ok(Math.abs(daysFromNow(u.tier_expires_at) - 10) < 0.01);
  assert.equal((await set({ tier: 'SEPUH' })).status, 200);
  u = await user(email);
  assert.deepEqual([u.tier, u.tier_expires_at], ['SEPUH', null]);
  assert.equal((await set({ tier: 'SULTAN', days: 0 })).json.error, 'INVALID_DURATION');
});
