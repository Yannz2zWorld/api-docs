'use strict';
// Fitur V15 batch grup: aktivitas & sider, auto level, streak, ulang tahun, absen, jadwal,
// buka/tutup berwaktu & harian, posting bulanan, onlygc, antibot, mute grup, warn.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScenario, GROUP } = require('./scenario-harness');
const scheduler = require('../../library/scheduler');

const A = '6281211110001@s.whatsapp.net';
const B = '6281211110002@s.whatsapp.net';
const C = '6281211110003@s.whatsapp.net';
const parts = [A, B, C].map(id => ({ id, phoneNumber: id, admin: null }));
const tick = (s, now) => scheduler.runOnce({ database: s.db, socket: s.socket, sendmessage: async (jid, content) => s.sent.push({ jid, content }), auth: { isActive: () => true } }, now, require('../../settingsbot.js'));

test('total chat, sider (data belum cukup = tidak kick), auto level', async () => {
  const s = createScenario();
  for (let i = 0; i < 3; i++) await s.send({ text: `halo ${i}`, group: true, from: A, participants: parts });
  await s.send({ text: 'hai', group: true, from: B, participants: parts });
  assert.match(await s.send({ text: '.totalchat', group: true, from: A, participants: parts }), /1\. @6281211110001 — 4[\s\S]*2\. @6281211110002 — 1/);
  assert.match(await s.send({ text: '.sider', group: true, admin: true, participants: parts }), /Total: 1 dari 3[\s\S]*@6281211110003 \(belum pernah chat\)/);
  assert.match(await s.send({ text: '.kicksider 7 confirm', group: true, admin: true, participants: parts }), /Tunggu sampai 7 hari/);
  s.db.group(GROUP).activity.since = Date.now() - 8 * 86400000;
  assert.match(await s.send({ text: '.kicksider 7', group: true, admin: true, participants: parts }), /akan dikeluarkan/);
  await s.send({ text: '.kicksider 7 confirm', group: true, admin: true, participants: parts });
  assert.deepEqual(s.calls.at(-1), ['groupParticipantsUpdate', GROUP, [C], 'remove']);
  await s.send({ text: '.autolevel on', group: true, admin: true });
  const u = s.db.user(C); u.exp = 99; u.level = 0; u.lastXp = 0;
  assert.match(await s.send({ text: 'aku aktif', group: true, from: C, participants: parts }), /naik ke level \*1\*/);
});

test('streak berpasangan naik hanya jika keduanya menyala', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.buatstreak 6281211110002', group: true, from: A }), /dimulai/);
  assert.match(await s.send({ text: '.nyalainstreak', group: true, from: A }), /Menunggu/);
  assert.match(await s.send({ text: '.nyalainstreak', group: true, from: B }), /naik jadi \*1 hari\*/);
  assert.match(await s.send({ text: '.nyalainstreak', group: true, from: A }), /sudah menyala hari ini/);
  assert.match(await s.send({ text: '.cekstreak', group: true, from: A }), /\*1 hari\*/);
  assert.match(await s.send({ text: '.topstreak', group: true, from: C }), /1\. .* — 🔥 1 hari/);
});

test('ulang tahun: simpan, hitung mundur, ucapan otomatis jam 07 sekali setahun', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.setultah 31/02', group: true, from: A }), /tidak valid/);
  const now = scheduler.localNow('Asia/Jakarta');
  await s.send({ text: `.setultah ${now.day}/${now.month}/2000`, group: true, from: A });
  assert.match(await s.send({ text: '.cekultah', group: true, from: A }), /hari ini ulang tahun yang ke-/);
  await tick(s, { ...now, hour: 7, hhmm: '07:00' });
  await tick(s, { ...now, hour: 7, hhmm: '07:01' });
  assert.equal(s.sent.filter(x => /Selamat ulang tahun yang ke-/.test(x.content.text || '')).length, 1);
});

test('auto absen kirim poll sekali per hari pada jamnya', async () => {
  const s = createScenario();
  await s.send({ text: '.setabsen 7:30', group: true, admin: true });
  const now = { ...scheduler.localNow('Asia/Jakarta'), hhmm: '07:30', hour: 7 };
  await tick(s, now); await tick(s, now);
  assert.equal(s.sent.filter(x => x.content.poll).length, 1);
  assert.deepEqual(s.sent.find(x => x.content.poll).content.poll.values, ['✅ Hadir', '🤒 Sakit', '📝 Izin']);
});

test('closetime berwaktu, jadwal harian, posting bulanan', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.closetime 5 detik', group: true, admin: true }), /Format/);
  assert.match(await s.send({ text: '.closetime 10 menit', group: true, admin: true }), /dimulai/);
  s.db.group(GROUP).timedSetting.at = Date.now() - 1;
  const now = scheduler.localNow('Asia/Jakarta');
  await tick(s, now);
  assert.ok(s.calls.some(c => c[0] === 'groupSettingUpdate' && c[2] === 'announcement'));
  await s.send({ text: '.setopentime 05:00|Selamat pagi', group: true, admin: true });
  await tick(s, { ...now, hhmm: '05:00' }); await tick(s, { ...now, hhmm: '05:00' });
  assert.equal(s.calls.filter(c => c[0] === 'groupSettingUpdate' && c[2] === 'not_announcement').length, 1);
  assert.match(await s.send({ text: '.cekjadwal', group: true }), /Buka : 05:00/);
  await s.send({ text: `.schedule Bayar kas|${now.day}`, group: true, admin: true });
  await tick(s, { ...now, hour: 0, hhmm: '00:00' });
  assert.ok(s.sent.some(x => x.content.text === 'Bayar kas'));
});

test('jadwal pesan berulang, onlygc, mutegc, antibot, warn info', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.jadwalpesan 60 | Jangan lupa absen', group: true, admin: true }), /setiap 60 menit/);
  s.db.group(GROUP).scheduledMessages[0].nextAt = 0;
  await tick(s, scheduler.localNow('Asia/Jakarta'));
  assert.ok(s.sent.some(x => x.content.text === 'Jangan lupa absen'));
  assert.match(await s.send({ text: '.stopjadwalpesan', group: true, admin: true }), /dihentikan/);

  await s.send({ text: '.onlygc on' });
  assert.equal(await s.send({ text: '.ping', from: A }), '');
  assert.match(await s.send({ text: '.ping', group: true, from: A }), /Pong/);

  await s.send({ text: '.mutegc', group: true });
  assert.equal(s.db.group(GROUP).mute, true);

  await s.send({ text: '.antibot delete on', group: true, admin: true });
  assert.equal(await s.send({ text: 'pesan manusia', group: true, from: B }), '');
  assert.ok(!s.sent.some(x => x.content?.delete));
  await s.send({ text: 'spam bot', group: true, from: B, keyId: 'BAE5ABCDEF123456' });
  assert.ok(s.sent.some(x => x.content?.delete), 'pesan bot lain dihapus');

  s.db.group(GROUP).warns = { [B]: 2 };
  assert.match(await s.send({ text: '.mywarn 6281211110002', group: true, from: A }), /2\/\d+ peringatan/);
  assert.match(await s.send({ text: '.resetwarn', group: true, admin: true }), /Warn 1 member direset/);
});
