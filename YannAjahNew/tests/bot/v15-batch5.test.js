'use strict';
// Fitur V15 tambahan (batch 5): edit foto AI, karakter anime, efek teks, sertifikat, game, PDF,
// on/off grup, prefix, jadwal kirim, pengingat sholat, alias V15. APIZ2Z ditiru (tanpa jaringan).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadRegistry, mockCtx, freshStore } = require('./feature-harness');
const { sniffMime } = require('../../library/function');

const { registry } = loadRegistry();
const F = n => { const f = registry.resolve(n); assert.ok(f, `command ${n} ada`); return f; };
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

test('alias nama command V15 menunjuk fitur yang benar', () => {
  const map = { blokir: 'owner.block', unblok: 'owner.unblock', selengkapnya: 'text.readmore', mathchallenge: 'game.math', tictactoe2: 'game.tictactoe',
    vol: 'media.volume', getaudio: 'media.tomp3', mirror2: 'image.mirror', randomdadu: 'random.dadu.sticker', anime2d: 'image.to2d', removeobj: 'image.hapusobjek',
    animeasuna: 'anime.asuna', flappy: 'game.html.flappybird', hcr: 'game.html.hillclimb', ytgoldbutton: 'maker.goldbutton', buronan: 'maker.wanted',
    nasib: 'fun.ramalannasib', suamiistri: 'fun.ramalansuamiistri', ptvtovid: 'media.ptvtovideo', img2pdf: 'tools.imagetopdf', userinfo: 'user.infouser' };
  for (const [alias, id] of Object.entries(map)) assert.equal(F(alias).id, id, alias);
  for (const a of ['play1', 'capcutdownload', 'beritacnbc', 'glitchtext', 'bratbiasa', 'jodohbali', 'rembg', 'tebakff', 'threadsdown', 'stalktiktok']) assert.equal(F(a).source, 'apiz2z', a);
});

test('edit foto AI: kirim gambar + prompt gaya ke APIZ2Z bananaai, hasil dikirim', async () => {
  const calls = [];
  const api = { post: async (path, params, file) => { calls.push({ path, params, file }); return { kind: 'media', buffer: PNG, mime: 'image/png' }; } };
  const { ctx, files } = mockCtx({ feature: F('toanime'), store: freshStore(), api, media: { mime: 'image/jpeg', download: async () => PNG } });
  await F('toanime').run(ctx);
  assert.equal(calls[0].path, '/api/maker/bananaai'); assert.match(calls[0].params.prompt, /anime/i); assert.ok(Buffer.isBuffer(calls[0].file.buffer));
  assert.equal(files.length, 1);
  const noImg = mockCtx({ feature: F('toanime'), store: freshStore(), api, media: null });
  await assert.rejects(F('toanime').run(noImg.ctx), e => e.name === 'UsageError');
  const hapus = mockCtx({ feature: F('hapusobjek'), text: 'orang di belakang', store: freshStore(), api, media: { mime: 'image/png', download: async () => PNG } });
  await F('hapusobjek').run(hapus.ctx);
  assert.match(calls[1].params.prompt, /orang di belakang/);
});

test('karakter anime: cari di Pinterest APIZ2Z lalu kirim satu gambar', async () => {
  const api = { get: async (path, params) => ({ kind: 'json', data: { status: true, result: [{ image: 'https://i.pinimg.com/a.jpg' }, { image: 'https://i.pinimg.com/b.jpg' }], q: params.q } }) };
  const { ctx, files } = mockCtx({ feature: F('nezuko'), store: freshStore(), api });
  await F('nezuko').run(ctx);
  assert.match(files[0].input, /^https:\/\/i\.pinimg\.com\/[ab]\.jpg$/);
});

test('efek teks, sertifikat, wanted: PNG lokal', async () => {
  for (const n of ['glowingtext', 'luxurygold', 'galaxywallpaper', 'stkganteng', 'sertifikat']) {
    const { ctx, files } = mockCtx({ feature: F(n), text: 'Budi', store: freshStore() });
    await F(n).run(ctx);
    assert.equal(sniffMime(files[0].input.buffer)?.mime, 'image/png', n);
  }
  const { ctx } = mockCtx({ feature: F('luxurygold'), text: '', store: freshStore() });
  await assert.rejects(F('luxurygold').run(ctx), e => e.name === 'UsageError');
});

