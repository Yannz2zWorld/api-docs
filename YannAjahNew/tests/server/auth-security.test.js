'use strict';
// Master prompt §15.B — autentikasi & keamanan.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const { hashPassword } = require('../../server/lib/security');

let t;
before(async () => { if (!h.skip) t = await h.setup(); });
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

async function botWithPassword(owner, password = 'BotPassword123', extra = {}) {
  const phone = h.phone();
  const bot = (await t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3) RETURNING id', [owner.id, 'Bot Test', phone]))[0];
  await t.db.query("INSERT INTO bot_credentials (bot_id, password_hash) VALUES ($1,$2)", [bot.id, await hashPassword(password, 10)]);
  if (extra.user) await t.db.query('UPDATE bots SET user_account_id = $1 WHERE id = $2', [extra.user.id, bot.id]);
  return { id: Number(bot.id), phone, password };
}
const botLogin = (phone, password, extra = {}) => t.request('POST', '/api/bot/auth/login', { body: { phone_number: phone, password, instance_id: extra.instance || h.instanceId(), ...extra } });

it('request tanpa autentikasi ditolak (dashboard & bot API)', async () => {
  for (const p of ['/api/dash/me', '/api/dash/accounts', '/api/dash/bots', '/api/dash/audit']) assert.equal((await t.request('GET', p)).status, 401, p);
  assert.equal((await t.request('POST', '/api/bot/auth/verify')).status, 401);
  assert.equal((await t.request('POST', '/api/bot/heartbeat', { headers: { authorization: 'Bearer yab_' + 'x'.repeat(43) }, body: {} })).status, 401);
});

it('login bot: nomor tidak terdaftar, password salah, dan password belum diset memberi error yang SAMA', async () => {
  const owner = await t.account('RESELLER');
  const bot = await botWithPassword(owner);
  const noPass = (await t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3) RETURNING phone_number', [owner.id, 'Tanpa Password', h.phone()]))[0].phone_number;
  const unknown = await botLogin('6289999999999', 'BotPassword123');
  const wrong = await botLogin(bot.phone, 'PasswordSalah999');
  const unset = await botLogin(noPass, 'BotPassword123');
  for (const r of [unknown, wrong, unset]) {
    assert.equal(r.status, 401);
    assert.deepEqual({ error: r.json.error, message: r.json.message }, { error: 'INVALID_CREDENTIALS', message: 'Nomor atau password salah.' });
  }
  const ok = await botLogin(bot.phone, bot.password);
  assert.equal(ok.status, 200, ok.text);
  assert.match(ok.json.token, /^yab_/);
  assert.equal(ok.json.state.allowed, true);
  // Hanya hash token yang disimpan.
  const stored = await t.db.query('SELECT token_hash FROM bot_sessions WHERE bot_id = $1', [bot.id]);
  assert.ok(stored.every(s => s.token_hash !== ok.json.token && /^[0-9a-f]{64}$/.test(s.token_hash)));
});

it('akun pemilik/pemakai disabled, suspended, banned -> login bot ditolak', async () => {
  for (const status of ['disabled', 'suspended', 'banned']) {
    const owner = await t.account('RESELLER', { status });
    const bot = await botWithPassword(owner);
    const r = await botLogin(bot.phone, bot.password);
    assert.equal(r.status, 403, status); assert.equal(r.json.error, 'OWNER_RESTRICTED');
  }
  const owner = await t.account('RESELLER');
  const user = await t.account('MEMBER', { manager: owner.id, status: 'banned' });
  const bot = await botWithPassword(owner, 'BotPassword123', { user });
  assert.equal((await botLogin(bot.phone, bot.password)).json.error, 'USER_RESTRICTED');
});

