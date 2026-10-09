'use strict';
// Developer Panel backups (services/backupService.js): database (.sql), JSON, web files (GitHub zip),
// sent to the owner's Gmail by hand or by the daily Vercel cron. GitHub and the mail provider are
// never contacted: fetch and emailService.sendMail are stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');
const h = require('./helpers');
const emailService = require('../../services/emailService');

const ZIP = Buffer.from('PK\x03\x04 fake zip of the website');
const CODELOAD = 'https://codeload.github.com/Yannz2zWorld/api-docs/legacy.zip/refs/heads/main?token=TEMP';
const realFetch = global.fetch;
const realSend = emailService.sendMail;
let sent = [], gh = [], githubStatus = 302;

let app, owner, user;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
    const u = new URL(url);
    if (u.hostname === 'api.github.com') {
      gh.push({ path: u.pathname, auth: new Headers(init.headers || {}).get('authorization'), redirect: init.redirect });
      return githubStatus === 302 ? new Response(null, { status: 302, headers: { location: CODELOAD } }) : new Response('{}', { status: githubStatus });
    }
    if (u.hostname === 'codeload.github.com') return new Response(ZIP, { status: 200, headers: { 'content-type': 'application/zip' } });
    return realFetch(input, init);
  };
  emailService.sendMail = async msg => { sent.push(msg); };
  await h.setupDatabase();
  app = await h.startApp({ GITHUB_TOKEN: 'gh-test-token', EMAIL_FROM: 'bot@example.test', SMTP_HOST: 'smtp.example.test', CRON_SECRET: 'cron-secret-123' });
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('backupuser@example.test', { name: "O'Brien \"quote\" \\ back" });
  await app.request('POST', '/api/keys', { cookie: user, headers: { origin: app.origin }, body: { name: 'kunci' } });
  await h.db().query("INSERT INTO chat_messages(user_id, body) SELECT id, 'halo 👋 ''kutip'' \\ dan\nbaris baru' FROM users WHERE email='backupuser@example.test'");
  await h.db().query("UPDATE server_settings SET maintenance_message='Lagi maintenance' WHERE id=1");
});
after(async () => { global.fetch = realFetch; emailService.sendMail = realSend; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { sent = []; gh = []; githubStatus = 302; });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const get = (url, cookie, headers = {}) => app.request('GET', url, { cookie, headers });

// Raw body (the helper decodes as utf8, which breaks gzip): fetch it ourselves.
async function rawGet(url, cookie, headers = {}) {
  const r = await realFetch(app.origin + url, { headers: { cookie, ...headers } });
  return { status: r.status, headers: Object.fromEntries(r.headers), body: Buffer.from(await r.arrayBuffer()) };
}

it('backups are developer-only', async () => {
  for (const url of ['/owner/backup', '/owner/backup/json', '/owner/backup/database', '/owner/backup/web', '/owner/backup/status']) {
    assert.equal((await get(url, user)).status, 403, url);
  }
  assert.equal((await app.request('POST', '/owner/backup/email', { cookie: user, headers: { origin: app.origin } })).status, 403);
  assert.equal(sent.length, 0);
});

it('database backup is a .sql that restores every table into an empty database', async () => {
  const r = await rawGet('/owner/backup/database', owner, { 'accept-encoding': 'gzip' });
  assert.equal(r.status, 200);
  assert.match(r.headers['content-disposition'], /attachment; filename="yannz-db-\d{4}-\d{2}-\d{2}\.sql"/);
  // Node's fetch already undid the gzip encoding: the saved file is plain SQL.
  const sql = r.body.toString('utf8');
  assert.match(sql, /^-- Yannz API database backup/);
  assert.match(sql, /INSERT INTO "users"/);

  // Restore: fresh schema + migrations, then the backup.
  const db = h.db();
  const schema = 'restore_' + Date.now();
  const { Pool } = require('pg');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL, max: 1, options: `-c search_path=${schema},public` });
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    const dir = path.join(__dirname, '..', '..', 'migrations');
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) await pool.query(fs.readFileSync(path.join(dir, f), 'utf8'));
    await pool.query(sql);
    await pool.query(sql);   // running it twice is harmless
    const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type='BASE TABLE'")).rows.map(r => r.table_name);
    for (const t of tables) {
      // Taking the backup writes its own audit row afterwards; that one is naturally not in it.
      const where = t === 'audit_logs' ? " WHERE action <> 'backup_create'" : '';
      const a = (await db.query(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h, count(*)::int AS n FROM "${t}" x${where}`)).rows[0];
      const b = (await pool.query(`SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h, count(*)::int AS n FROM "${t}" x${where}`)).rows[0];
      assert.deepEqual(b, a, `table ${t} restored exactly`);
    }
    assert.equal((await pool.query("SELECT maintenance_message FROM server_settings WHERE id=1")).rows[0].maintenance_message, 'Lagi maintenance');
    // Sequences continue after the restored rows.
    const next = (await pool.query("INSERT INTO chat_messages(user_id, body) SELECT id, 'baru' FROM users LIMIT 1 RETURNING id")).rows[0].id;
    const max = (await db.query('SELECT max(id) AS m FROM chat_messages')).rows[0].m;
    assert.ok(Number(next) > Number(max));
  } finally { await pool.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`).catch(() => {}); await pool.end(); }
});

