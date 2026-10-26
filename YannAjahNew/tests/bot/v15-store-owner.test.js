'use strict';
// Fitur V15 batch toko & owner: list, payment, proses/done, reseller, premium, sewa, limit, redeem,
// respon otomatis, custom command, badword, order manual.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScenario, OWNER } = require('./scenario-harness');

const USER = '6281299999999@s.whatsapp.net';

test('list grup: addlist, list, ketik nama item, updatelist, dellist, setlist', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.addlist Burger|Burger keju', group: true, from: USER }), /DENIED admin/);
  assert.match(await s.send({ text: '.addlist Burger|Burger keju', group: true, admin: true, from: USER }), /berhasil ditambahkan/);
  assert.match(await s.send({ text: '.addlist Es Teh|Segar', group: true, admin: true, from: USER }), /berhasil/);
  assert.match(await s.send({ text: '.addlist burger|dobel', group: true, admin: true, from: USER }), /sudah ada/);
  assert.match(await s.send({ text: '.list', group: true, from: USER }), /DAFTAR LIST[\s\S]*Burger[\s\S]*Es Teh/);
  assert.equal(await s.send({ text: 'burger', group: true, from: USER }), 'Burger keju');
  assert.match(await s.send({ text: '.updatelist burg|Burger wagyu', group: true, admin: true, from: USER }), /diperbarui/);
  assert.equal(await s.send({ text: 'Burger', group: true, from: USER }), 'Burger wagyu');
  assert.match(await s.send({ text: '.setlist Menu @group\n@x\n@prefix >>', group: true, admin: true, from: USER }), /disimpan/);
  assert.match(await s.send({ text: '.list', group: true, from: USER }), /^Menu Grup Tes\n>> Burger\n>> Es Teh/);
  assert.match(await s.send({ text: '.dellist 1', group: true, admin: true, from: USER }), /"Burger" berhasil dihapus/);
  assert.match(await s.send({ text: '.clearlist', group: true, admin: true, from: USER }), /1 item/);
});

test('payment, proses & done memakai template dengan mention', async () => {
  const s = createScenario();
  await s.send({ text: '.addpay dana|DANA 0812 a.n. Yann', group: true, admin: true });
  assert.equal(await s.send({ text: 'dana', group: true, from: USER }), 'DANA 0812 a.n. Yann');
  assert.match(await s.send({ text: '.listpay', group: true }), /dana/);
  await s.send({ text: '.setproses Halo @user, @item sedang @status', group: true, admin: true });
  const quoted = { sender: USER, key: { id: 'Q' }, message: {} };
  assert.equal(await s.send({ text: '.proses AM12', group: true, admin: true, quoted }), 'Halo @6281299999999, AM12 sedang Proses');
  assert.match(await s.send({ text: '.done', group: true, admin: true, quoted }), /SELESAI[\s\S]*Produk/);
  assert.match(await s.send({ text: '.delpay dana', group: true, admin: true }), /dihapus/);
});

test('reseller, premium trial, kode redeem, limit permanen', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.addreseller 6281299999999' }), /ditambahkan sebagai Reseller/);
  assert.match(await s.send({ text: '.cekres', from: USER }), /adalah \*Reseller\*/);
  assert.match(await s.send({ text: '.addreseller 6281299999999', from: USER }), /DENIED owner/);
  assert.match(await s.send({ text: '.trialprem', from: USER }), /Trial premium aktif/);
  assert.ok(s.db.isPremium(USER));
  assert.match(await s.send({ text: '.trialprem', from: USER }), /SUDAH PERNAH/);
  assert.match(await s.send({ text: '.buatkode HEMAT limit:5 1' }), /dibuat/);
  const before = s.db.user(USER).limit;
  assert.match(await s.send({ text: '.redeem hemat', from: USER }), /\+5 limit/);
  assert.equal(s.db.user(USER).limit, before + 5);
  assert.match(await s.send({ text: '.redeem HEMAT', from: '6281277777777@s.whatsapp.net' }), /kuota klaim/i);
  assert.match(await s.send({ text: '.setlimit 6281299999999 50' }), /50 limit\/hari/);
  s.db.user(USER).limitDate = '2000-01-01';
  assert.equal(s.db.user(USER).limit, 50);
  assert.match(await s.send({ text: '.kapanreset', from: USER }), /Reset dalam/);
});

test('sewa grup & sistem sewa memblokir grup yang belum sewa', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.sistemsewa on' }), /AKTIF/);
  assert.match(await s.send({ text: '.ping', group: true, from: USER }), /belum sewa/);
  assert.equal(await s.send({ text: '.ping', group: true, from: USER }), '', 'notifikasi tidak diulang terus');
  assert.match(await s.send({ text: '.addsewagc 30', group: true }), /Sewa grup aktif/);
  assert.match(await s.send({ text: '.ceksewagc', group: true, from: USER }), /Sewa aktif/);
  assert.match(await s.send({ text: '.ping', group: true, from: USER }), /Pong/);
  assert.match(await s.send({ text: '.delsewagc', group: true }), /dihapus/);
});

test('order premium manual: buyprem -> acctrx mengaktifkan premium', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.buyprem 3', from: USER }), /Min 7 hari/);
  await s.send({ text: '.buyprem 7', from: USER });
  const order = s.db.raw().orders[0];
  assert.equal(order.status, 'pending');
  assert.equal(order.amount, Number(require('../../settingsbot.js').harga.prem) * 7);
  assert.ok(s.sent.some(x => x.jid === `${require('../../settingsbot.js').owner.number}@s.whatsapp.net` && /Order baru/.test(x.content.text)), 'owner diberi tahu');
  assert.match(await s.send({ text: `.acctrx ${order.id}` }), /dikonfirmasi/);
  assert.ok(s.db.isPremium(USER));
  assert.match(await s.send({ text: `.acctrx ${order.id}` }), /sudah diproses/);
});

test('respon otomatis, custom command, badword', async () => {
  const s = createScenario();
  const quoted = { text: 'Halo juga!', isMedia: false };
  assert.match(await s.send({ text: '.addrespon halo', quoted }), /disimpan/);
  assert.equal(await s.send({ text: 'HALO', from: USER }), 'Halo juga!');
  assert.match(await s.send({ text: '.addcase rules|Dilarang spam', from: OWNER }), /dibuat/);
  assert.equal(await s.send({ text: '.rules', from: USER }), 'Dilarang spam');
  assert.match(await s.send({ text: '.addcase menu|x' }), /sudah dipakai/);
  await s.send({ text: '.addbadword anjir', group: true, admin: true });
  await s.send({ text: '.antibadword on', group: true, admin: true });
  assert.match(await s.send({ text: 'wah anjir keren', group: true, from: USER }), /kata terlarang/);
  assert.ok(s.sent.some(x => x.content?.delete), 'pesan dihapus');
  assert.equal(await s.send({ text: 'kata biasa', group: true, from: USER }), '');
});
