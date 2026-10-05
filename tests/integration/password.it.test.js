'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

// Capture outgoing email by stubbing the Resend HTTP call (the app's real code path).
const outbox = [];
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.resend.com/')) {
    outbox.push(JSON.parse(opts.body));
    return new Response(JSON.stringify({ id: 'test' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(url, opts);
};
const codeFor = to => {
  const mail = [...outbox].reverse().find(m => m.to.includes(to));
  return mail && /Kode: (\d{6})/.exec(mail.text)[1];
};

let app;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp({ RESEND_API_KEY: 'test-only', EMAIL_FROM: 'no-reply@yannz.test' });
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { outbox.length = 0; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const post = (url, body, headers = {}) => app.request('POST', url, { body, headers: { origin: app.origin, ...headers } });
const cookieOf = r => r.headers['set-cookie']?.[0]?.split(';')[0];
async function registerVerified(name, email, password) {
  assert.equal((await post('/auth/register', { name, email, password })).status, 201);
  const r = await post('/auth/email/verify', { email, code: codeFor(email) });
  assert.equal(r.status, 200);
  return cookieOf(r);
}

it('register sends a YannApi verification code; login is blocked until verified', async () => {
  const r = await post('/auth/register', { name: 'Ana Dev', email: 'Ana@Example.test', password: 'rahasia123' });
  assert.equal(r.status, 201);
  assert.equal(r.json.verificationRequired, true);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].from, 'YannApi <no-reply@yannz.test>');
  assert.deepEqual(outbox[0].to, ['ana@example.test']);
  assert.match(outbox[0].subject, /verifikasi/i);
  const stored = await h.userByEmail('ana@example.test');
  assert.match(stored.password_hash, /^scrypt\$17\$8\$1\$/);
  assert.ok(!JSON.stringify(stored).includes('rahasia123'));
  assert.equal(stored.email_verified, false);

  const early = await post('/auth/login', { email: 'ana@example.test', password: 'rahasia123' });
  assert.deepEqual([early.status, early.json.error], [403, 'EMAIL_NOT_VERIFIED']);
  assert.equal(early.headers['set-cookie'], undefined);

  assert.equal((await post('/auth/email/verify', { email: 'ana@example.test', code: '000000' })).json.error, 'INVALID_CODE');
  const ok = await post('/auth/email/verify', { email: 'ana@example.test', code: codeFor('ana@example.test') });
  assert.equal(ok.status, 200);
  const me = await app.request('GET', '/auth/me', { cookie: cookieOf(ok) });
  assert.deepEqual([me.status, me.json.user.email, me.json.user.provider, me.json.user.tier], [200, 'ana@example.test', 'password', 'FREE']);
  assert.equal((await post('/auth/email/verify', { email: 'ana@example.test', code: codeFor('ana@example.test') })).status, 400, 'codes are single-use');
});

it('login: correct password works; wrong password and unknown email get the same answer', async () => {
  await registerVerified('Budi', 'budi@example.test', 'kuatSekali9');
  const ok = await post('/auth/login', { email: 'BUDI@example.test', password: 'kuatSekali9' });
  assert.equal(ok.status, 200);
  assert.equal((await app.request('GET', '/auth/me', { cookie: cookieOf(ok) })).status, 200);
  const wrong = await post('/auth/login', { email: 'budi@example.test', password: 'salahSekali9' });
  const unknown = await post('/auth/login', { email: 'nobody@example.test', password: 'salahSekali9' });
  assert.deepEqual([wrong.status, wrong.json.error, wrong.json.message], [unknown.status, unknown.json.error, unknown.json.message]);
  assert.deepEqual([wrong.status, wrong.json.error], [401, 'INVALID_LOGIN']);
});

it('registration validation: weak password, bad email, short name, duplicate email', async () => {
  assert.equal((await post('/auth/register', { name: 'X Y', email: 'v1@example.test', password: 'short1' })).json.error, 'WEAK_PASSWORD');
  assert.equal((await post('/auth/register', { name: 'X Y', email: 'v1@example.test', password: 'onlyletters' })).json.error, 'WEAK_PASSWORD');
  assert.equal((await post('/auth/register', { name: 'X Y', email: 'not-an-email', password: 'valid12345' })).json.error, 'INVALID_EMAIL');
  assert.equal((await post('/auth/register', { name: 'X', email: 'v1@example.test', password: 'valid12345' })).json.error, 'INVALID_NAME');
  await post('/auth/register', { name: 'First', email: 'dup@example.test', password: 'valid12345' });
  const dup = await post('/auth/register', { name: 'Second', email: 'DUP@example.test', password: 'other12345' });
  assert.deepEqual([dup.status, dup.json.error], [409, 'EMAIL_TAKEN']);
});

it('forgot password: generic answer, code by email, reset revokes old sessions and old password', async () => {
  const oldCookie = await registerVerified('Citra', 'citra@example.test', 'lamaSekali1');
  outbox.length = 0;
  const unknown = await post('/auth/password/forgot', { email: 'ghost@example.test' });
  const known = await post('/auth/password/forgot', { email: 'citra@example.test' });
  assert.deepEqual([unknown.status, unknown.json.message], [known.status, known.json.message], 'no account enumeration');
  assert.equal(outbox.length, 1);
  assert.deepEqual(outbox[0].to, ['citra@example.test']);
  assert.equal(outbox[0].from, 'YannApi <no-reply@yannz.test>');
  assert.match(outbox[0].subject, /reset sandi/i);
  assert.match(outbox[0].html, />\d{6}</);

  const code = codeFor('citra@example.test');
  assert.equal((await post('/auth/password/reset', { email: 'citra@example.test', code, password: 'pendek' })).json.error, 'WEAK_PASSWORD');
  const reset = await post('/auth/password/reset', { email: 'citra@example.test', code, password: 'baruSekali2' });
  assert.equal(reset.status, 200);
  assert.equal((await app.request('GET', '/auth/me', { cookie: oldCookie })).status, 401, 'old sessions are signed out');
  assert.equal((await app.request('GET', '/auth/me', { cookie: cookieOf(reset) })).status, 200);
  assert.equal((await post('/auth/login', { email: 'citra@example.test', password: 'lamaSekali1' })).status, 401);
  assert.equal((await post('/auth/login', { email: 'citra@example.test', password: 'baruSekali2' })).status, 200);
  assert.equal((await post('/auth/password/reset', { email: 'citra@example.test', code, password: 'lagiBaru33' })).json.error, 'INVALID_CODE', 'code is single-use');
});

it('reset codes: wrong guesses burn the code after 5 attempts; expired codes fail; resend is throttled', async () => {
  await registerVerified('Dedi', 'dedi@example.test', 'awalSekali1');
  outbox.length = 0;
  await post('/auth/password/forgot', { email: 'dedi@example.test' });
  const code = codeFor('dedi@example.test');
  await post('/auth/password/forgot', { email: 'dedi@example.test' });
  assert.equal(outbox.length, 1, 'second request within 60s does not send another email');
  const wrong = code === '123456' ? '654321' : '123456';
  for (let i = 0; i < 5; i++) await post('/auth/password/reset', { email: 'dedi@example.test', code: wrong, password: 'tebakan123' });
  assert.equal((await post('/auth/password/reset', { email: 'dedi@example.test', code, password: 'benar12345' })).json.error, 'INVALID_CODE', 'locked after 5 wrong guesses');

  const u = await h.userByEmail('dedi@example.test');
  await h.db().query("DELETE FROM auth_codes WHERE user_id=$1", [u.id]);
  await post('/auth/password/forgot', { email: 'dedi@example.test' });
  const fresh = codeFor('dedi@example.test');
  await h.db().query("UPDATE auth_codes SET expires_at=now()-interval '1 minute' WHERE user_id=$1", [u.id]);
  assert.equal((await post('/auth/password/reset', { email: 'dedi@example.test', code: fresh, password: 'benar12345' })).json.error, 'INVALID_CODE', 'expired');
});

it('a Google-only account can add a password through "Lupa sandi"', async () => {
  const g = await app.login('gina@example.test', { name: 'Gina' });
  assert.equal((await post('/auth/login', { email: 'gina@example.test', password: 'apaSaja123' })).status, 401);
  await post('/auth/password/forgot', { email: 'gina@example.test' });
  const r = await post('/auth/password/reset', { email: 'gina@example.test', code: codeFor('gina@example.test'), password: 'sandiGina1' });
  assert.equal(r.status, 200);
  assert.equal((await post('/auth/login', { email: 'gina@example.test', password: 'sandiGina1' })).status, 200);
  assert.equal((await app.request('GET', '/auth/me', { cookie: g })).status, 401, 'existing sessions signed out after setting a password');
  assert.equal((await app.request('GET', '/auth/me', { cookie: await app.login('gina@example.test') })).status, 200, 'Google login still works');
});

it('pre-registration hijack is blocked: Google login removes an unverified password set by someone else', async () => {
  await post('/auth/register', { name: 'Attacker', email: 'victim@example.test', password: 'attacker123' });
  const victim = await app.login('victim@example.test', { name: 'Victim' });
  assert.equal((await app.request('GET', '/auth/me', { cookie: victim })).status, 200);
  const attacker = await post('/auth/login', { email: 'victim@example.test', password: 'attacker123' });
  assert.deepEqual([attacker.status, attacker.json.error], [401, 'INVALID_LOGIN']);
  const row = await h.userByEmail('victim@example.test');
  assert.deepEqual([row.password_hash, row.email_verified], [null, true]);
});

it('registering OWNER_EMAIL grants nothing until the inbox owner verifies it', async () => {
  await post('/auth/register', { name: 'Fake Owner', email: h.OWNER_EMAIL, password: 'pretend123' });
  const r = await post('/auth/login', { email: h.OWNER_EMAIL, password: 'pretend123' });
  assert.deepEqual([r.status, r.json.error], [403, 'EMAIL_NOT_VERIFIED']);
});

it('10 wrong passwords lock the account for 15 minutes', async () => {
  await registerVerified('Eka', 'eka@example.test', 'benarSekali1');
  for (let i = 0; i < 10; i++) await post('/auth/login', { email: 'eka@example.test', password: 'salahTerus1' });
  const locked = await post('/auth/login', { email: 'eka@example.test', password: 'benarSekali1' });
  assert.deepEqual([locked.status, locked.json.error], [429, 'TOO_MANY_ATTEMPTS']);
});

it('cross-site login/register requests are blocked', async () => {
  for (const url of ['/auth/login', '/auth/register', '/auth/password/forgot', '/auth/password/reset']) {
    const r = await post(url, { email: 'x@example.test', password: 'abc12345', name: 'Xx' }, { origin: 'https://evil.example' });
    assert.deepEqual([r.status, r.json.error], [403, 'CSRF_BLOCKED'], url);
  }
});

it('without an email provider, register/forgot say so honestly instead of pretending', async () => {
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  try {
    assert.equal((await post('/auth/register', { name: 'No Mail', email: 'nomail@example.test', password: 'valid12345' })).json.error, 'EMAIL_NOT_CONFIGURED');
    assert.equal((await post('/auth/password/forgot', { email: 'budi@example.test' })).json.error, 'EMAIL_NOT_CONFIGURED');
    assert.equal(await h.userByEmail('nomail@example.test'), undefined, 'no unverifiable account is created');
  } finally {
    process.env.RESEND_API_KEY = saved;
  }
});

it('logs never contain passwords or codes', async () => {
  await post('/auth/register', { name: 'Log Check', email: 'logs@example.test', password: 'tidakBoleh9' });
  const code = codeFor('logs@example.test');
  const text = h.logs.join('\n');
  assert.ok(!text.includes('tidakBoleh9'));
  assert.ok(!text.includes(code));
});