it('downloads are gzip-encoded on the wire when the browser accepts it', async () => {
  const r = await app.request('GET', '/owner/backup/database', { cookie: owner, headers: { 'accept-encoding': 'gzip' } });
  assert.equal(r.headers['content-encoding'], 'gzip');
  const plain = await app.request('GET', '/owner/backup/database', { cookie: owner });
  assert.equal(plain.headers['content-encoding'], undefined);
  assert.match(plain.text, /^-- Yannz API database backup/);
});

it('JSON backup has every table, readable, without usable API keys', async () => {
  const r = await get('/owner/backup/json', owner);
  assert.equal(r.status, 200);
  assert.match(r.headers['content-disposition'], /yannz-db-.*\.json"/);
  assert.equal(r.json.version, 2);
  for (const t of ['users', 'api_keys', 'endpoints', 'chat_messages', 'server_settings', 'activity_log']) assert.ok(Array.isArray(r.json.data[t]), t);
  assert.ok(r.json.data.users.some(u => u.email === 'backupuser@example.test'));
  assert.equal(r.json.counts.users, r.json.data.users.length);
  assert.equal((await get('/owner/backup', owner)).json.version, 2, 'old link still works');
});

it('web files backup redirects to the GitHub zip of the repo', async () => {
  const r = await get('/owner/backup/web', owner);
  assert.equal(r.status, 302);
  assert.equal(r.headers.location, CODELOAD);
  assert.deepEqual(gh[0], { path: '/repos/Yannz2zWorld/api-docs/zipball/main', auth: 'Bearer gh-test-token', redirect: 'manual' });
  githubStatus = 401;
  const bad = await get('/owner/backup/web', owner, { accept: 'application/json' });
  assert.deepEqual([bad.status, bad.json.error], [503, 'GITHUB_AUTH']);
});

it('"Kirim ke Gmail" emails the three backups to OWNER_EMAIL', async () => {
  const st = await get('/owner/backup/status', owner);
  assert.deepEqual([st.json.email.configured, st.json.daily.enabled, st.json.github.token], [true, true, true]);
  assert.ok(!st.text.includes('gh-test-token') && !st.text.includes('cron-secret-123'));

  const r = await app.request('POST', '/owner/backup/email', { cookie: owner, headers: { origin: app.origin } });
  assert.equal(r.status, 200, r.text);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.to, h.OWNER_EMAIL);
  assert.match(m.subject, /^Backup Yannz API/);
  assert.deepEqual(m.attachments.map(a => a.filename.replace(/\d{4}-\d{2}-\d{2}/, 'D')), ['yannz-db-D.sql', 'yannz-db-D.json', 'yannz-web-D.zip']);
  assert.match(m.attachments[0].content.toString(), /INSERT INTO "users"/);
  assert.equal(JSON.parse(m.attachments[1].content.toString()).version, 2);
  assert.deepEqual(m.attachments[2].content, ZIP);
  assert.deepEqual(r.json.parts.map(p => p.attached), [true, true, true]);
});

it('a failing part is reported in the email instead of stopping the others', async () => {
  githubStatus = 404;
  const r = await app.request('POST', '/owner/backup/email', { cookie: owner, headers: { origin: app.origin } });
  assert.equal(r.status, 200, r.text);
  assert.equal(sent[0].attachments.length, 2);
  assert.match(sent[0].text, /✘ File web: Repo\/branch GitHub nggak ketemu/);
  assert.deepEqual(r.json.parts.map(p => p.attached), [true, true, false]);
});

it('the daily cron needs the CRON_SECRET bearer token', async () => {
  assert.equal((await get('/cron/backup')).status, 401);
  assert.equal((await get('/cron/backup', undefined, { authorization: 'Bearer wrong' })).status, 401);
  assert.equal(sent.length, 0);
  const r = await get('/cron/backup', undefined, { authorization: 'Bearer cron-secret-123' });
  assert.equal(r.status, 200, r.text);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /otomatis harian/);
  const audit = await h.db().query("SELECT metadata FROM audit_logs WHERE action='backup_email' ORDER BY created_at DESC LIMIT 1");
  assert.equal(audit.rows[0].metadata.auto, true);

  delete process.env.CRON_SECRET;
  try { assert.equal((await get('/cron/backup', undefined, { authorization: 'Bearer ' })).status, 503); }
  finally { process.env.CRON_SECRET = 'cron-secret-123'; }
});

it('vercel.json schedules the daily backup', () => {
  const v = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'vercel.json'), 'utf8'));
  assert.deepEqual(v.crons, [{ path: '/cron/backup', schedule: '0 19 * * *' }]);
});
