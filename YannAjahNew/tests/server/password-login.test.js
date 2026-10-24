'use strict';
// Login website email + password: developer membuat akun pembeli, pembeli (reseller ke atas) masuk.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let t, dev;
before(async () => {
  if (h.skip) return;
  t = await h.setup();
  dev = await t.login(await t.account('DEVELOPER'));
});
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

let seq = 0;
const uniq = () => `${Date.now().toString(36)}${(seq++).toString(36)}`;
async function buyer(rank = 'RESELLER', password = 'PembeliAman123', as = dev) {
  const u = uniq();
  const res = await t.as(as).post('/api/dash/accounts', { username: `pb-${u}`, email: `pembeli.${u}@example.test`, password, rank });
  assert.equal(res.status, 200, res.text);
  return { ...res.json.account, password };
}
const login = (email, password, extra = {}) => t.request('POST', '/auth/login', { body: { email, password }, ...extra });
const sid = r => (r.headers.getSetCookie() || []).find(c => c.startsWith('yan_sid='))?.split(';')[0];

it('developer membuat akun reseller dengan email + password; pembeli login dan melihat dashboard sesuai rank', async () => {
  const b = await buyer('RESELLER');
  assert.equal(b.password_set, true);
  const r = await login(b.email, b.password);
  assert.equal(r.status, 200, r.text);
  assert.equal(r.json.redirect, '/dashboard');
  const cookie = sid(r);
  assert.ok(cookie, 'sesi dibuat');
  const me = await t.request('GET', '/api/dash/me', { cookie });
  assert.equal(me.json.account.rank, 'RESELLER');
  assert.equal(me.json.quota.numbers.label, '0/10');
  const row = (await t.db.query("SELECT provider FROM dashboard_sessions WHERE account_id = $1 ORDER BY id DESC LIMIT 1", [b.id]))[0];
  assert.equal(row.provider, 'password');
});

it('email tidak terdaftar dan password salah mendapat pesan yang sama (tidak bisa menebak email)', async () => {
  const b = await buyer();
  const wrong = await login(b.email, 'SalahPassword99');
  const unknown = await login(`tidak.ada.${uniq()}@example.test`, 'SalahPassword99');
  assert.equal(wrong.status, 401); assert.equal(unknown.status, 401);
  assert.equal(wrong.json.error, 'INVALID_CREDENTIALS');
  assert.equal(wrong.json.message, unknown.json.message);
  assert.ok(!sid(wrong));
});

it('MEMBER dengan password benar tetap tidak bisa masuk website', async () => {
  const m = await buyer('MEMBER');
  const r = await login(m.email, m.password);
  assert.equal(r.status, 403); assert.equal(r.json.error, 'WEB_ACCESS_DENIED');
  assert.ok(!sid(r));
});

it('akun nonaktif/banned ditolak walau password benar', async () => {
  const b = await buyer();
  await t.as(dev).post(`/api/dash/accounts/${b.id}/status`, { status: 'banned', reason: 'melanggar aturan' });
  const r = await login(b.email, b.password);
  assert.equal(r.status, 403); assert.equal(r.json.error, 'ACCOUNT_RESTRICTED');
});

it('5x salah password: akun dikunci sementara, password benar pun ditolak', async () => {
  const b = await buyer();
  for (let i = 0; i < 5; i++) assert.equal((await login(b.email, `Salah${i}xxxxxx`)).status, 401);
  const r = await login(b.email, b.password);
  assert.equal(r.status, 429); assert.equal(r.json.error, 'TOO_MANY_ATTEMPTS');
  const row = (await t.db.query('SELECT failed_logins, locked_until > now() AS locked FROM accounts WHERE id = $1', [b.id]))[0];
  assert.equal(row.locked, true);
});

