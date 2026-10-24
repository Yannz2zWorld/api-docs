'use strict';
// Router command (command.js) dengan registry asli dan WhatsApp tiruan: kunci lisensi (ban/disable),
// maintenance, permission, scope, status fitur, limit, cooldown, error, hook.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRouter } = require('../../command');
const { createDatabaseFacade } = require('../../yannajah');
const { loadRegistry, freshStore } = require('./feature-harness');
const baseConfig = require('../../settingsbot.js');

const OWNER = `${baseConfig.owner.number}@s.whatsapp.net`;
const USER = '6281299990001@s.whatsapp.net';

function setup({ active = true, maintenance = { active: false }, hasKey = true, configPatch = {} } = {}) {
  const { registry } = loadRegistry();
  const store = freshStore();
  registry.db = () => store.data;
  const replies = [];
  const license = { isActive: () => active, lockReason: active ? null : 'BOT_BANNED', describe: c => `alasan:${c}`, maintenance: () => maintenance, status: () => ({}) };
  const config = { ...baseConfig, ...configPatch, timeout: { ...baseConfig.timeout, ...(configPatch.timeout || {}) } };
  const yannajah = {
    registry, auth: license, api: { hasKey: () => hasKey }, database: createDatabaseFacade(store, { dailyLimit: 10 }), socket: null,
    plugins: { disable: id => registry.setEnabled(id, false), enable: id => registry.setEnabled(id, true) },
    reply: async (m, c) => { replies.push(typeof c === 'string' ? c : c.text); },
    react: async () => {}, sendmessage: async (jid, c) => { replies.push(c.text || '[media]'); }, sendFile: async () => { replies.push('[file]'); }, health: () => ({})
  };
  const route = createRouter(yannajah, { config, logger: { info() {}, warn() {}, error() {}, debug() {} } });
  const send = (body, { sender = USER, isGroup = false, isAdmin = false, mentionedJid = [] } = {}) => {
    const t = body.trim();
    const isCmd = t.startsWith('.');
    const [command, ...args] = isCmd ? t.slice(1).split(/\s+/) : [];
    return route({ key: { id: 'X' + Math.random() }, id: 'x', chat: isGroup ? '1203630001@g.us' : sender, sender, senderNumber: sender.split('@')[0], isGroup, fromMe: false,
      body: t, isCmd, command: command?.toLowerCase(), prefix: isCmd ? '.' : '', args, text: isCmd ? t.slice(command.length + 1).trim() : t,
      mentionedJid, quoted: null, isAdmin, isBotAdmin: false, raw: {}, getMedia: () => null, groupMetadata: isGroup ? { subject: 'G', participants: [] } : null });
  };
  return { send, replies, registry, store, yannajah };
}

test('lisensi terkunci (bot diban/disable/sesi dicabut): tidak ada fitur jalan; owner diberi tahu alasannya', async () => {
  const t = setup({ active: false });
  await t.send('.upper halo');
  assert.deepEqual(t.replies, []);
  await t.send('.upper halo', { sender: OWNER });
  assert.equal(t.replies.length, 1);
  assert.match(t.replies[0], /alasan:BOT_BANNED/);
  await t.send('halo biasa');   // hook pun tidak jalan
  assert.equal(t.replies.length, 1);
});

test('lisensi aktif: command dijalankan', async () => {
  const t = setup();
  await t.send('.upper halo');
  assert.deepEqual(t.replies, ['HALO']);
});

test('maintenance: pengguna dapat pesan maintenance, owner tetap bisa, fitur allowInMaintenance tetap jalan', async () => {
  const t = setup({ maintenance: { active: true, scope: 'global', message: 'Lagi upgrade' } });
  await t.send('.upper a');
  assert.deepEqual(t.replies, ['🛠️ Lagi upgrade']);
  await t.send('.upper a', { sender: OWNER });
  assert.equal(t.replies[1], 'A');
  await t.send('.status');
  assert.match(t.replies[2], /Lisensi/);
});

test('permission owner/admin dan scope grup/private', async () => {
  const t = setup();
  await t.send('.self');
  assert.equal(t.replies.pop(), baseConfig.mess.owner);
  await t.send('.kick @x');
  assert.equal(t.replies.pop(), baseConfig.mess.group, 'command grup di chat pribadi');
  await t.send('.welcome on', { isGroup: true });
  assert.equal(t.replies.pop(), baseConfig.mess.admin);
  await t.send('.welcome on', { isGroup: true, isAdmin: true });
  assert.match(t.replies.pop(), /dinyalakan/);
  await t.send('.passwordcheck abc', { isGroup: true });
  assert.equal(t.replies.pop(), baseConfig.mess.private);
});

test('premium: fitur premium ditolak untuk user biasa, diterima setelah addprem', async () => {
  const t = setup();
  t.registry.register({ id: 'test.premium', name: 'premonly', category: 'test', description: 'x', permission: 'premium', scope: 'all', status: 'implemented', params: [], dependencies: {}, aliases: [], run: ctx => ctx.reply('ok-prem') });
  await t.send('.premonly');
  assert.equal(t.replies.pop(), baseConfig.mess.prem);
  await t.send(`.addprem ${USER.split('@')[0]} 1`, { sender: OWNER });
  assert.match(t.replies.pop(), /premium sampai/);
  await t.send('.premonly');
  assert.equal(t.replies.pop(), 'ok-prem');
});

