'use strict';
// Klien lisensi bot (library/license.js) terhadap backend ASLI (server/app.js + PostgreSQL sekali pakai).
// Menguji alur end-to-end: login nomor+password, token tersimpan 0600, restart tanpa password,
// heartbeat status koneksi, ban dari dashboard mengunci bot, unban + login ulang, maintenance,
// server tidak terjangkau = gagal aman, dan satu session tidak dipakai dua proses.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const h = require('../server/helpers');
const { hashPassword } = require('../../server/lib/security');
const { LicenseClient } = require('../../library/license');

let t, dir, bot, ownerSession;
const PASSWORD = 'PasswordBotKu123';
const cfgFor = (serverUrl, file) => ({ serverUrl, instanceName: 'test-instance', tokenFile: file, heartbeatMinutes: 10, requestTimeoutMs: 3000, offlineGraceMinutes: 0, maxPasswordAttempts: 3 });

before(async () => {
  if (h.skip) return;
  t = await h.setup();
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yan-lic-'));
  const ownerAcc = await t.account('OWNER');
  ownerSession = await t.login(ownerAcc);
  const reseller = await t.account('RESELLER', { manager: ownerAcc.id });
  const phone = h.phone();
  const row = (await t.db.query('INSERT INTO bots (owner_id, bot_name, phone_number) VALUES ($1,$2,$3) RETURNING id', [reseller.id, 'Bot Lisensi', phone]))[0];
  await t.db.query('INSERT INTO bot_credentials (bot_id, password_hash) VALUES ($1,$2)', [row.id, await hashPassword(PASSWORD, 10)]);
  bot = { id: Number(row.id), phone };
});
after(async () => { await t?.close(); if (dir) fs.rmSync(dir, { recursive: true, force: true }); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('password salah ditolak dengan pesan generik; bot tetap terkunci', async () => {
  const c = new LicenseClient(cfgFor(t.origin, path.join(dir, 'a.json')), { rootDir: dir });
  await assert.rejects(c.login({ phone: bot.phone, password: 'salah-salah-1' }), e => e.code === 'INVALID_CREDENTIALS' && e.userMessage === 'Nomor atau password salah.');
  assert.equal(c.isActive(), false);
});

it('login sukses -> token disimpan 0600 tanpa password; restart memakai token (tanpa password)', async () => {
  const file = path.join(dir, 'b.json');
  const c = new LicenseClient(cfgFor(t.origin, file), { rootDir: dir });
  const state = await c.login({ phone: '0' + bot.phone.slice(2), password: PASSWORD, version: '1.0.0' });   // format 08xx dinormalisasi
  assert.equal(state.allowed, true);
  assert.equal(c.isActive(), true);
  assert.equal(c.botPhone(), bot.phone);
  const st = fs.statSync(file);
  assert.equal(st.mode & 0o777, 0o600);
  const saved = fs.readFileSync(file, 'utf8');
  assert.ok(!saved.includes(PASSWORD));
  assert.match(JSON.parse(saved).token, /^yab_/);
  const restarted = new LicenseClient(cfgFor(t.origin, file), { rootDir: dir });
  assert.equal(await restarted.verifyStored(), true);
  assert.equal(restarted.session.instanceId, c.session.instanceId, 'instance id tetap setelah restart');
});

it('heartbeat melaporkan status koneksi; ban dari dashboard mengunci bot dan membuang token; unban + login ulang memulihkan', async () => {
  const file = path.join(dir, 'c.json');
  const c = new LicenseClient(cfgFor(t.origin, file), { rootDir: dir });
  await c.login({ phone: bot.phone, password: PASSWORD, force: true });
  c.connectionStatus = 'connected';
  await c.heartbeat();
  assert.equal((await t.db.query('SELECT connection_status FROM bots WHERE id = $1', [bot.id]))[0].connection_status, 'connected');

  const locked = new Promise(r => c.once('locked', r));
  assert.equal((await t.as(ownerSession).post(`/api/dash/bots/${bot.id}/ban`, { banned: true, reason: 'uji ban' })).status, 200);
  await c.heartbeat();
  assert.equal(await locked, 'SESSION_REVOKED');
  assert.equal(c.isActive(), false);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).token, null, 'token dibuang');
  await assert.rejects(c.login({ phone: bot.phone, password: PASSWORD }), e => e.code === 'BOT_BANNED' && e.details.ban_reason === 'uji ban');

  assert.equal((await t.as(ownerSession).post(`/api/dash/bots/${bot.id}/ban`, { banned: false })).status, 200);
  assert.equal(await c.verifyStored(), false, 'token lama tidak hidup lagi setelah unban');
  await c.login({ phone: bot.phone, password: PASSWORD, force: true });
  assert.equal(c.isActive(), true);
});

it('maintenance global sampai ke bot lewat heartbeat (bot tetap aktif, fitur dibalas pesan maintenance)', async () => {
  const c = new LicenseClient(cfgFor(t.origin, path.join(dir, 'd.json')), { rootDir: dir });
  await c.login({ phone: bot.phone, password: PASSWORD, force: true });
  await t.db.query("UPDATE maintenance_settings SET enabled = true, message = 'Upgrade' WHERE id = 1");
  await c.heartbeat();
  assert.deepEqual(c.maintenance(), { active: true, scope: 'global', message: 'Upgrade' });
  assert.equal(c.isActive(), true);
  await t.db.query("UPDATE maintenance_settings SET enabled = false WHERE id = 1");
});

it('satu session tidak dipakai dua proses: proses kedua ditolak selama proses pertama masih heartbeat', async () => {
  const a = new LicenseClient(cfgFor(t.origin, path.join(dir, 'e1.json')), { rootDir: dir });
  const b = new LicenseClient(cfgFor(t.origin, path.join(dir, 'e2.json')), { rootDir: dir });
  await a.login({ phone: bot.phone, password: PASSWORD, force: true });
  await assert.rejects(b.login({ phone: bot.phone, password: PASSWORD }), e => e.code === 'INSTANCE_ACTIVE');
  await b.login({ phone: bot.phone, password: PASSWORD, force: true });
  await a.heartbeat();
  assert.equal(a.isActive(), false, 'proses lama terkunci setelah diambil alih');
});

it('server lisensi tidak terjangkau: verifikasi gagal dan heartbeat mengunci (gagal aman, grace 0)', async () => {
  const c = new LicenseClient(cfgFor('http://127.0.0.1:9', path.join(dir, 'f.json')), { rootDir: dir });
  c.session.token = 'yab_' + 'x'.repeat(43);
  await assert.rejects(c.verifyStored(), e => e.code === 'SERVER_UNREACHABLE');
  c.locked = false;
  await c.heartbeat();
  assert.equal(c.isActive(), false);
  assert.equal(c.lockReason, 'SERVER_UNREACHABLE');
});