it('bot banned/disabled tidak bisa login, sesi aktifnya dicabut, dan heartbeat/verify menolak (sinkron dengan proses bot)', async () => {
  // Ban bot = permission DEVELOPER (rank v2).
  const ownerAcc = await t.account('DEVELOPER');
  const owner = await t.login(ownerAcc);
  const resellerAcc = await t.account('RESELLER', { manager: ownerAcc.id });
  const bot = await botWithPassword(resellerAcc);
  const instance = h.instanceId();
  const s = await botLogin(bot.phone, bot.password, { instance });
  const token = s.json.token;
  const auth = { authorization: `Bearer ${token}` };
  assert.equal((await t.request('POST', '/api/bot/heartbeat', { headers: auth, body: { instance_id: instance, connection_status: 'connected' } })).json.state.allowed, true);

  const ban = await t.as(owner).post(`/api/dash/bots/${bot.id}/ban`, { banned: true, reason: 'Spam ke banyak nomor' });
  assert.equal(ban.status, 200, ban.text);
  assert.equal(ban.json.bot.status, 'banned');
  const hb = await t.request('POST', '/api/bot/heartbeat', { headers: auth, body: { instance_id: instance, connection_status: 'connected' } });
  assert.equal(hb.status, 401); assert.equal(hb.json.error, 'SESSION_REVOKED'); assert.equal(hb.json.reason, 'bot_banned');
  const relogin = await botLogin(bot.phone, bot.password);
  assert.equal(relogin.status, 403); assert.equal(relogin.json.error, 'BOT_BANNED');
  assert.equal(relogin.json.ban_reason, 'Spam ke banyak nomor');
  const row = (await t.db.query('SELECT connection_status, banned_by, banned_at FROM bots WHERE id = $1', [bot.id]))[0];
  assert.equal(row.connection_status, 'disconnected');
  assert.equal(Number(row.banned_by), ownerAcc.id);
  assert.ok(row.banned_at);

  assert.equal((await t.as(owner).post(`/api/dash/bots/${bot.id}/ban`, { banned: false })).status, 200);
  assert.equal((await botLogin(bot.phone, bot.password)).status, 200, 'unban memulihkan akses');

  // disable oleh pemilik (reseller) juga memutus akses
  const reseller = await t.login(resellerAcc);
  assert.equal((await t.as(reseller).post(`/api/dash/bots/${bot.id}/enabled`, { enabled: false, reason: 'pindah server' })).status, 200);
  assert.equal((await botLogin(bot.phone, bot.password, { force: true })).json.error, 'BOT_DISABLED');
});

it('satu sesi WhatsApp tidak dipakai dua proses: instance lain yang masih hidup ditolak kecuali force', async () => {
  const owner = await t.account('RESELLER');
  const bot = await botWithPassword(owner);
  const a = await botLogin(bot.phone, bot.password);
  assert.equal(a.status, 200);
  const b = await botLogin(bot.phone, bot.password);
  assert.equal(b.status, 409); assert.equal(b.json.error, 'INSTANCE_ACTIVE');
  const forced = await botLogin(bot.phone, bot.password, { force: true });
  assert.equal(forced.status, 200);
  const old = await t.request('POST', '/api/bot/auth/verify', { headers: { authorization: `Bearer ${a.json.token}` } });
  assert.equal(old.json.error, 'SESSION_REVOKED');
});

it('rate limit / brute force login bot: kegagalan ke-6 untuk nomor yang sama diblokir walau password benar', async () => {
  const owner = await t.account('RESELLER');
  const bot = await botWithPassword(owner);
  for (let i = 0; i < 5; i++) assert.equal((await botLogin(bot.phone, 'Salah' + i + 'xxxxxxx')).status, 401);
  const blocked = await botLogin(bot.phone, bot.password);
  assert.equal(blocked.status, 429); assert.equal(blocked.json.error, 'TOO_MANY_ATTEMPTS');
  const attempts = await t.db.query("SELECT count(*)::int AS n FROM login_attempts WHERE kind = 'bot' AND success = false");
  assert.ok(attempts[0].n >= 6);
});

it('user tidak bisa menaikkan rank sendiri / mengelola akun setingkat', async () => {
  const p = await t.login(await t.account('SUKI'));
  const self = await t.as(p).post(`/api/dash/accounts/${p.id}/rank`, { rank: 'RAJA' });
  assert.equal(self.status, 403);
  const selfReseller = await t.as(p).post(`/api/dash/accounts/${p.id}/rank`, { rank: 'RESELLER' });
  assert.equal(selfReseller.status, 403, 'mengubah rank sendiri dalam bentuk apa pun ditolak');
  const dev1 = await t.login(await t.account('DEVELOPER'));
  const dev2 = await t.account('DEVELOPER');
  assert.equal((await t.as(dev1).post(`/api/dash/accounts/${dev2.id}/status`, { status: 'banned', reason: 'coba ban sesama' })).json.error, 'RANK_HIERARCHY');
  const dewa = await t.login(await t.account('DEWA'));
  const otherDewa = await t.account('DEWA', { manager: dewa.id });
  assert.equal((await t.as(dewa).post(`/api/dash/accounts/${otherDewa.id}/rank`, { rank: 'RAJA' })).json.error, 'RANK_HIERARCHY', 'DEWA tidak bisa mengelola DEWA lain');
  assert.equal((await t.as(dewa).post(`/api/dash/accounts/${dev2.id}/rank`, { rank: 'MEMBER' })).json.error, 'RANK_HIERARCHY', 'DEWA tidak bisa menurunkan DEVELOPER');
});

