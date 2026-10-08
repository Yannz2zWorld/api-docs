// Fake Call — port langsung dari case 'fakecall' di bot (YannzAjah-cmd.js), tanpa mengubah fiturnya:
// background https://cdn-alip.clutch.web.id/api/u/mrg7jq0l.jpg, deteksi area green screen untuk
// posisi foto, nama (bold 42px, y=250) dan jam (24px, y=305), hasil JPEG.
// Penyesuaian hanya untuk web: library @napi-rs/canvas (API sama dengan 'canvas', jalan di Vercel),
// font dibundel dan didaftarkan dengan nama "Sans-serif" seperti di bot (Vercel tidak punya font
// sistem), dan foto diambil dari unggahan / URL (pengganti "reply gambar" di WhatsApp).
const path = require('path');
const { downloadFile } = require('../lib/theresav');

const BG_URL = 'https://cdn-alip.clutch.web.id/api/u/mrg7jq0l.jpg';
const MAX_PHOTO = 8 * 1024 * 1024;
const FONT_DIR = path.join(__dirname, '..', 'views', 'assets', 'fonts');

let canvasLib = null;
function canvas() {
  if (canvasLib) return canvasLib;
  const lib = require('@napi-rs/canvas');
  lib.GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter_400Regular.ttf'), 'Sans-serif');
  lib.GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter_700Bold.ttf'), 'Sans-serif');
  canvasLib = lib;
  return lib;
}

let bgCache = null;
async function background() {
  if (bgCache) return bgCache;
  const r = await fetch(BG_URL, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw Object.assign(new Error('bg'), { code: 'BG_UNAVAILABLE' });
  bgCache = Buffer.from(await r.arrayBuffer());
  return bgCache;
}

const fail = (res, status, error, message) => res.status(status).json({ status: false, error, message });

module.exports = {
  name: 'Fake Call',
  desc: 'Buat gambar fake call (panggilan WhatsApp) dengan foto, nama, dan jam.',
  category: 'Maker',
  path: '/api/maker/fakecall?name=&time=',
  upload: true,
  params: [
    { name: 'name', required: true, placeholder: 'nama' },
    { name: 'time', required: true, placeholder: '12.00' },
    { name: 'photo', required: true, type: 'file', accept: 'image/*', placeholder: 'Unggah gambar' }
  ],
  async run(req, res) {
    const name = typeof req.query.name === 'string' ? req.query.name : '';
    const time = typeof req.query.time === 'string' ? req.query.time : '';
    if (!name || !time) return fail(res, 400, 'PARAM_REQUIRED', "Parameter 'name' dan 'time' wajib diisi (contoh: nama | 12.00).");

    let gambarNya = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;
    if (gambarNya && gambarNya.length > MAX_PHOTO) return fail(res, 413, 'FILE_TOO_LARGE', 'Gambar maksimal 8 MB.');
    const url = typeof req.query.photo === 'string' && req.query.photo.trim() ? req.query.photo.trim() : (typeof req.query.url === 'string' ? req.query.url.trim() : '');
    if (!gambarNya && url) {
      try { gambarNya = (await downloadFile(url)).buf; } catch (e) { return fail(res, 400, e.code || 'FILE_FETCH_FAILED', e.message); }
    }
    if (!gambarNya) return fail(res, 400, 'PARAM_REQUIRED', 'Unggah gambar untuk fake call.');

    let lib;
    try { lib = canvas(); } catch { return fail(res, 503, 'RENDERER_UNAVAILABLE', 'Pembuat gambar belum tersedia di server. Kuota tidak dipotong.'); }
    const { createCanvas, loadImage } = lib;

    let ppNya;
    try { ppNya = await loadImage(gambarNya); } catch { return fail(res, 400, 'NOT_IMAGE', 'File harus gambar.'); }
    let bgNya;
    try { bgNya = await background(); } catch { return fail(res, 502, 'UPSTREAM_FAILED', 'Background fake call tidak bisa diambil. Kuota tidak dipotong.'); }

    // ---- sama seperti di bot ----
    let bg2Nya = await loadImage(bgNya)
    const canvasEl = createCanvas(bg2Nya.width, bg2Nya.height)
    const ctx = canvasEl.getContext('2d')
    ctx.drawImage(bg2Nya, 0, 0, canvasEl.width, canvasEl.height)

    // Track green screen
    const bgData = ctx.getImageData(0, 0, canvasEl.width, canvasEl.height).data
    let minX = canvasEl.width, maxX = 0, minY = canvasEl.height, maxY = 0
    let greenCount = 0
    const step = 2
    for (let y = 0; y < canvasEl.height; y += step) {
      for (let x = 0; x < canvasEl.width; x += step) {
        const idx = (y * canvasEl.width + x) * 4
        const r = bgData[idx]
        const g = bgData[idx + 1]
        const b = bgData[idx + 2]
        if (g > 150 && r < 100 && b < 100) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          greenCount++
        }
      }
    }

    let centerX = canvasEl.width / 2
    let centerY = canvasEl.height / 2
    let radius = 160

    if (greenCount > 0) {
      centerX = (minX + maxX) / 2
      centerY = (minY + maxY) / 2
      radius = Math.min(maxX - minX, maxY - minY) / 2
    }

    const imgSize = Math.min(ppNya.width, ppNya.height)
    const sx = (ppNya.width - imgSize) / 2
    const sy = (ppNya.height - imgSize) / 2

    // Tutup area greenscreen dengan warna latar belakang gelap WhatsApp (mencegah kebocoran warna hijau)
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius + 2, 0, Math.PI * 2)
    ctx.fillStyle = '#080e11'
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2, true)
    ctx.closePath()
    ctx.clip()
    ctx.drawImage(ppNya, sx, sy, imgSize, imgSize, centerX - radius, centerY - radius, radius * 2, radius * 2)
    ctx.restore()

    ctx.font = 'bold 42px "Sans-serif"'
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
    ctx.shadowBlur = 5
    ctx.fillText(name, centerX, 250)

    ctx.font = '24px "Sans-serif"'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowColor = "rgba(0, 0, 0, 0.5)"
    ctx.shadowBlur = 8
    ctx.fillText(time, centerX, 305)
    let buffer = canvasEl.toBuffer('image/jpeg')
    // ---- akhir bagian bot ----

    res.set('Cache-Control', 'private, no-store');
    return res.status(200).type('image/jpeg').send(buffer);
  }
};
