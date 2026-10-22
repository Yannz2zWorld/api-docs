'use strict';
// Inti bot tanpa jaringan WhatsApp: lock session, keputusan reconnect, serializer (LID -> nomor),
// namespace yannajah (facade database, antrian kirim, sendFile), konfigurasi.
// Catatan jujur: pairing QR/pairing code sungguhan butuh koneksi ke server WhatsApp dan TIDAK diuji di sini.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WhatsAppManager, SessionLock, loadBaileys } = require('../../library/connection');
const { serialize, parseCommand } = require('../../myfunct/message');
const { createYannajah, createDatabaseFacade } = require('../../yannajah');
const { validate, loadConfig } = require('../../library/config-loader');
const DataBase = require('../../source/database');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'yan-core-'));
const pairingCfg = dir => ({ ...require('../../settingsbot.js').pairing, sessionDir: dir, reconnect: { maxAttempts: 2, baseDelayMs: 5, maxDelayMs: 10 } });

test('SessionLock: proses lain yang masih hidup memblokir; lock basi diambil alih', () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, '.yannajah.lock'), String(process.ppid));
  assert.throws(() => new SessionLock(dir).acquire(), e => e.code === 'SESSION_IN_USE');
  fs.writeFileSync(path.join(dir, '.yannajah.lock'), '999999');
  const l = new SessionLock(dir); l.acquire();
  assert.equal(fs.readFileSync(path.join(dir, '.yannajah.lock'), 'utf8'), String(process.pid));
  l.release();
  assert.ok(!fs.existsSync(path.join(dir, '.yannajah.lock')));
});

test('koneksi WhatsApp tidak dibuka kalau lisensi terkunci', async () => {
  const wa = new WhatsAppManager(pairingCfg(tmp()), { license: { isActive: () => false, setConnectionStatus() {} } });
  await assert.rejects(wa.start({ method: 'qr' }), e => e.code === 'LICENSE_LOCKED');
});

test('keputusan saat koneksi ditutup: logout menghapus session, replaced berhenti, lisensi terkunci tidak reconnect, restartRequired reconnect', async () => {
  const { DisconnectReason: R } = await loadBaileys();
  const mk = (active = true) => {
    const dir = tmp();
    const wa = new WhatsAppManager(pairingCfg(dir), { license: { isActive: () => active, lockReason: 'BOT_BANNED', setConnectionStatus() {} }, logger: { info() {}, warn() {}, error() {} } });
    wa.starts = 0; wa.start = async () => { wa.starts++; };
    wa.terminal = null; wa.on('terminal', r => { wa.terminal = r; });
    fs.writeFileSync(path.join(dir, 'creds.json'), '{}');
    return { wa, dir };
  };
  let { wa, dir } = mk();
  await wa.handleClose(R.loggedOut, R);
  assert.equal(wa.terminal, 'logged_out'); assert.equal(wa.starts, 0); assert.ok(!fs.existsSync(path.join(dir, 'creds.json')), 'session dihapus');
  ({ wa, dir } = mk());
  await wa.handleClose(R.connectionReplaced, R);
  assert.equal(wa.terminal, 'replaced'); assert.equal(wa.starts, 0); assert.ok(fs.existsSync(path.join(dir, 'creds.json')), 'session tetap');
  ({ wa } = mk(false));
  await wa.handleClose(R.connectionLost, R);
  assert.equal(wa.starts, 0, 'bot diban tidak hidup lagi lewat auto-reconnect'); assert.equal(wa.stopped, true);
  ({ wa } = mk());
  await wa.handleClose(R.restartRequired, R);
  assert.equal(wa.starts, 1);
  ({ wa } = mk());
  await wa.handleClose(R.connectionLost, R); await wa.handleClose(R.connectionLost, R); await wa.handleClose(R.connectionLost, R);
  assert.equal(wa.starts, 2); assert.equal(wa.terminal, 'max_reconnect', 'batas reconnect');
});

test('serializer: LID di grup di-resolve ke nomor, command & argumen, quoted + mention, status admin', async () => {
  const B = await loadBaileys();
  const conn = { user: { id: '6281111111111:5@s.whatsapp.net', lid: '99999@lid' } };
  const meta = { subject: 'G', participants: [
    { id: '12345@lid', phoneNumber: '6282222222222@s.whatsapp.net', admin: 'admin' },
    { id: '99999@lid', phoneNumber: '6281111111111@s.whatsapp.net', admin: null }
  ] };
  const raw = { key: { remoteJid: '120363000@g.us', participant: '12345@lid', id: 'ABC', fromMe: false }, pushName: 'Budi', messageTimestamp: 1700000000,
    message: { ephemeralMessage: { message: { extendedTextMessage: { text: '!Kick @6283333333333 alasan', contextInfo: { mentionedJid: ['6283333333333@s.whatsapp.net'], stanzaId: 'Q1', participant: '99999@lid', quotedMessage: { conversation: 'halo' } } } } } } };
  const m = await serialize(conn, raw, { B, groupMetadata: async () => meta, prefixes: ['.', '!'], allowNoPrefix: false });
  assert.equal(m.sender, '6282222222222@s.whatsapp.net');
  assert.equal(m.isCmd, true); assert.equal(m.command, 'kick'); assert.deepEqual(m.args, ['@6283333333333', 'alasan']);
  assert.deepEqual(m.mentionedJid, ['6283333333333@s.whatsapp.net']);
  assert.equal(m.isAdmin, true); assert.equal(m.isBotAdmin, false);
  assert.equal(m.quoted.text, 'halo'); assert.equal(m.quoted.sender, '6281111111111@s.whatsapp.net');
  const pv = await serialize(conn, { key: { remoteJid: '777@lid', remoteJidAlt: '6284444444444@s.whatsapp.net', id: 'X' }, message: { imageMessage: { caption: '.s', mimetype: 'image/jpeg' } } }, { B, groupMetadata: async () => null, prefixes: ['.'] });
  assert.equal(pv.sender, '6284444444444@s.whatsapp.net'); assert.equal(pv.isMedia, true); assert.equal(pv.command, 's');
  assert.deepEqual(parseCommand('menu', { prefixes: ['.'], allowNoPrefix: false }), { isCmd: false });
  assert.equal(parseCommand('menu', { prefixes: ['.'], allowNoPrefix: true }).command, 'menu');
});

