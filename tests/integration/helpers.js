'use strict';
// Integration test harness: runs the real app (index.js) against a disposable PostgreSQL
// schema. The Neon HTTP driver is replaced by a `pg`-backed shim with the same
// query()/transaction() surface; Google ID tokens are real RS256 JWTs verified by
// google-auth-library, with only the Google signing-certificate download stubbed.
//
// Requires TEST_DATABASE_URL (a database you can create/drop schemas in). Never point
// it at production: every run creates and drops its own schema.
const Module = require('node:module');
const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs');
const http = require('node:http');

const ROOT = path.join(__dirname, '..', '..');
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || '';
const skip = TEST_DATABASE_URL ? false : 'TEST_DATABASE_URL not set (integration tests need a disposable PostgreSQL)';
const CLIENT_ID = 'integration-test.apps.googleusercontent.com';
const OWNER_EMAIL = 'owner@example.test';
const WEB_CLIENT_HEADER = { 'x-yannz-client': 'web' };

let pool;
let schema;
const logs = [];

function sqlError(e) {
  const err = new Error(e.message);
  err.name = 'NeonDbError';
  err.code = e.code;
  return err;
}

function neonShim() {
  const query = (text, params = []) => ({
    text,
    params,
    then(resolve, reject) {
      return pool.query(text, params).then(r => r.rows, e => { throw sqlError(e); }).then(resolve, reject);
    }
  });
  const transaction = async queries => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const out = [];
      for (const q of queries) out.push((await client.query(q.text, q.params)).rows);
      await client.query('COMMIT');
      return out;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw sqlError(e);
    } finally {
      client.release();
    }
  };
  return { query, transaction };
}

async function setupDatabase() {
  const { Pool } = require('pg');
  schema = 'it_' + crypto.randomBytes(6).toString('hex');
  const admin = new Pool({ connectionString: TEST_DATABASE_URL, max: 1 });
  await admin.query('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public').catch(() => {});
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.end();
  pool = new Pool({ connectionString: TEST_DATABASE_URL, max: 30, options: `-c search_path=${schema},public` });
  const dir = path.join(ROOT, 'migrations');
  for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    await pool.query(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return pool;
}

async function teardownDatabase() {
  if (!pool) return;
  await pool.query(`DROP SCHEMA ${schema} CASCADE`).catch(() => {});
  await pool.end();
}

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const KID = 'integration-kid';
function idToken(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://accounts.google.com', aud: CLIENT_ID, email_verified: true, iat: now, exp: now + 3600, ...claims };
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const head = b64({ alg: 'RS256', kid: KID, typ: 'JWT' }) + '.' + b64(payload);
  return head + '.' + crypto.sign('RSA-SHA256', Buffer.from(head), privateKey).toString('base64url');
}

async function startApp(env = {}) {
  Object.assign(process.env, {
    DATABASE_URL: 'postgresql://neon-shim.invalid/db',
    GOOGLE_CLIENT_ID: CLIENT_ID,
    AUTH_SECRET: 'integration-test-secret-'.padEnd(48, 'x'),
    OWNER_EMAIL,
    RATE_LIMIT_PER_MINUTE: '100000',
    AUTH_RATE_LIMIT_PER_15MIN: '100000'
  }, env);
  const originalLoad = Module._load;
  Module._load = function (request, ...rest) {
    if (request === '@neondatabase/serverless') return { neon: () => neonShim() };
    return originalLoad.call(this, request, ...rest);
  };
  const { google } = require(path.join(ROOT, 'node_modules', 'googleapis'));
  google.auth.OAuth2.prototype.getFederatedSignonCertsAsync = async () => ({ certs: { [KID]: publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM' });
  for (const level of ['log', 'warn', 'error']) console[level] = (...a) => logs.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));

  const app = require(path.join(ROOT, 'index.js'));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;

  function request(method, url, { body, headers = {}, cookie } = {}) {
    return new Promise((resolve, reject) => {
      const data = body === undefined ? null : Buffer.from(JSON.stringify(body));
      const req = http.request(origin + url, {
        method,
        headers: {
          ...(data ? { 'content-type': 'application/json', 'content-length': data.length } : {}),
          ...(cookie ? { cookie } : {}),
          ...headers
        }
      }, res => {
        let text = '';
        res.on('data', c => { text += c; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(text); } catch {}
          resolve({ status: res.statusCode, headers: res.headers, json, text });
        });
      });
      req.on('error', reject);
      if (data) req.write(data);
      req.end();
    });
  }

  async function login(email, { sub = 'sub-' + email, name = email.split('@')[0] } = {}) {
    const r = await request('POST', '/auth/google/credential', { body: { credential: idToken({ sub, email, name }) }, headers: { origin } });
    if (r.status !== 200) throw new Error(`login failed for ${email}: ${r.status} ${r.text}`);
    return r.headers['set-cookie'][0].split(';')[0];
  }

  // Same-origin browser call made with the session cookie (what the sandbox does).
  const asBrowser = (cookie, extra = {}) => ({ cookie, headers: { origin, ...WEB_CLIENT_HEADER, ...extra } });

  return { app, origin, request, login, asBrowser, close: () => new Promise(r => server.close(r)) };
}

async function userByEmail(email) {
  return (await pool.query('SELECT * FROM users WHERE lower(email)=lower($1)', [email])).rows[0];
}
async function setTier(email, tier) {
  await pool.query('UPDATE users SET tier=$2 WHERE lower(email)=lower($1)', [email, tier]);
}
async function usedToday(userId) {
  const r = await pool.query("SELECT COALESCE(sum(request_count),0)::int AS n FROM daily_quota_counters WHERE user_id=$1 AND usage_date=(now() AT TIME ZONE 'UTC')::date", [userId]);
  return r.rows[0].n;
}
const db = () => pool;

module.exports = { skip, setupDatabase, teardownDatabase, startApp, idToken, userByEmail, setTier, usedToday, db, logs, OWNER_EMAIL, WEB_CLIENT_HEADER };