it('akun DEVELOPER tidak bisa dibuat lewat registrasi / API biasa', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  const viaApi = await t.as(dev).post('/api/dash/accounts', { username: 'calon-dev', rank: 'DEVELOPER' });
  assert.equal(viaApi.status, 403); assert.equal(viaApi.json.error, 'RANK_NOT_ASSIGNABLE');
  const member = await t.account('MEMBER', { manager: dev.id });
  assert.equal((await t.as(dev).post(`/api/dash/accounts/${member.id}/rank`, { rank: 'DEVELOPER' })).json.error, 'RANK_NOT_ASSIGNABLE');
  // Registrasi via Google selalu MEMBER.
  t.setIdToken(h.googleIdToken({ sub: 'google-sub-new-1', email: 'baru@gmail.example', nonce: 'NONCE_PLACEHOLDER' }));
  const start = await t.request('GET', '/auth/google');
  assert.equal(start.status, 302);
  const cookie = start.headers.getSetCookie().find(c => c.startsWith('yan_oauth=')).split(';')[0];
  const [state, nonce] = decodeURIComponent(cookie.split('=')[1]).split('.');
  const location = new URL(start.headers.get('location'));
  assert.equal(location.hostname, 'accounts.google.com');
  assert.equal(location.searchParams.get('state'), state);
  assert.equal(location.searchParams.get('nonce'), nonce);
  t.setIdToken(h.googleIdToken({ sub: 'google-sub-new-1', email: 'baru@gmail.example', nonce }));
  const cb = await t.request('GET', `/auth/google/callback?code=abc&state=${state}`, { cookie });
  assert.equal(cb.status, 302); assert.equal(cb.headers.get('location'), '/dashboard');
  const acc = (await t.db.query("SELECT rank_code, email_verified FROM accounts WHERE google_sub = 'google-sub-new-1'"))[0];
  assert.deepEqual(acc, { rank_code: 'MEMBER', email_verified: true });
});

it('Google OAuth: state salah, nonce salah, email belum terverifikasi, dan audience lain ditolak', async () => {
  const start = async () => {
    const r = await t.request('GET', '/auth/google');
    const cookie = r.headers.getSetCookie().find(c => c.startsWith('yan_oauth=')).split(';')[0];
    const [state, nonce] = decodeURIComponent(cookie.split('=')[1]).split('.');
    return { cookie, state, nonce };
  };
  let s = await start();
  t.setIdToken(h.googleIdToken({ sub: 'g-x', email: 'x@gmail.example', nonce: s.nonce }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=salah`, { cookie: s.cookie })).status, 400);
  s = await start();
  t.setIdToken(h.googleIdToken({ sub: 'g-x', email: 'x@gmail.example', nonce: 'nonce-lain' }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=${s.state}`, { cookie: s.cookie })).headers.get('location'), '/?auth=error');
  s = await start();
  t.setIdToken(h.googleIdToken({ sub: 'g-x', email: 'x@gmail.example', nonce: s.nonce, email_verified: false }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=${s.state}`, { cookie: s.cookie })).headers.get('location'), '/?auth=restricted');
  s = await start();
  t.setIdToken(h.googleIdToken({ sub: 'g-x', email: 'x@gmail.example', nonce: s.nonce, aud: 'aplikasi-lain.apps.googleusercontent.com' }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=${s.state}`, { cookie: s.cookie })).headers.get('location'), '/?auth=error');
  assert.equal((await t.db.query("SELECT count(*)::int AS n FROM accounts WHERE google_sub = 'g-x'"))[0].n, 0);
});