test('game HTML dikirim sebagai dokumen .html; 2048 chat jalan', async () => {
  const { ctx, files } = mockCtx({ feature: F('snake'), store: freshStore() });
  await F('snake').run(ctx);
  assert.equal(files[0].opts.asDocument, true); assert.match(files[0].opts.fileName, /\.html$/);
  assert.match(files[0].input.buffer.toString('utf8'), /^<!doctype html>/i);
  const g = require('../../lib/game2048');
  assert.deepEqual(g.slideRow([2, 2, 4, 0]).row, [4, 4, 0, 0]);
  assert.equal(g.canMove([[2, 4, 2, 4], [4, 2, 4, 2], [2, 4, 2, 4], [4, 2, 4, 2]]), false);
});

test('gambar ke PDF menghasilkan PDF valid', async () => {
  const { Jimp } = require('jimp');
  const png = await new Jimp({ width: 50, height: 40, color: 0xff0000ff }).getBuffer('image/png');
  const { ctx, files } = mockCtx({ feature: F('imagetopdf'), text: 'tugas', store: freshStore(), media: { mime: 'image/png', download: async () => png } });
  await F('imagetopdf').run(ctx);
  const pdf = files[0].input.buffer;
  assert.equal(pdf.slice(0, 5).toString(), '%PDF-'); assert.match(pdf.slice(-6).toString(), /%%EOF/); assert.equal(files[0].opts.fileName, 'tugas.pdf');
});

test('prefix owner: tambah, daftar, hapus (minimal 1)', async () => {
  const store = freshStore();
  const run = async (n, text) => { const x = mockCtx({ feature: F(n), text, store, isOwner: true }); await F(n).run(x.ctx); return x.replies.join('\n'); };
  assert.match(await run('addprefix', '$'), /\$/);
  assert.match(await run('listprefix', ''), /\$/);
  assert.match(await run('delprefix', '$'), /dihapus/);
  assert.ok(!store.data.settings.prefix.includes('$'));
});

test('.on/.off menjalankan pengaturan grup dengan izin yang sama', async () => {
  const store = freshStore();
  const reg = { list: () => [...registry.features.values()], get: n => registry.resolve(n) };
  const { ctx, replies } = mockCtx({ feature: F('on'), text: 'antilink', store, isGroup: true, extra: { m: { isBotAdmin: true }, ctx: { isAdmin: true } } });
  ctx.yannajah.plugins = reg;
  await F('on').run(ctx);
  assert.equal(ctx.group.antilink, true, replies.join());
  const list = mockCtx({ feature: F('off'), text: '', store, isGroup: true });
  list.ctx.yannajah.plugins = reg;
  await F('off').run(list.ctx);
  assert.match(list.replies[0], /antilink/);
});

test('jadwal kirim & pengingat sholat: parser', () => {
  const { parseWhen } = require('../../lib/schedulesend');
  const now = Date.UTC(2026, 9, 25, 3, 0, 0);   // 10:00 WIB
  assert.equal(parseWhen('10m', 'Asia/Jakarta', now) - now, 600000);
  assert.equal((parseWhen('11:30', 'Asia/Jakarta', now) - now) / 60000, 90);
  assert.equal(parseWhen('kapan2', 'Asia/Jakarta', now), null);
  const { extractTimes } = require('../../lib/autosholat');
  assert.deepEqual(extractTimes({ data: [{ tanggal: '2026-10-25', Fajr: '04:05 (WIB)', Dhuhr: '11:41', Asr: '14:56', Maghrib: '17:50', Isha: '19:01' }] }, '2026-10-25'),
    { subuh: '04:05', dzuhur: '11:41', ashar: '14:56', maghrib: '17:50', isya: '19:01' });
});

test('plugin format Lena/V15 (handler.command) dari plugins/contoh jalan', async () => {
  const f = F('hai');
  assert.equal(f.id, 'legacy.halo'); assert.equal(f.category, 'contoh'); assert.equal(f.usage, '<nama>');
  const sent = [];
  const sock = { sendMessage: async (jid, c) => sent.push(c) };
  const m = { chat: '628@s.whatsapp.net', key: { id: 'X' } };
  const replies = [];
  const ctx = { m, reply: async t => replies.push(t), legacyContext: () => ({ sock, text: 'Budi', command: 'hai', prefix: '.', isCreator: false, Reply: async t => replies.push(t) }) };
  await f.run(ctx);
  assert.match(replies[0], /Halo Budi/); assert.ok(sent[0].react);
  assert.equal(typeof m.reply, 'function');
});

test('settingsbot.js gaya global.*: nilai di atas dipakai bot', () => {
  const cfg = require('../../settingsbot.js');
  assert.equal(cfg.pairing.customCode, global.custompairing);
  assert.equal(cfg.bot.name, process.env.BOT_NAME || global.botname);
  assert.equal(cfg.mess.owner, global.mess.owner); assert.equal(cfg.owner.number, process.env.OWNER_NUMBER || global.owner);
});
