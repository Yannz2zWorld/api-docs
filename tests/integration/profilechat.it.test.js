'use strict';
// Profile (account name, password change), live chat room, owner password reset and activity log.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const h = require('./helpers');
const passwords = require(path.join(__dirname, '..', '..', 'services', 'passwordService'));

let app, owner, ana, bob;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  ana = await app.login('aghaabryan1234@example.test', { name: 'Agha Abryan' });
  bob = await app.login('bob.smith@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const as = (cookie, method, url, body) => app.request(method, url, { cookie, headers: { origin: app.origin }, body });
const setPassword = async (email, pw) => h.db().query('UPDATE users SET password_hash=$2,email_verified=true WHERE lower(email)=lower($1)', [email, await passwords.hashPassword(pw)]);
const passwordLogin = (email, password) => app.request('POST', '/auth/login', { headers: { origin: app.origin }, body: { email, password } });

it('profile shows the user ID, email and an account name derived from the email', async () => {
  const r = await as(ana, 'GET', '/api/profile');
  assert.equal(r.status, 200);
  const p = r.json.profile;
  assert.match(p.id, /^\d{8}$/, 'numeric user ID (migration 011)');
  assert.equal(Number(p.id), p.publicId);
  assert.match(p.internalId, /^[0-9a-f-]{36}$/);
  assert.equal(p.email, 'aghaabryan1234@example.test');
  assert.equal(p.accountName, 'Aghaabryan');
  assert.equal(p.defaultName, 'Aghaabryan');
  assert.equal((await as(bob, 'GET', '/api/profile')).json.profile.accountName, 'Bob');
});

it('the account name can be changed, validated, and reset to the derived one', async () => {
  assert.equal((await as(ana, 'PATCH', '/api/profile', { displayName: 'Agha' })).json.accountName, 'Agha');
  assert.equal((await as(ana, 'GET', '/api/profile')).json.profile.accountName, 'Agha');
  for (const bad of ['A', 'Owner', '<script>', 'x'.repeat(30)]) assert.equal((await as(ana, 'PATCH', '/api/profile', { displayName: bad })).json.error, 'INVALID_NAME', bad);
  assert.equal((await as(bob, 'PATCH', '/api/profile', { displayName: 'Bobby' })).json.accountName, 'Bobby');
  assert.equal((await as(bob, 'PATCH', '/api/profile', { displayName: '' })).json.accountName, 'Bob');
});

it('password change needs the current password, keeps this session and signs out the others', async () => {
  // A Google-only account creates its website password without an old one (keykinds.it covers
  // the creation); a weak one is still refused.
  assert.equal((await as(bob, 'POST', '/api/profile/password', { password: 'pendek' })).json.error, 'WEAK_PASSWORD', 'Google-only account');
  await setPassword('aghaabryan1234@example.test', 'LamaSekali1');
  const other = (await passwordLogin('aghaabryan1234@example.test', 'LamaSekali1')).headers['set-cookie'][0].split(';')[0];
  assert.equal((await as(ana, 'POST', '/api/profile/password', { current: 'salah123', password: 'BaruSekali9' })).json.error, 'WRONG_PASSWORD');
  assert.equal((await as(ana, 'POST', '/api/profile/password', { current: 'LamaSekali1', password: 'pendek' })).json.error, 'WEAK_PASSWORD');
  const ok = await as(ana, 'POST', '/api/profile/password', { current: 'LamaSekali1', password: 'BaruSekali9' });
  assert.equal(ok.status, 200);
  ana = ok.headers['set-cookie'][0].split(';')[0];
  assert.equal((await as(ana, 'GET', '/api/profile')).status, 200, 'this browser stays signed in');
  assert.equal((await as(other, 'GET', '/api/profile')).status, 401, 'other sessions are signed out');
  assert.equal((await passwordLogin('aghaabryan1234@example.test', 'BaruSekali9')).status, 200);
  assert.equal((await passwordLogin('aghaabryan1234@example.test', 'LamaSekali1')).status, 401);
});

it('live chat: messages carry the account name (never the email), new ones arrive after ?after=', async () => {
  const first = await as(ana, 'POST', '/api/chat', { body: 'Halo semua!' });
  assert.equal(first.status, 201);
  assert.equal(first.json.message.name, 'Agha');
  const seen = await as(bob, 'GET', '/api/chat');
  const msg = seen.json.messages.find(m => m.id === first.json.message.id);
  assert.deepEqual([msg.name, msg.body, msg.mine, msg.owner], ['Agha', 'Halo semua!', false, false]);
  assert.doesNotMatch(JSON.stringify(seen.json), /@example\.test/, 'no email in the chat feed');
  assert.ok(seen.json.online >= 1);
  await new Promise(r => setTimeout(r, 1600));
  const reply = await as(owner, 'POST', '/api/chat', { body: 'Selamat datang <b>semua</b>' });
  const after = await as(bob, 'GET', `/api/chat?after=${first.json.message.id}`);
  assert.deepEqual(after.json.messages.map(m => [m.body, m.owner]), [['Selamat datang <b>semua</b>', true]]);
  assert.equal(reply.json.message.owner, true);
});

it('live chat: validation, rate limit, delete own; owner deletes any', async () => {
  assert.equal((await as(bob, 'POST', '/api/chat', { body: '   ' })).json.error, 'INVALID_MESSAGE');
  assert.equal((await as(bob, 'POST', '/api/chat', { body: 'x'.repeat(501) })).json.error, 'INVALID_MESSAGE');
  const m1 = await as(bob, 'POST', '/api/chat', { body: 'satu' });
  assert.equal((await as(bob, 'POST', '/api/chat', { body: 'dua' })).json.error, 'CHAT_RATE_LIMIT', 'burst');
  const anaMsg = (await as(ana, 'GET', '/api/chat')).json.messages.find(m => m.name === 'Agha');
  assert.equal((await as(bob, 'DELETE', `/api/chat/${anaMsg.id}`)).status, 404, 'cannot delete someone else\'s message');
  assert.equal((await as(bob, 'DELETE', `/api/chat/${m1.json.message.id}`)).status, 200);
  assert.equal((await as(owner, 'DELETE', `/api/chat/${anaMsg.id}`)).status, 200);
  const feed = await as(bob, 'GET', '/api/chat');
  assert.ok(!feed.json.messages.some(m => m.id === anaMsg.id || m.id === m1.json.message.id));
  assert.ok(feed.json.deleted.includes(anaMsg.id));
  assert.equal((await app.request('GET', '/api/chat')).status, 401, 'signed-in users only');
  const csrf = await app.request('POST', '/api/chat', { cookie: bob, headers: { origin: 'https://evil.example' }, body: { body: 'x' } });
  assert.equal(csrf.status, 403);
});

it('owner resets a password by email or ID (generated or typed); the user is signed out', async () => {
  const bobRow = await h.userByEmail('bob.smith@example.test');
  const gen = await as(owner, 'POST', '/owner/users/reset-password', { user: 'BOB.SMITH@example.test' });
  assert.equal(gen.status, 200);
  assert.match(gen.json.password, /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{12}$/);
  assert.equal((await as(bob, 'GET', '/api/profile')).status, 401, 'old sessions signed out');
  assert.equal((await passwordLogin('bob.smith@example.test', gen.json.password)).status, 200);
  const typed = await as(owner, 'POST', '/owner/users/reset-password', { user: bobRow.id, password: 'PilihanOwner7' });
  assert.equal(typed.json.password, null);
  assert.equal((await passwordLogin('bob.smith@example.test', 'PilihanOwner7')).status, 200);
  assert.equal((await as(owner, 'POST', '/owner/users/reset-password', { user: 'nobody@example.test' })).json.error, 'USER_NOT_FOUND');
  assert.equal((await as(owner, 'POST', '/owner/users/reset-password', { user: h.OWNER_EMAIL })).json.error, 'SELF_ACTION_BLOCKED');
  assert.equal((await as(owner, 'POST', '/owner/users/reset-password', { user: bobRow.id, password: 'weak' })).json.error, 'WEAK_PASSWORD');
  const fresh = (await passwordLogin('bob.smith@example.test', 'PilihanOwner7')).headers['set-cookie'][0].split(';')[0];
  assert.equal((await as(fresh, 'POST', '/owner/users/reset-password', { user: 'aghaabryan1234@example.test' })).json.error, 'OWNER_REQUIRED');
  const audit = await h.db().query("SELECT count(*)::int AS n FROM audit_logs WHERE action='owner_password_reset' AND target_id=$1", [bobRow.id]);
  assert.equal(audit.rows[0].n, 2);
});

it('owner activity shows account events, API calls and page visits, filterable by user', async () => {
  const anaRow = await h.userByEmail('aghaabryan1234@example.test');
  await app.request('GET', '/api/tools/ping', app.asBrowser(ana));
  await app.request('GET', '/home', { cookie: ana });
  const all = await as(owner, 'GET', '/owner/activity?q=aghaabryan');
  assert.equal(all.status, 200);
  const kinds = new Set(all.json.activity.map(a => a.kind));
  assert.ok(kinds.has('api') && kinds.has('page') && kinds.has('account'), [...kinds].join());
  const api = await as(owner, 'GET', '/owner/activity?kind=api&q=aghaabryan');
  assert.ok(api.json.activity.every(a => a.kind === 'api' && a.user_id === anaRow.id));
  assert.ok(api.json.activity.some(a => a.what === '/api/tools/ping' && a.status === 200));
  assert.equal((await as(ana, 'GET', '/owner/activity')).json.error, 'OWNER_REQUIRED');
});
