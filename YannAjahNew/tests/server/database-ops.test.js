'use strict';
// Master prompt §15.C — database & operasi; §15.D sebagian (health check, konfigurasi tanpa secret).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const h = require('./helpers');
const { createDb } = require('../../server/lib/db');
const { migrate } = require('../../server/lib/migrate');
const backup = require('../../server/services/backupService');

let t;
before(async () => { if (!h.skip) t = await h.setup(); });
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const rejects = async (p, code) => { await assert.rejects(p, e => e.cause?.code === code || e.code === code); };

it('foreign key dan unique constraint berfungsi', async () => {
  const a = await t.account('RESELLER');
  const phone = h.phone();
  await t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3)', [a.id, 'A', phone]);
  await rejects(t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3)', [a.id, 'B', phone]), '23505');
  await rejects(t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3)', [999999, 'C', h.phone()]), '23503');
  await rejects(t.db.query("INSERT INTO accounts (username, rank_code) VALUES ('rank-palsu', 'SUPERADMIN')"), '23503');
  await rejects(t.db.query("INSERT INTO accounts (username, email) VALUES ($1, 'dup@example.test'), ($2, 'dup@example.test')", ['dup-a', 'dup-b']), '23505');
  await rejects(t.db.query("INSERT INTO bot_credentials (bot_id, password_hash) VALUES ((SELECT id FROM bots LIMIT 1), 'plaintext-password')"), '23514');
  // Nomor yang sudah soft-delete boleh didaftarkan ulang (partial unique index).
  await t.db.query('UPDATE bots SET deleted_at = now() WHERE phone_number = $1', [phone]);
  await t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3)', [a.id, 'A2', phone]);
  // Akun pemilik bot tidak bisa di-hard-delete selama masih punya bot (ON DELETE RESTRICT).
  await rejects(t.db.query('DELETE FROM accounts WHERE id = $1', [a.id]), '23503');
});

it('migrasi idempoten, mempertahankan data, dan menolak file migrasi yang diubah setelah diterapkan', async () => {
  const before = (await t.db.query('SELECT count(*)::int AS n FROM accounts'))[0].n;
  assert.deepEqual(await migrate(t.db), [], 'tidak ada yang diterapkan ulang');
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM accounts'))[0].n, before, 'data tetap');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yan-mig-'));
  for (const f of fs.readdirSync(path.join(__dirname, '../../server/migrations'))) fs.copyFileSync(path.join(__dirname, '../../server/migrations', f), path.join(dir, f));
  fs.appendFileSync(path.join(dir, '002_ranks_permissions.sql'), '\n-- diubah\n');
  await assert.rejects(migrate(t.db, { dir }), e => e.code === 'MIGRATION_CHECKSUM_MISMATCH');
  fs.rmSync(dir, { recursive: true });
});

it('audit log dibuat untuk tindakan sensitif dan tidak berisi secret; audit append-only', async () => {
  const devAcc = await t.account('DEVELOPER');
  const dev = await t.login(devAcc);
  const user = (await t.as(dev).post('/api/dash/accounts', { username: 'audit-target', rank: 'RESELLER' })).json.account;
  const bot = (await t.as(dev).post('/api/dash/bots', { bot_name: 'Audit', phone_number: h.phone(), owner_id: user.id })).json.bot;
  await t.as(dev).post(`/api/dash/accounts/${user.id}/rank`, { rank: 'PARTNER' });
  await t.as(dev).post(`/api/dash/bots/${bot.id}/password`, { password: 'RahasiaAudit123' });
  await t.as(dev).post(`/api/dash/bots/${bot.id}/ban`, { banned: true, reason: 'pelanggaran' });
  await t.as(dev).post(`/api/dash/bots/${bot.id}/ban`, { banned: false });
  await t.as(dev).post(`/api/dash/accounts/${user.id}/status`, { status: 'suspended', reason: 'investigasi' });
  await t.as(dev).post(`/api/dash/accounts/${user.id}/status`, { status: 'active' });
  const rows = await t.db.query('SELECT action, actor_id, target_type, target_id, details FROM audit_logs WHERE actor_id = $1 ORDER BY id', [devAcc.id]);
  const actions = rows.map(r => r.action);
  for (const a of ['account.create', 'bot.create', 'account.rank_change', 'bot.credential.reset', 'bot.ban', 'bot.unban', 'account.suspend', 'account.unban']) assert.ok(actions.includes(a), `audit ${a}`);
  const reset = rows.find(r => r.action === 'bot.credential.reset');
  assert.equal(reset.target_type, 'bot'); assert.equal(Number(reset.target_id), bot.id);
  assert.ok(!JSON.stringify(rows).includes('RahasiaAudit123'), 'password tidak tercatat');
  assert.ok(!JSON.stringify(rows).includes('$2'), 'hash tidak tercatat');
  await rejects(t.db.query('UPDATE audit_logs SET action = $1', ['x.y']), 'P0001');
  await rejects(t.db.query('DELETE FROM audit_logs'), 'P0001');
});

