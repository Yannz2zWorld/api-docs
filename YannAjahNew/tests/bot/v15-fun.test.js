'use strict';
// Fitur V15 batch fun/primbon/ekonomi/menu/font: nilai logika & output (tanpa WhatsApp).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createScenario } = require('./scenario-harness');

const U = '6281288880001@s.whatsapp.net';

test('primbon: cekaura, nasibbatere, jodohmakanan, planet, niatsholat', async () => {
  const s = createScenario();
  assert.match(await s.send({ text: '.cekaura 15:30', from: U }), /Aura Senja/);
  assert.match(await s.send({ text: '.cekaura pagi', from: U }), /HH:MM/);
  assert.match(await s.send({ text: '.nasibbatere 0', from: U }), /Game over/);
  assert.match(await s.send({ text: '.jodohmakanan seblak', from: U }), /pedes omongannya/);
  assert.match(await s.send({ text: '.planet mars', from: U }), /Olympus Mons/);
  assert.match(await s.send({ text: '.niatsholat subuh', from: U }), /Niat Sholat subuh/);
  assert.match(await s.send({ text: '.hadits', from: U }), /Hadits Harian/);
});

test('tembak -> terimajadian membentuk pasangan, putus menghapusnya', async () => {
  const s = createScenario();
  const B = '6281288880002@s.whatsapp.net';
  assert.match(await s.send({ text: '.tembak 6281288880002', group: true, from: U }), /nembak/);
  assert.match(await s.send({ text: '.terimajadian', group: true, from: B }), /resmi jadian/);
  assert.match(await s.send({ text: '.cekpasangan', group: true, from: U }), /berpasangan dengan/);
  assert.match(await s.send({ text: '.putus', group: true, from: U }), /resmi putus/);
  assert.match(await s.send({ text: '.cekpasangan', group: true, from: U }), /masih jomblo/);
});

test('ekonomi: bank deposit/withdraw, casino all-in, tukarkoin premium, owner addmoney', async () => {
  const s = createScenario();
  await s.send({ text: '.addmoney 6281288880001 1000000' });
  assert.equal(s.db.user(U).money, 1000000);
  assert.match(await s.send({ text: '.bank deposit 400000', from: U }), /Bank : \*400.000/);
  assert.equal(s.db.user(U).bank, 400000);
  assert.match(await s.send({ text: '.bank withdraw all', from: U }), /Di Tangan : \*1.000.000/);
  assert.match(await s.send({ text: '.casino 5000', from: U }), /minimal/);
  const out = await s.send({ text: '.casino all', from: U });
  assert.match(out, /MENANG|KALAH/);
  assert.ok(s.db.user(U).money === 2000000 || s.db.user(U).money === 0);
  await s.send({ text: '.setmoney 6281288880001 1000000' });
  assert.match(await s.send({ text: '.tukarkoin premium 3', from: U }), /Premium sampai/);
  assert.ok(s.db.isPremium(U));
  assert.equal(s.db.user(U).money, 1000000 - 75000 * 3);
});

test('font1..font10 mengubah teks, menu-group menampilkan kategori grup', async () => {
  const s = createScenario();
  assert.equal((await s.send({ text: '.font4 ab', from: U })), '𝐚𝐛');
  assert.match(await s.send({ text: '.menu-group', from: U }), /group/i);
  assert.match(await s.send({ text: '.menu-prem', from: U }), /PREMIUM|premium/);
});
