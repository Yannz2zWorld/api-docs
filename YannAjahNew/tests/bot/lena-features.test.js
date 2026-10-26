'use strict';
// Fitur yang ada di Lena AI tetapi tidak di Yann AI V15: upscaler, igquote, yannedit (V15) / lenaedit,
// sticker.ly (cari + kirim pack), reply style, getfile, cektrx. API = APIZ2Z (transport tiruan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Apiz2zClient } = require('../../library/apiz2z');
const { loadRegistry, mockCtx, freshStore } = require('./feature-harness');
const { createYannajah } = require('../../library/yannajah');
const DataBase = require('../../source/database');

const BASE_CFG = { baseUrl: 'https://apiz2z.web.id', apiKey: 'test-key-123', allowedHosts: ['apiz2z.web.id'], timeoutMs: 1000, retries: 0, perMinute: 1000, concurrency: 4, maxResponseBytes: 1 << 20, cacheTtlMs: 0 };
const json = (status, obj) => ({ status, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify(obj)) });
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082', 'hex');
const png = () => ({ status: 200, headers: { 'content-type': 'image/png' }, body: PNG });

function client(handler) {
  const calls = [];
  const transport = async (url, opts) => { const u = new URL(url); calls.push({ path: u.pathname, query: Object.fromEntries(u.searchParams), opts }); return handler(u, calls.length); };
  return { api: new Apiz2zClient(BASE_CFG, { transport }), calls };
}
const { registry } = loadRegistry();
const F = name => registry.resolve(name);
const image = { mime: 'image/jpeg', download: async () => PNG };
const run = (name, opts) => { const r = mockCtx({ feature: F(name), store: freshStore(), ...opts }); return { ...r, done: F(name).run(r.ctx) }; };

test('upscaler: default 4x, argumen 2x, dan cadangan ke upscale-v3 bila endpoint utama gagal', async () => {
  const a = client(() => png());
  const x = run('upscaler', { text: '', api: a.api, media: image });
  await x.done;
  assert.equal(a.calls[0].path, '/api/tools/upscale');
  assert.match(x.files[0].opts.caption, /Skala : 4x/);
  const b = client((u, n) => (n === 1 ? json(503, { status: false, code: 'ENDPOINT_UNAVAILABLE' }) : png()));
  const y = run('upscaler', { text: '2x', api: b.api, media: image });
  await y.done;
  assert.deepEqual(b.calls.map(c => c.path), ['/api/tools/upscale', '/api/tools/upscale-v3']);
  assert.match(y.files[0].opts.caption, /Skala : 2x/);
  await assert.rejects(run('upscaler', { text: '3x', api: a.api, media: image }).done, /2x atau 4x/);
  await assert.rejects(run('upscaler', { text: '', api: a.api }).done, /reply gambar/);
});

test('upscale2x/upscale4x memakai skala tetap; error kuota tidak mencoba cadangan', async () => {
  const a = client(() => png());
  const x = run('upscale2x', { text: '', api: a.api, media: image });
  await x.done;
  assert.match(x.files[0].opts.caption, /Skala : 2x/);
  const q = client(() => json(429, { status: false, code: 'QUOTA_EXCEEDED' }));
  await assert.rejects(run('upscale4x', { text: '', api: q.api, media: image }).done, e => e.code === 'QUOTA_EXCEEDED');
  assert.equal(q.calls.length, 1, 'tidak ada percobaan ke endpoint cadangan');
});

test('igquote: teks dari argumen atau pesan yang di-reply, avatar dari foto profil', async () => {
  const a = client(() => png());
  const socket = { profilePictureUrl: async jid => `https://pps.whatsapp.net/${jid.split('@')[0]}.jpg` };
  const x = run('ignote', { text: 'hidup itu indah', api: a.api, extra: { socket } });
  await x.done;
  assert.equal(a.calls[0].path, '/api/canvas/igqc');
  assert.equal(a.calls[0].query.text, 'hidup itu indah');
  assert.match(a.calls[0].query.image, /6281200000001\.jpg$/);
  const y = run('igquote', { text: '', api: a.api, quoted: { text: 'kata dia', sender: '6289900000000@s.whatsapp.net' }, extra: { socket } });
  await y.done;
  assert.equal(a.calls[1].query.text, 'kata dia');
  assert.match(a.calls[1].query.image, /6289900000000\.jpg$/, 'avatar milik pengirim pesan yang di-reply');
  await assert.rejects(run('igquote', { text: '', api: a.api }).done, /Contoh/);
});