test('status fitur: planned, disabled (kebijakan), disabled oleh owner, needs_api_key', async () => {
  const t = setup({ hasKey: false });
  const planned = [...t.registry.features.values()].find(f => f.status === 'planned');
  await t.send(`.${planned.name}`);
  assert.match(t.replies.pop(), /planned/);
  const disabled = [...t.registry.features.values()].find(f => f.status === 'disabled');
  await t.send(`.${disabled.name}`);
  assert.equal(t.replies.pop(), baseConfig.mess.disabled);
  await t.send('.disablefitur upper', { sender: OWNER });
  await t.send('.upper x');
  assert.equal(t.replies.pop(), baseConfig.mess.disabled);
  await t.send('.tiktok https://vt.tiktok.com/x');
  assert.equal(t.replies.pop(), baseConfig.mess.needApiKey);
});

test('limit harian dipotong hanya kalau sukses; habis -> pesan limit; cooldown aktif', async () => {
  const t = setup();
  let fail = false;
  t.registry.register({ id: 'test.limited', name: 'mahal', category: 'test', description: 'x', permission: 'user', scope: 'all', status: 'implemented', params: [], dependencies: {}, aliases: [], limit: 3, cooldown: 0,
    run: async ctx => { if (fail) throw new Error('boom'); await ctx.reply('jalan'); } });
  await t.send('.mahal'); assert.equal(t.replies.pop(), 'jalan');
  await t.send('.mahal'); assert.equal(t.replies.pop(), 'jalan');
  assert.equal(t.store.data.users[USER].limit, 4, '10 - 3 - 3');
  fail = true;
  await t.send('.mahal'); assert.equal(t.replies.pop(), baseConfig.mess.error);
  assert.equal(t.store.data.users[USER].limit, 4, 'gagal tidak memotong limit');
  fail = false;
  await t.send('.mahal'); assert.equal(t.replies.pop(), 'jalan');
  await t.send('.mahal'); assert.equal(t.replies.pop(), baseConfig.mess.limit, 'sisa 1 < biaya 3');
  t.registry.register({ id: 'test.cd', name: 'pelan', category: 'test', description: 'x', permission: 'user', scope: 'all', status: 'implemented', params: [], dependencies: {}, aliases: [], cooldown: 30, run: ctx => ctx.reply('ok') });
  // Command ke-6 user ini dalam 8 detik masih jalan; ke-7 diabaikan diam-diam (anti-spam).
  await t.send('.pelan'); assert.equal(t.replies.pop(), 'ok');
  await t.send('.upper x'); assert.equal(t.replies.length, 0, 'anti-spam');
  const other = { sender: '6281299990002@s.whatsapp.net' };
  await t.send('.pelan', other); assert.equal(t.replies.pop(), 'ok');
  await t.send('.pelan', other); assert.match(t.replies.pop(), /Tunggu \d+ detik/);
});

test('error penggunaan dibalas pesan penggunaan; command salah ketik diberi saran', async () => {
  const t = setup();
  await t.send('.upper');
  assert.match(t.replies.pop(), /Teksnya mana\?/);
  await t.send('.uppr halo');
  assert.match(t.replies.pop(), /Mungkin maksud kamu: .*\.upper/);
});

test('mode self, user diblokir lokal, dan grup di-mute diabaikan', async () => {
  const t = setup();
  await t.send('.self', { sender: OWNER });
  t.replies.length = 0;
  await t.send('.upper a');
  assert.deepEqual(t.replies, []);
  await t.send('.public', { sender: OWNER });
  await t.send(`.banuser ${USER.split('@')[0]}`, { sender: OWNER });
  t.replies.length = 0;
  await t.send('.upper a');
  assert.deepEqual(t.replies, []);
  await t.send(`.unbanuser ${USER.split('@')[0]}`, { sender: OWNER });
  await t.send('.mute on', { isGroup: true, isAdmin: true });
  t.replies.length = 0;
  await t.send('.upper a', { isGroup: true });
  assert.deepEqual(t.replies, []);
});

test('hook AFK: keluar dari AFK saat mengirim pesan berikutnya', async () => {
  const t = setup();
  await t.send('.afk tidur');
  assert.match(t.replies.pop(), /AFK: tidur/);
  await t.send('aku balik');
  assert.match(t.replies.pop(), /Selamat datang kembali/);
});

test('timeout command: dibatalkan dengan pesan, router tetap jalan', async () => {
  const t = setup({ configPatch: { timeout: { commandMs: 50 } } });
  t.registry.register({ id: 'test.hang', name: 'macet', category: 'test', description: 'x', permission: 'user', scope: 'all', status: 'implemented', params: [], dependencies: {}, aliases: [], run: () => new Promise(() => {}) });
  await t.send('.macet');
  assert.match(t.replies.pop(), /terlalu lama/);
  await t.send('.upper ok');
  assert.equal(t.replies.pop(), 'OK');
});

test('maintenance lokal (.maintenance on), banfitur per grup, setdaftar dari chat', async () => {
  const t = setup();
  await t.send('.maintenance on Lagi beres-beres', { sender: OWNER });
  t.replies.length = 0;
  await t.send('.upper a');
  assert.deepEqual(t.replies, ['🛠️ Lagi beres-beres']);
  await t.send('.maintenance off', { sender: OWNER });
  t.replies.length = 0;
  await t.send('.upper a');
  assert.deepEqual(t.replies, ['A']);

  await t.send('.banfitur upper', { isGroup: true, isAdmin: true });
  t.replies.length = 0;
  await t.send('.upper a', { isGroup: true });
  assert.match(t.replies[0], /dilarang di grup ini/);
  t.replies.length = 0;
  await t.send('.upper a', { sender: '6281299990003@s.whatsapp.net' });   // chat pribadi tidak terpengaruh
  assert.deepEqual(t.replies, ['A']);

  await t.send('.setdaftar on', { sender: OWNER });
  t.replies.length = 0;
  await t.send('.lower B', { sender: '6281299990002@s.whatsapp.net' });
  assert.match(t.replies[0], /Daftar dulu/);
});