it('atasan reset password bawahan: password lama tidak berlaku, sesi lama dicabut', async () => {
  const suki = await t.login(await buyer('SUKI'));
  const res = await buyer('RESELLER', 'PasswordLama123', suki);
  const old = sid(await login(res.email, 'PasswordLama123'));
  const reset = await t.as(suki).post(`/api/dash/accounts/${res.id}/password`, { password: 'PasswordBaru456' });
  assert.equal(reset.status, 200, reset.text);
  assert.equal((await t.request('GET', '/api/dash/me', { cookie: old })).status, 401, 'sesi lama dicabut');
  assert.equal((await login(res.email, 'PasswordLama123')).status, 401);
  assert.equal((await login(res.email, 'PasswordBaru456')).status, 200);
});

it('reset password hanya untuk akun di bawahnya', async () => {
  const r1 = await t.login(await buyer('RESELLER'));
  const r2 = await buyer('RESELLER');
  const other = await t.as(r1).post(`/api/dash/accounts/${r2.id}/password`, { password: 'Bajakan12345' });
  assert.equal(other.status, 403);
  const up = await t.as(r1).post(`/api/dash/accounts/${dev.id}/password`, { password: 'Bajakan12345' });
  assert.equal(up.status, 403); assert.equal(up.json.error, 'RANK_HIERARCHY');
});

it('ganti password sendiri: wajib password lama; perangkat lain dikeluarkan, sesi ini tetap', async () => {
  const b = await buyer('RESELLER', 'PunyaSaya1234');
  const a = sid(await login(b.email, 'PunyaSaya1234'));
  const other = sid(await login(b.email, 'PunyaSaya1234'));
  const csrf = (await t.request('GET', '/api/dash/me', { cookie: a })).json.csrfToken;
  const bad = await t.request('POST', '/api/dash/me/password', { cookie: a, csrf, body: { current_password: 'Keliru123456', new_password: 'BaruSekali123' } });
  assert.equal(bad.status, 400); assert.equal(bad.json.error, 'WRONG_PASSWORD');
  const ok = await t.request('POST', '/api/dash/me/password', { cookie: a, csrf, body: { current_password: 'PunyaSaya1234', new_password: 'BaruSekali123' } });
  assert.equal(ok.status, 200, ok.text);
  assert.equal((await t.request('GET', '/api/dash/me', { cookie: a })).status, 200, 'sesi ini tetap');
  assert.equal((await t.request('GET', '/api/dash/me', { cookie: other })).status, 401, 'perangkat lain keluar');
  assert.equal((await login(b.email, 'BaruSekali123')).status, 200);
});

it('validasi: password lemah ditolak, password tanpa email ditolak', async () => {
  const weak = await t.as(dev).post('/api/dash/accounts', { username: `w-${uniq()}`, email: `w.${uniq()}@example.test`, password: 'pendek', rank: 'RESELLER' });
  assert.equal(weak.status, 400); assert.equal(weak.json.error, 'WEAK_PASSWORD');
  const noEmail = await t.as(dev).post('/api/dash/accounts', { username: `n-${uniq()}`, password: 'CukupPanjang123', rank: 'RESELLER' });
  assert.equal(noEmail.status, 400); assert.equal(noEmail.json.error, 'EMAIL_REQUIRED');
});

it('login dari website lain ditolak (Origin) dan password tidak pernah muncul di API maupun audit', async () => {
  const b = await buyer('RESELLER', 'RahasiaPembeli77');
  const evil = await login(b.email, b.password, { origin: 'https://evil.example' });
  assert.equal(evil.status, 403); assert.equal(evil.json.error, 'ORIGIN_REJECTED');
  const list = await t.as(dev).get('/api/dash/accounts');
  const text = JSON.stringify(list.json);
  assert.ok(!text.includes('RahasiaPembeli77') && !text.includes('password_hash') && !text.includes('$2'), 'hash/password tidak dikirim');
  const audits = JSON.stringify(await t.db.query('SELECT details FROM audit_logs'));
  assert.ok(!audits.includes('RahasiaPembeli77') && !audits.includes('$2'), 'audit bersih');
});