test('yannedit (premium): butuh gambar + perintah; Banana Edit, cadangan Nano Banana', async () => {
  assert.equal(F('yannedit').permission, 'premium');
  assert.equal(F('yanedit'), F('yannedit'));
  const a = client((u, n) => (n === 1 ? json(502, { status: false, code: 'ENDPOINT_UNAVAILABLE' }) : png()));
  const x = run('yannedit', { text: 'ubah jadi anime', api: a.api, media: image });
  await x.done;
  assert.deepEqual(a.calls.map(c => c.path), ['/api/maker/bananaai', '/api/ai/nano-banana']);
  assert.match(x.files[0].opts.caption, /Perintah : ubah jadi anime/);
  await assert.rejects(run('yannedit', { text: 'ubah', api: a.api }).done, /gambar/);
  await assert.rejects(run('yannedit', { text: '', api: a.api, media: image }).done, /Perintahnya apa/);
});

test('sticker.ly: .caristiker menampilkan daftar bernomor, .caristikerdown <nomor> mengirim stikernya', async () => {
  const net = require('../../library/net');
  const exif = require('../../library/exif');
  const orig = { download: net.download, addExif: exif.addExif };
  net.download = async () => ({ buffer: Buffer.from('RIFF0000WEBPVP8 '), mime: 'image/webp' });
  exif.addExif = async buf => buf;
  try {
    const packs = [{ name: 'Kucing Lucu', author: { name: 'Budi' }, stickerCount: 3, url: 'https://sticker.ly/s/ABC123' }, { name: 'Bukan', url: 'https://contoh.com/x' }];
    const a = client(u => (u.pathname === '/api/search/stickerly'
      ? json(200, { status: true, data: packs })
      : json(200, { status: true, data: { name: 'Kucing Lucu', author: 'Budi', stickers: [{ imageUrl: 'https://cdn.sticker.ly/1.webp' }, { imageUrl: 'https://cdn.sticker.ly/2.webp' }] } })));
    const store = freshStore();
    const s = mockCtx({ feature: F('caristiker'), text: 'kucing', store, api: a.api });
    await F('caristiker').run(s.ctx);
    assert.match(s.replies[0], /1\. Kucing Lucu — Budi \(3 stiker\)/);
    assert.ok(!s.replies[0].includes('contoh.com'), 'hanya URL sticker.ly');
    const d = mockCtx({ feature: F('caristikerpack'), text: '1', store, api: a.api });
    d.ctx.args = ['1'];
    await F('caristikerpack').run(d.ctx);
    assert.equal(a.calls[1].path, '/api/download/stickerly');
    assert.equal(a.calls[1].query.url, 'https://sticker.ly/s/ABC123');
    assert.match(d.replies[0], /Pack : Kucing Lucu[\s\S]*Stiker : 2/);
    assert.equal(d.files.length, 2);
    assert.equal(d.files[0].input.mime, 'image/webp');
    const bad = mockCtx({ feature: F('caristikerdown'), text: 'https://evil.example/s/1', store, api: a.api });
    bad.ctx.args = ['https://evil.example/s/1'];
    await assert.rejects(F('caristikerdown').run(bad.ctx), /sticker\.ly/);
  } finally { net.download = orig.download; exif.addExif = orig.addExif; }
});

