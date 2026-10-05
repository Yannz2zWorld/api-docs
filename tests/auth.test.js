'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { classifyGoogleVerifyError, classifyDatabaseError, missingAuthConfig } = require('../lib/authErrors');

const FAKE_JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJlbWFpbCI6InBlcnNvbkBleGFtcGxlLnRlc3QifQ.c2lnbmF0dXJl';

test('Google verification failures map to stable reasons without echoing the token', () => {
  const cases = [
    ['Wrong recipient, payload audience != requiredAudience', 'AUDIENCE_MISMATCH'],
    ['Token used too late, 2 > 1: {"email":"person@example.test"}', 'TOKEN_EXPIRED'],
    ['Token used too early, 2 < 1: {"email":"person@example.test"}', 'TOKEN_NOT_YET_VALID'],
    ['Invalid token signature: ' + FAKE_JWT, 'INVALID_SIGNATURE'],
    ['No pem found for envelope: {"kid":"x"}', 'INVALID_SIGNATURE'],
    ['Invalid issuer, expected one of [accounts.google.com], but got https://evil.example', 'ISSUER_MISMATCH'],
    ['Wrong number of segments in token: ' + FAKE_JWT, 'MALFORMED_TOKEN'],
    ['something new', 'UNKNOWN_VERIFY_ERROR']
  ];
  for (const [message, reason] of cases) {
    const c = classifyGoogleVerifyError(new Error(message));
    assert.equal(c.status, 401);
    assert.equal(c.error, 'INVALID_CREDENTIAL');
    assert.equal(c.reason, reason);
    const serialized = JSON.stringify(c);
    assert.doesNotMatch(serialized, /eyJ|person@example/);
  }
});

test('Google certificate/network failures are 503 GOOGLE_UNAVAILABLE, not a database error', () => {
  const byCode = classifyGoogleVerifyError(Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }));
  assert.deepEqual([byCode.status, byCode.error], [503, 'GOOGLE_UNAVAILABLE']);
  const byMessage = classifyGoogleVerifyError(new Error('Failed to retrieve verification certificates: request failed'));
  assert.deepEqual([byMessage.status, byMessage.error], [503, 'GOOGLE_UNAVAILABLE']);
});

test('database failures distinguish missing config, outdated schema, and outages', () => {
  assert.equal(classifyDatabaseError({ code: 'DATABASE_NOT_CONFIGURED' }).error, 'DATABASE_NOT_CONFIGURED');
  assert.equal(classifyDatabaseError({ code: '42703' }).error, 'DATABASE_SCHEMA_OUTDATED');
  assert.equal(classifyDatabaseError({ code: '42P01' }).error, 'DATABASE_SCHEMA_OUTDATED');
  assert.equal(classifyDatabaseError({ code: 'DATABASE_QUERY_FAILED' }).error, 'DATABASE_UNAVAILABLE');
  assert.equal(classifyDatabaseError({}).error, 'DATABASE_UNAVAILABLE');
  for (const code of ['42703', 'DATABASE_NOT_CONFIGURED', 'X']) assert.equal(classifyDatabaseError({ code }).status, 503);
});

test('missing auth configuration reports variable names only', () => {
  assert.deepEqual(missingAuthConfig({}), ['GOOGLE_CLIENT_ID', 'AUTH_SECRET']);
  assert.deepEqual(missingAuthConfig({ GOOGLE_CLIENT_ID: 'id', AUTH_SECRET: '  ' }), ['AUTH_SECRET']);
  assert.deepEqual(missingAuthConfig({ GOOGLE_CLIENT_ID: 'id', AUTH_SECRET: 's' }), []);
});

test('login page keeps auth server-side: real password endpoints, no client-side session flag', () => {
  const html = fs.readFileSync(path.join(__dirname, '../views/login.html'), 'utf8');
  assert.doesNotMatch(html, /sessionStorage|localStorage/);
  for (const endpoint of ['/auth/login', '/auth/register', '/auth/email/verify', '/auth/password/forgot', '/auth/password/reset', '/auth/google/credential']) {
    assert.ok(html.includes(endpoint), endpoint);
  }
  assert.match(html, /href="\/auth\/google"/);
  assert.match(html, /autocomplete="one-time-code"/);
});

test('password hashing uses scrypt with per-hash salt and constant-time verification', async () => {
  const pw = require('../services/passwordService');
  const a = await pw.hashPassword('Rahasia123');
  const b = await pw.hashPassword('Rahasia123');
  assert.match(a, /^scrypt\$17\$8\$1\$/);
  assert.notEqual(a, b, 'random salt');
  assert.equal(await pw.verifyPassword('Rahasia123', a), true);
  assert.equal(await pw.verifyPassword('rahasia123', a), false);
  assert.equal(await pw.verifyPassword('Rahasia123', 'garbage'), false);
  assert.equal(pw.passwordProblem('short1'), 'Sandi minimal 8 karakter.');
  assert.match(pw.passwordProblem('onlyletters'), /huruf dan angka/);
  assert.equal(pw.passwordProblem('valid12345'), null);
});

test('migrations create the users table before the platform migration references it', () => {
  const dir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  assert.deepEqual(files.slice(0, 2), ['001_users.sql', '002_platform.sql']);
  const users = fs.readFileSync(path.join(dir, '001_users.sql'), 'utf8').toLowerCase();
  assert.match(users, /create table if not exists users/);
  assert.match(users, /id uuid primary key/);
  assert.doesNotMatch(users, /\bdrop\b/);
});