it('maintenance global & per bot tercatat (pelaku + waktu) dan sampai ke proses bot', async () => {
  const ceoAcc = await t.account('CEO');
  const ceo = await t.login(ceoAcc);
  const owner = (await t.as(ceo).post('/api/dash/accounts', { username: 'mt-owner', rank: 'RESELLER' })).json.account;
  const bot = (await t.as(ceo).post('/api/dash/bots', { bot_name: 'MT', phone_number: h.phone(), owner_id: owner.id, password: 'MaintBot12345' })).json.bot;
  const login = await t.request('POST', '/api/bot/auth/login', { body: { phone_number: bot.phone_number, password: 'MaintBot12345', instance_id: h.instanceId() } });
  const auth = { authorization: `Bearer ${login.json.token}` };
  const set = await t.as(ceo).put('/api/dash/maintenance', { enabled: true, message: 'Upgrade server 30 menit' });
  assert.equal(set.status, 200, set.text);
  assert.equal(Number(set.json.maintenance.updated_by), ceoAcc.id);
  let v = (await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state;
  assert.deepEqual(v.maintenance, { active: true, scope: 'global', message: 'Upgrade server 30 menit' });
  assert.equal(v.allowed, true, 'maintenance bukan ban: bot tetap terhubung, fitur dibalas pesan maintenance');
  await t.as(ceo).put('/api/dash/maintenance', { enabled: false });
  await t.as(ceo).post(`/api/dash/bots/${bot.id}/maintenance`, { enabled: true, message: 'Bot ini maintenance' });
  v = (await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state;
  assert.deepEqual(v.maintenance, { active: true, scope: 'bot', message: 'Bot ini maintenance' });
  const audits = await t.db.query("SELECT action FROM audit_logs WHERE action LIKE 'maintenance.%' AND actor_id = $1", [ceoAcc.id]);
  assert.equal(audits.filter(a => a.action === 'maintenance.global.update').length, 2);
  assert.equal(audits.filter(a => a.action === 'maintenance.bot.update').length, 1);
  // OWNER tidak punya maintenance.manage
  const own = await t.login(await t.account('OWNER'));
  assert.equal((await t.as(own).put('/api/dash/maintenance', { enabled: true })).status, 403);
  // Pengecualian administratif eksplisit: bot milik rank yang dikecualikan tidak kena maintenance global.
  await t.db.query("UPDATE bots SET maintenance_enabled = false WHERE id = $1", [bot.id]);
  await t.as(ceo).put('/api/dash/maintenance', { enabled: true, exempt_ranks: ['RESELLER', 'DEVELOPER'] });
  v = (await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state;
  assert.equal(v.maintenance.active, false);
  await t.as(ceo).put('/api/dash/maintenance', { enabled: false, exempt_ranks: ['DEVELOPER'] });
});

it('backup terenkripsi bisa dipulihkan ke database kosong; restore ke database berisi ditolak', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  await t.as(dev).post('/api/dash/bots', { bot_name: 'Backup Bot', phone_number: h.phone(), password: 'BackupBot12345' });
  const res = await t.as(dev).get('/api/dash/backup');
  assert.equal(res.status, 200);
  assert.ok(!res.text.includes('Backup Bot'), 'isi backup terenkripsi');
  const data = backup.decrypt(res.text, t.cfg.backupKey);
  assert.throws(() => backup.decrypt(res.text, 'kunci-salah-0123456789'), e => e.code === 'BACKUP_DECRYPT_FAILED');
  await assert.rejects(backup.restoreData(t.db, data), e => e.code === 'RESTORE_TARGET_NOT_EMPTY');

  const schema = 'yr_' + crypto.randomBytes(5).toString('hex');
  const admin = createDb({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const target = createDb({ connectionString: process.env.TEST_DATABASE_URL, schema, max: 2 });
  try {
    await migrate(target);
    const counts = await backup.restoreData(target, data);
    assert.equal(counts.accounts, data.tables.accounts.length);
    const origBots = await t.db.query('SELECT id, bot_name, phone_number, owner_id FROM bots ORDER BY id');
    const restored = await target.query('SELECT id, bot_name, phone_number, owner_id FROM bots ORDER BY id');
    assert.deepEqual(restored, origBots);
    // Password bot tetap bisa dipakai setelah restore (hash ikut), dan id baru tidak bentrok.
    const cred = (await target.query("SELECT c.password_hash FROM bot_credentials c JOIN bots b ON b.id = c.bot_id WHERE b.bot_name = 'Backup Bot'"))[0];
    assert.ok(await require('bcryptjs').compare('BackupBot12345', cred.password_hash));
    await target.query("INSERT INTO accounts (username) VALUES ('setelah-restore')");
  } finally {
    await target.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close();
  }
});

it('health check berfungsi', async () => {
  assert.deepEqual((await t.request('GET', '/health')).json, { status: 'ok' });
  const ready = await t.request('GET', '/health/ready');
  assert.equal(ready.status, 200); assert.equal(ready.json.migrations_pending, 0);
});

it('konfigurasi: error validasi & redaksi tidak membocorkan nilai secret', () => {
  const { validate, redact } = require('../../library/config-loader');
  const cfg = require('../../settingsbot.js');
  const copy = JSON.parse(JSON.stringify(cfg));
  copy.api.apiz2z.apiKey = 'sk-super-rahasia-123';
  copy.license.serverUrl = 'http://contoh-produksi.example';   // http non-localhost ditolak
  let msg = '';
  try { validate(copy); } catch (e) { msg = e.message; }
  assert.match(msg, /HTTPS/);
  assert.ok(!msg.includes('sk-super-rahasia-123'));
  assert.equal(redact(copy).api.apiz2z.apiKey, '***');
  const { buildServerConfig } = require('../../server/config');
  assert.throws(() => buildServerConfig({ NODE_ENV: 'production', DATABASE_URL: 'postgres://u:pw-rahasia@db/x', SESSION_SECRET: 'pendek' }), e => !e.message.includes('pw-rahasia') && /SESSION_SECRET/.test(e.message));
});