test('setreplystyle: owner memilih text/card; card menambah kartu link ke balasan teks', async () => {
  const store = freshStore();
  const x = mockCtx({ feature: F('setreply'), text: 'v1', store, isOwner: true });
  x.ctx.args = ['v1'];
  await F('setreply').run(x.ctx);
  assert.equal(store.data.settings.replyStyle, 'card');
  const sent = [];
  const config = { ...require('../../settingsbot.js'), retry: { sendMessage: 0 } };
  const y = createYannajah({ config, logger: console, store: { data: store.data, markDirty() {} }, license: { isActive: () => true, status: () => ({}) }, api: null, registry: { features: new Map() }, wa: { sock: { sendMessage: async (jid, c) => { sent.push(c); return {}; } } } });
  await y.reply({ chat: '6281@s.whatsapp.net', raw: {} }, 'halo @6289900000000');
  assert.equal(sent[0].contextInfo.externalAdReply.title, config.bot.name);
  assert.deepEqual(sent[0].contextInfo.mentionedJid, ['6289900000000@s.whatsapp.net']);
  await y.reply({ chat: '6281@s.whatsapp.net', raw: {} }, { image: PNG, caption: 'x' });
  assert.equal(sent[1].contextInfo, undefined, 'media tidak diubah');
  store.data.settings.replyStyle = 'text';
  await y.reply({ chat: '6281@s.whatsapp.net', raw: {} }, 'biasa');
  assert.equal(sent[2].contextInfo, undefined);
  assert.equal(DataBase.DEFAULTS().settings.replyStyle, undefined, 'default: teks biasa');
});

test('getfile: daftar tanpa secret/data runtime, kirim file sebagai dokumen, tolak path di luar daftar', async () => {
  const { listFiles, resolveFile } = require('../../lib/getfile');
  const files = listFiles();
  assert.ok(files.includes('settingsbot.js') && files.includes('yannai-cmd.js') && files.includes('.env.example'));
  assert.ok(!files.some(f => f === '.env' || f.startsWith('node_modules/') || f.startsWith('.git/') || f.startsWith('library/database/') || f.startsWith('session/')));
  for (const bad of ['.env', '../../../etc/passwd', '/etc/passwd', 'node_modules/pg/package.json', 'library/database/database.json', '99999']) assert.equal(resolveFile(bad), null, bad);
  const x = mockCtx({ feature: F('getfile'), text: 'settingsbot.js', store: freshStore(), isOwner: true });
  await F('getfile').run(x.ctx);
  assert.equal(x.files[0].opts.asDocument, true);
  assert.equal(x.files[0].opts.fileName, 'settingsbot.js');
  const l = mockCtx({ feature: F('getfile'), text: 'plugins/owner/getfile', store: freshStore(), isOwner: true });
  await F('getfile').run(l.ctx);
  assert.match(l.replies[0], /plugins\/owner\/getfile\.js[\s\S]*plugins\/owner\/getfiledest\.js/);
  for (const n of ['getfile', 'getfiledest', 'getfilehelp']) assert.equal(F(n).permission, 'owner');
});

test('cektrx: user melihat status order miliknya saja; owner tanpa ID melihat daftar pending', async () => {
  const store = freshStore();
  store.data.orders = [
    { id: 'PREM-ABC1', user: '6281200000001@s.whatsapp.net', product: 'premium', days: 7, amount: 7000, status: 'paid', createdAt: Date.now(), paidAt: Date.now() },
    { id: 'SEWA-XYZ9', user: '6289900000000@s.whatsapp.net', product: 'sewa', days: 30, amount: 30000, status: 'pending', createdAt: Date.now() }
  ];
  const mine = mockCtx({ feature: F('cektrx'), text: 'prem-abc1', store });
  mine.ctx.args = ['prem-abc1'];
  await F('cektrx').run(mine.ctx);
  assert.match(mine.replies[0], /PREM-ABC1[\s\S]*lunas \/ berhasil/);
  const other = mockCtx({ feature: F('cektrx'), text: 'SEWA-XYZ9', store });
  other.ctx.args = ['SEWA-XYZ9'];
  await assert.rejects(F('cektrx').run(other.ctx), /tidak ditemukan/);
  const owner = mockCtx({ feature: F('cektrx'), text: '', store, isOwner: true });
  owner.ctx.args = [];
  await F('cektrx').run(owner.ctx);
  assert.match(owner.replies[0], /SEWA-XYZ9/);
  assert.ok(!owner.replies[0].includes('PREM-ABC1'));
});
