'use strict';
// Harness test backend: app asli (server/app.js) terhadap schema PostgreSQL sekali pakai.
// Butuh TEST_DATABASE_URL (database yang boleh dibuat/dihapus schema-nya). JANGAN arahkan ke production:
// setiap run membuat dan menghapus schema-nya sendiri. Ditolak kalau sama dengan DATABASE_URL.
// Google ID token = JWT RS256 asli yang diverifikasi google-auth-library; hanya unduhan sertifikat
// Google dan token endpoint yang di-stub (tidak ada request keluar).

const crypto = require('crypto');
const http = require('http');
const { OAuth2Client } = require('google-auth-library');
const { createDb } = require('../../server/lib/db');
const { migrate } = require('../../server/lib/migrate');
const { createApp } = require('../../server/app');
const { createGoogle } = require('../../server/lib/google');
const { sha256 } = require('../../server/lib/security');

const URL_ = process.env.TEST_DATABASE_URL || '';
const skip = !URL_ ? 'TEST_DATABASE_URL tidak diset (test backend butuh PostgreSQL sekali pakai)'
  : (process.env.DATABASE_URL && process.env.DATABASE_URL === URL_ ? 'TEST_DATABASE_URL sama dengan DATABASE_URL — ditolak demi keamanan data' : false);

const CLIENT_ID = 'yannajah-test.apps.googleusercontent.com';
const KID = 'yannajah-test-kid';
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
OAuth2Client.prototype.getFederatedSignonCertsAsync = async () => ({ certs: { [KID]: publicKey.export({ type: 'spki', format: 'pem' }) }, format: 'PEM' });
let nextIdToken = null;
OAuth2Client.prototype.getToken = async function () { return { tokens: { id_token: nextIdToken } }; };

function googleIdToken(claims) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: 'https://accounts.google.com', aud: CLIENT_ID, email_verified: true, iat: now, exp: now + 3600, ...claims };
  const head = b64({ alg: 'RS256', kid: KID, typ: 'JWT' }) + '.' + b64(payload);
  return head + '.' + crypto.sign('RSA-SHA256', Buffer.from(head), privateKey).toString('base64url');
}

async function setup({ cfgOverrides = {} } = {}) {
  const schema = 'yt_' + crypto.randomBytes(6).toString('hex');
  const admin = createDb({ connectionString: URL_, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  await admin.close();
  const db = createDb({ connectionString: URL_, schema, max: 40 });
  await migrate(db);
  const cfg = {
    production: false, host: '127.0.0.1', port: 0, publicUrl: 'http://127.0.0.1', origin: null, secureCookies: false, trustProxy: false,
    sessionSecret: crypto.randomBytes(32).toString('hex'), openSignup: true, adminSessionHours: 12, botSessionDays: 30, bcryptCost: 10,
    backupKey: 'test-backup-key-0123456789', google: { clientId: CLIENT_ID, clientSecret: 'test-secret', callbackUrl: 'http://127.0.0.1/auth/google/callback' },
    ...cfgOverrides
  };
  const server = http.createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  cfg.origin = origin; cfg.publicUrl = origin;
  const app = createApp({ db, cfg, googleClient: createGoogle(cfg.google), logger: { error() {} } });
  server.on('request', app);

  async function request(method, path, { cookie, csrf, body, headers = {}, origin: o = origin } = {}) {
    const h = { ...headers };
    if (cookie) h.cookie = cookie;
    if (csrf) h['x-csrf-token'] = csrf;
    if (body !== undefined) h['content-type'] = 'application/json';
    if (o && !['GET', 'HEAD'].includes(method)) h.origin = o;
    const res = await fetch(origin + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const text = await res.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: res.status, json, text, headers: res.headers };
  }

  // Akun langsung lewat SQL (seed test), lalu sesi lewat link login sekali pakai (alur asli).
  let seq = 0;
  async function account(rank = 'MEMBER', { manager = null, status = 'active', email } = {}) {
    seq++;
    const u = `u${seq}-${rank.toLowerCase()}`;
    const row = (await db.query(`INSERT INTO accounts (username, email, rank_code, manager_id, status, status_changed_at) VALUES ($1,$2,$3,$4,$5, CASE WHEN $5 = 'active' THEN NULL ELSE now() END) RETURNING id`,
      [u, email || `${u}@example.test`, rank, manager, status]))[0];
    return { id: Number(row.id), username: u };
  }

  async function login(acc) {
    const token = 'yal_' + crypto.randomBytes(32).toString('base64url');
    await db.query("INSERT INTO login_links (account_id, token_hash, expires_at) VALUES ($1,$2, now() + interval '10 minutes')", [acc.id, sha256(token)]);
    const r = await request('GET', `/auth/link?token=${token}`);
    const set = r.headers.getSetCookie().find(c => c.startsWith('yan_sid='));
    if (!set) throw new Error('login gagal: ' + r.status + ' ' + r.text);
    const cookie = set.split(';')[0];
    const me = await request('GET', '/api/dash/me', { cookie });
    return { ...acc, cookie, csrf: me.json.csrfToken };
  }

  const as = s => ({
    get: p => request('GET', p, { cookie: s.cookie }),
    post: (p, body = {}) => request('POST', p, { cookie: s.cookie, csrf: s.csrf, body }),
    put: (p, body = {}) => request('PUT', p, { cookie: s.cookie, csrf: s.csrf, body }),
    patch: (p, body = {}) => request('PATCH', p, { cookie: s.cookie, csrf: s.csrf, body }),
    del: p => request('DELETE', p, { cookie: s.cookie, csrf: s.csrf })
  });

  async function close() {
    await new Promise(r => server.close(r));
    await db.query(`DROP SCHEMA ${schema} CASCADE`).catch(() => {});
    await db.close();
  }

  return { db, cfg, origin, request, account, login, as, close, schema, setIdToken: t => { nextIdToken = t; } };
}

let phoneSeq = 0;
const phone = () => `6281${String(process.pid % 100).padStart(2, '0')}${String(++phoneSeq).padStart(7, '0')}`;
const instanceId = () => crypto.randomBytes(18).toString('base64url');

module.exports = { setup, skip, googleIdToken, CLIENT_ID, phone, instanceId };
