'use strict';
// The CDN page (/upload) needs an account: visitors who aren't signed in go to the login page with
// ?next=/upload, which tells them to sign in with Google first and comes back to the CDN after
// sign-in, both with the Google button (credential) and the Google redirect flow.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');

const ROOT = path.join(__dirname, '..', '..');
const view = f => fs.readFileSync(path.join(ROOT, 'views', f), 'utf8');
const cookies = r => (r.headers['set-cookie'] || []).map(c => c.split(';')[0]);
let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('not signed in: the CDN page sends you to the login page, which asks for Google sign-in first', async () => {
  const anon = await app.request('GET', '/upload', {});
  assert.deepEqual([anon.status, anon.headers.location], [302, '/?next=%2Fupload']);
  assert.equal((await app.request('GET', '/keys', {})).headers.location, '/?next=%2Fkeys');
  const login = view('login.html');
  assert.match(login, /Login pakai Google dulu buat akses CDN\./);
  assert.match(login, /\$\('#google-fallback'\)\.href='\/auth\/google\?next='/, 'the Google button keeps the way back');
  assert.match(login, /NEEDS_LOGIN=\[[^\]]*'\/upload'/, 'passing the robot check alone does not leave the login page');
  const en = JSON.parse(view('i18n-en.json')).exact;
  assert.equal(en['Login pakai Google dulu buat akses CDN.'], 'Sign in with Google first to use the CDN.');
});

it('Google redirect flow: after sign-in you land back on the CDN page', async () => {
  const start = await app.request('GET', '/auth/google?next=%2Fupload');
  assert.equal(start.status, 302);
  const sent = cookies(start);
  assert.ok(sent.some(c => c.startsWith('oauth_state=')), 'state cookie still set');
  assert.ok(sent.includes('oauth_next=%2Fupload'), sent.join(' '));
  const state = new URL(start.headers.location).searchParams.get('state');

  const { OAuth2Client } = require(path.join(ROOT, 'node_modules', 'google-auth-library'));
  const original = OAuth2Client.prototype.getToken;
  try {
    OAuth2Client.prototype.getToken = async () => ({ tokens: { access_token: 'stub', id_token: h.idToken({ sub: 'cdn-next-sub', email: 'cdnnext@example.test' }) } });
    const cb = await app.request('GET', `/auth/google/callback?code=c&state=${state}`, { cookie: sent.join('; ') });
    assert.deepEqual([cb.status, cb.headers.location], [302, '/upload']);
    const back = cookies(cb);
    assert.ok(back.includes('oauth_next=') && back.includes('oauth_state='), 'the one-time cookies are cleared');
    const session = back.find(c => c.startsWith('yannz_session=') && c !== 'yannz_session=');
    assert.equal((await app.request('GET', '/upload', { cookie: session })).status, 200);

    // Only pages on this site: anything else is ignored and sign-in goes Home as before.
    for (const bad of ['//evil.test', 'https://evil.test/upload', '/\\evil.test', '/upload?x=1']) {
      const s = await app.request('GET', '/auth/google?next=' + encodeURIComponent(bad));
      assert.ok(!cookies(s).some(c => c.startsWith('oauth_next=')), bad);
      const st = new URL(s.headers.location).searchParams.get('state');
      const r = await app.request('GET', `/auth/google/callback?code=c&state=${st}`, { cookie: cookies(s).join('; ') + '; oauth_next=%2F%2Fevil.test' });
      assert.equal(r.headers.location, '/home', bad);
    }
  } finally {
    OAuth2Client.prototype.getToken = original;
  }
});
