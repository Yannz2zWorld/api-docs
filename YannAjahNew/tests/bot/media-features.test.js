'use strict';
// Uji fitur media / stiker / gambar dengan ffmpeg & Jimp SUNGGUHAN. Fixture dibuat ffmpeg (lavfi),
// tiap fitur dijalankan lewat run(ctx) dan file yang dikirim diperiksa tipe aslinya (magic bytes).
// Hasil digabung ke reports/feature-tests.json. Dilewati kalau ffmpeg tidak tersedia.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { loadRegistry, mockCtx, freshStore } = require('./feature-harness');
const { sniffMime } = require('../../library/function');

let ffmpegOk = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); } catch { ffmpegOk = false; }
const skip = ffmpegOk ? false : 'ffmpeg tidak tersedia';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'yan-fx-'));
const fx = {};
const { registry } = loadRegistry();
const results = {};

before(() => {
  if (skip) return;
  const run = (args, out) => { execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args, path.join(dir, out)]); return fs.readFileSync(path.join(dir, out)); };
  fx.audio = run(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=2'], 'a.mp3');
  fx.video = run(['-f', 'lavfi', '-i', 'testsrc=duration=2:size=160x120:rate=10', '-pix_fmt', 'yuv420p'], 'v.mp4');
  fx.image = run(['-f', 'lavfi', '-i', 'testsrc=size=120x90', '-frames:v', '1'], 'i.png');
  fx.webp = run(['-f', 'lavfi', '-i', 'color=c=blue:s=512x512', '-frames:v', '1', '-c:v', 'libwebp'], 's.webp');
});
after(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  const file = path.join(__dirname, '..', '..', 'reports', 'feature-tests.json');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).results || {}; } catch {}
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), results: { ...prev, ...results } }, null, 1));
});

// fitur -> [fixture, mime fixture, args, regex mime hasil]
function plan(f) {
  if (f.category === 'image') return f.name === 'imageinfo' ? ['image', 'image/png', [], null] : ['image', 'image/png', f.name === 'resize' ? ['60'] : [], /^image\/png$/];
  if (f.category === 'sticker') {
    if (f.name === 'sticker') return ['image', 'image/png', [], /^image\/webp$/];
    if (f.name === 'take') return ['webp', 'image/webp', ['Pack', '|', 'Me'], /^image\/webp$/];
    return ['webp', 'image/webp', [], null];
  }
  if (f.category === 'media') {
    if (f.name === 'toimg') return ['webp', 'image/webp', [], /^image\/png$/];
    if (f.name === 'tovideo') return ['video', 'video/mp4', [], /^video\/mp4$/];
    if (f.name === 'togif') return ['video', 'video/mp4', [], /^video\/mp4$/];
    if (f.name === 'tovn') return ['audio', 'audio/mpeg', [], /^audio\/ogg$/];
    if (f.name === 'volumeaudio') return ['audio', 'audio/mpeg', ['1.5'], /^audio\/mpeg$/];
    if (f.name === 'potongaudio') return ['audio', 'audio/mpeg', ['0', '1'], /^audio\/mpeg$/];
    return ['audio', 'audio/mpeg', [], /^audio\/mpeg$/];
  }
  return null;
}

for (const f of registry.features.values()) {
  const p = plan(f);
  if (!p) continue;
  test(`media ${f.id}`, { skip }, async () => {
    const [kind, mime, args, outRe] = p;
    const media = { mime, type: kind === 'webp' ? 'stickerMessage' : `${kind}Message`, download: async () => fx[kind] };
    const text = args.join(' ').replace(' | ', '|');
    const { ctx, replies, files } = mockCtx({ feature: f, text, store: freshStore(), media });
    ctx.args = args.filter(a => a !== '|');
    await f.run(ctx);
    let ok;
    if (outRe) {
      const sent = files[0]?.input;
      const buf = sent?.buffer || sent;
      ok = Buffer.isBuffer(buf) && buf.length > 0 && outRe.test(sniffMime(buf)?.mime || sent.mime);
    } else ok = replies.length > 0 && !/gagal/i.test(replies.join(' '));
    results[f.id] = { passed: ok ? 1 : 0, failed: ok ? 0 : 1, cases: 1 };
    assert.ok(ok, `${f.id}: files=${files.length} replies=${JSON.stringify(replies).slice(0, 200)}`);
  });
}

test('fitur media tanpa input media ditolak dengan pesan penggunaan', { skip }, async () => {
  const f = registry.resolve('sticker');
  const { ctx } = mockCtx({ feature: f, store: freshStore(), media: null });
  await assert.rejects(f.run(ctx), e => e.name === 'UsageError');
});
