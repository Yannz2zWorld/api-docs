// Fake Call: gambar layar panggilan masuk ala WhatsApp (nama + jam + foto) untuk seru-seruan.
// Digambar sendiri di server (lib @napi-rs/canvas + font Inter yang dibundel), tanpa server luar.
// Foto: unggah (POST) atau URL https untuk pengguna API; tanpa foto dipakai avatar inisial.
const path = require('path');
const { downloadFile } = require('../lib/theresav');

const W = 720, H = 1440;
const MAX_PHOTO = 8 * 1024 * 1024;
const FONT_DIR = path.join(__dirname, '..', 'views', 'assets', 'fonts');
let canvasLib = null;
function canvas() {
  if (canvasLib) return canvasLib;
  const lib = require('@napi-rs/canvas');
  lib.GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter_400Regular.ttf'), 'Inter');
  lib.GlobalFonts.registerFromPath(path.join(FONT_DIR, 'Inter_700Bold.ttf'), 'Inter');
  canvasLib = lib;
  return lib;
}

const fail = (res, status, error, message) => res.status(status).json({ status: false, error, message });
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '');

function fitText(ctx, text, maxWidth, size, weight) {
  for (let s = size; s >= 24; s -= 2) { ctx.font = `${weight} ${s}px Inter`; if (ctx.measureText(text).width <= maxWidth) return; }
}

function handset(ctx, cx, cy, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(-34, -9, 68, 18, 9);   // body of the receiver
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(-38, -9, 20, 26, 8);   // ear piece
  ctx.roundRect(18, -9, 20, 26, 8);    // mouth piece
  ctx.fill();
  ctx.restore();
}

async function render({ name, time, photo }) {
  const { createCanvas, loadImage } = canvas();
  const c = createCanvas(W, H);
  const ctx = c.getContext('2d');

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b141a');
  bg.addColorStop(1, '#13232b');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 24px Inter';
  ctx.fillText('Terenkripsi end-to-end', W / 2, 110);
  ctx.font = '400 30px Inter';
  ctx.fillText('Panggilan suara WhatsApp', W / 2, 190);

  ctx.fillStyle = '#ffffff';
  fitText(ctx, name, W - 80, 60, '700');
  ctx.fillText(name, W / 2, 275);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '400 32px Inter';
  ctx.fillText(time || 'Berdering…', W / 2, 330);

  // Round photo (or initials)
  const cx = W / 2, cy = 660, r = 180;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (photo) {
    const s = Math.min(photo.width, photo.height);
    ctx.drawImage(photo, (photo.width - s) / 2, (photo.height - s) / 2, s, s, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = '#2a3942';
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#d1d7db';
    ctx.font = '700 150px Inter';
    ctx.textBaseline = 'middle';
    ctx.fillText((name.match(/\p{L}|\p{N}/u) || ['?'])[0].toUpperCase(), cx, cy + 8);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  // Decline / accept buttons
  const by = 1230;
  for (const [x, color, angle, label] of [[200, '#f15c6d', Math.PI, 'Tolak'], [520, '#25d366', -Math.PI / 4, 'Terima']]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, by, 72, 0, Math.PI * 2);
    ctx.fill();
    handset(ctx, x, by, angle);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.font = '400 28px Inter';
    ctx.fillText(label, x, by + 125);
  }
  return c.toBuffer('image/jpeg', 90);
}

module.exports = {
  name: 'Fake Call',
  desc: 'Buat gambar layar panggilan masuk ala WhatsApp (nama, jam, dan foto) untuk seru-seruan.',
  category: 'Maker',
  path: '/api/maker/fakecall?name=&time=',
  upload: true,
  params: [
    { name: 'name', required: true, placeholder: 'Ayang' },
    { name: 'time', required: false, placeholder: '12.00 (opsional)' },
    { name: 'photo', required: false, type: 'file', accept: 'image/*', placeholder: 'Unggah foto (opsional)' }
  ],
  async run(req, res) {
    const name = clean(req.query.name, 40);
    const time = clean(req.query.time, 24);
    if (!name) return fail(res, 400, 'PARAM_REQUIRED', "Parameter 'name' wajib diisi.");

    let buf = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;
    if (buf && buf.length > MAX_PHOTO) return fail(res, 413, 'FILE_TOO_LARGE', 'Foto maksimal 8 MB.');
    const url = typeof req.query.photo === 'string' && req.query.photo.trim() ? req.query.photo.trim() : (typeof req.query.url === 'string' ? req.query.url.trim() : '');
    if (!buf && url) {
      try { buf = (await downloadFile(url)).buf; } catch (e) { return fail(res, 400, e.code || 'FILE_FETCH_FAILED', e.message); }
    }

    let lib;
    try { lib = canvas(); } catch { return fail(res, 503, 'RENDERER_UNAVAILABLE', 'Pembuat gambar belum tersedia di server. Kuota tidak dipotong.'); }
    let photo = null;
    if (buf) {
      try { photo = await lib.loadImage(buf); } catch { return fail(res, 400, 'NOT_IMAGE', 'Foto harus gambar (png/jpg/webp).'); }
    }
    const out = await render({ name, time, photo });
    res.set('Cache-Control', 'private, no-store');
    return res.status(200).type('image/jpeg').send(out);
  }
};