it('Google OAuth menautkan akun yang dibuat admin berdasarkan email terverifikasi; akun banned tidak bisa login', async () => {
  const pre = await t.account('RESELLER', { email: 'reseller.pre@example.test' });
  const r = await t.request('GET', '/auth/google');
  const cookie = r.headers.getSetCookie().find(c => c.startsWith('yan_oauth=')).split(';')[0];
  const [state, nonce] = decodeURIComponent(cookie.split('=')[1]).split('.');
  t.setIdToken(h.googleIdToken({ sub: 'g-pre', email: 'reseller.pre@example.test', nonce }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=${state}`, { cookie })).headers.get('location'), '/dashboard');
  const row = (await t.db.query('SELECT google_sub, rank_code FROM accounts WHERE id = $1', [pre.id]))[0];
  assert.deepEqual(row, { google_sub: 'g-pre', rank_code: 'RESELLER' });
  await t.db.query("UPDATE accounts SET status = 'banned', status_changed_at = now() WHERE id = $1", [pre.id]);
  const r2 = await t.request('GET', '/auth/google');
  const c2 = r2.headers.getSetCookie().find(c => c.startsWith('yan_oauth=')).split(';')[0];
  const [st2, n2] = decodeURIComponent(c2.split('=')[1]).split('.');
  t.setIdToken(h.googleIdToken({ sub: 'g-pre', email: 'reseller.pre@example.test', nonce: n2 }));
  assert.equal((await t.request('GET', `/auth/google/callback?code=a&state=${st2}`, { cookie: c2 })).headers.get('location'), '/?auth=restricted');
});

it('API langsung tidak bisa melewati permission UI; CSRF dan Origin wajib untuk mutasi', async () => {
  const m = await t.login(await t.account('MEMBER'));
  const ownerAcc = await t.account('RAJA');
  for (const [method, path, body] of [
    ['post', '/api/dash/accounts', { username: 'hacker1' }],
    ['put', '/api/dash/maintenance', { enabled: true }],
    ['get', '/api/dash/login-attempts'],
    ['get', '/api/dash/health'],
    ['get', '/api/dash/backup'],
    ['post', `/api/dash/accounts/${ownerAcc.id}/status`, { status: 'banned', reason: 'iseng' }]
  ]) assert.equal((await t.as(m)[method](path, body)).status, 403, `${method} ${path}`);
  const noCsrf = await t.request('POST', '/api/dash/bots', { cookie: m.cookie, body: { bot_name: 'x', phone_number: h.phone() } });
  assert.equal(noCsrf.json.error, 'CSRF_FAILED');
  const badOrigin = await t.request('POST', '/api/dash/bots', { cookie: m.cookie, csrf: m.csrf, origin: 'https://evil.example', body: {} });
  assert.equal(badOrigin.json.error, 'ORIGIN_REJECTED');
});

it('password, hash, token, google_sub tidak pernah dikembalikan API', async () => {
  const dev = await t.login(await t.account('DEVELOPER', { email: 'dev.leak@example.test' }));
  await t.db.query("UPDATE accounts SET google_sub = 'google-secret-sub' WHERE id = $1", [dev.id]);
  const created = await t.as(dev).post('/api/dash/bots', { bot_name: 'Leak', phone_number: h.phone(), password: 'RahasiaBot12345' });
  assert.equal(created.status, 200, created.text);
  const reset = await t.as(dev).post(`/api/dash/bots/${created.json.bot.id}/password`, { password: 'RahasiaBaru54321' });
  const responses = [created, reset, await t.as(dev).get('/api/dash/bots'), await t.as(dev).get('/api/dash/accounts'), await t.as(dev).get('/api/dash/me'), await t.as(dev).get('/api/dash/audit')];
  for (const r of responses) {
    for (const needle of ['RahasiaBot12345', 'RahasiaBaru54321', '$2a$', '$2b$', 'password_hash', 'token_hash', 'google-secret-sub', 'session_ref']) {
      assert.ok(!r.text.includes(needle), `respons bocor: ${needle}`);
    }
  }
});

it('rate limit endpoint login bekerja (lapisan in-memory)', async () => {
  let last;
  for (let i = 0; i < 45; i++) last = await t.request('POST', '/api/bot/auth/login', { body: { phone_number: '6280000000', password: 'x', instance_id: h.instanceId() } });
  assert.equal(last.status, 429);
});