test('facade database: path array untuk JID bertitik, path berbahaya ditolak, limit harian reset', () => {
  const store = { data: DataBase.DEFAULTS(), markDirty() {} };
  const db = createDatabaseFacade(store, { dailyLimit: 7 });
  const jid = '6281@s.whatsapp.net';
  db.set(['users', jid, 'money'], 5);
  assert.equal(db.get(['users', jid, 'money']), 5);
  assert.equal(store.data.users[jid].money, 5);
  assert.throws(() => db.set('__proto__.polluted', 1), e => e.code === 'INVALID_DB_PATH');
  assert.throws(() => db.get(['users', 'constructor']), e => e.code === 'INVALID_DB_PATH');
  assert.equal({}.polluted, undefined);
  const u = db.user('6289@s.whatsapp.net');
  assert.equal(u.limit, 7);
  u.limit = 0; u.limitDate = '2000-01-01';
  assert.equal(db.user('6289@s.whatsapp.net').limit, 7, 'reset harian');
});

test('yannajah.sendmessage: urut per chat, retry terbatas, ditolak saat lisensi terkunci; sendFile memilih tipe dari isi file', async () => {
  const sent = [];
  let failOnce = true, active = true;
  const sock = { sendMessage: async (jid, msg) => { if (failOnce && msg.text === 'retry') { failOnce = false; throw new Error('sementara'); } sent.push([jid, msg]); return { key: { id: String(sent.length) } }; } };
  const config = { ...require('../../settingsbot.js'), retry: { sendMessage: 1 } };
  const y = createYannajah({ config, logger: console, store: { data: DataBase.DEFAULTS(), markDirty() {} }, license: { isActive: () => active, status: () => ({}) }, api: null, registry: { features: new Map() }, wa: { sock } });
  const jid = '6281@s.whatsapp.net';
  await Promise.all(['a', 'b', 'retry', 'c'].map(x => y.sendmessage(jid, x)));
  assert.deepEqual(sent.map(s => s[1].text), ['a', 'b', 'retry', 'c']);
  await assert.rejects(y.sendmessage('bukan-jid', 'x'), e => e.code === 'INVALID_JID');
  active = false;
  await assert.rejects(y.sendmessage(jid, 'x'), e => e.code === 'LICENSE_LOCKED');
  active = true;
  sent.length = 0;
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  await y.sendFile(jid, png, { caption: 'c' });
  await y.sendFile(jid, Buffer.from('%PDF-1.4 test'));
  await y.sendFile(jid, { buffer: Buffer.from('OggS0000'), mime: 'audio/ogg' }, { ptt: true });
  assert.ok(sent[0][1].image); assert.equal(sent[0][1].caption, 'c');
  assert.equal(sent[1][1].mimetype, 'application/pdf'); assert.ok(sent[1][1].document);
  assert.equal(sent[2][1].ptt, true); assert.match(sent[2][1].mimetype, /opus/);
  await assert.rejects(y.sendFile(jid, 'http://127.0.0.1/rahasia'), e => e.code === 'BLOCKED_HOST');
});

test('konfigurasi default valid; nilai salah ditolak dengan pesan jelas', () => {
  const cfg = loadConfig({ reload: true });
  assert.equal(cfg.bot.projectName, 'YannAjahNew');
  const bad = JSON.parse(JSON.stringify(cfg));
  bad.owner.number = '+62 812';
  bad.pairing.method = 'telepati';
  bad.pairing.customCode = 'pendek';
  bad.prefix.list = [];
  assert.throws(() => validate(bad), e => e.problems.length === 4 && /owner.number/.test(e.message) && /pairing.method/.test(e.message));
});

test('database lokal: tulis atomik + pulih dari cadangan kalau file utama rusak', async () => {
  const dir = tmp();
  const db = new DataBase({ dir, file: 'db.json' });
  await db.read();
  db.data.users.a = { money: 1 }; await db.write();
  db.data.users.a.money = 2; await db.write();   // .bak = versi money:1
  fs.writeFileSync(path.join(dir, 'db.json'), '{rusak');
  const again = new DataBase({ dir, file: 'db.json' });
  await again.read();
  assert.equal(again.data.users.a.money, 1);
  assert.throws(() => new DataBase({ dir, file: '../luar.json' }));
});
