'use strict';
// Gambar meme lokal (V15: .wanted/.buronan/.posterwanted, .ytcomment). Foto: kirim/reply gambar, atau
// foto profil yang di-tag/pengirim. Semua digambar dengan canvas (tanpa API eksternal).
const { canvas, fit, font, png, loadImage } = require('../library/canvas');
const { download } = require('../library/net');

async function photoOf(ctx, jid) {
  const md = ctx.media();
  if (md && /^image\//.test(md.mime)) {
    let buf = await md.download();
    if (md.mime === 'image/webp') buf = await require('../library/converter').toPng(buf);
    return buf;
  }
  const url = await ctx.yannajah.socket?.profilePictureUrl(jid, 'image').catch(() => null);
  if (url) return (await download(url, { maxBytes: 3 * 1024 * 1024 }).catch(() => null))?.buffer || null;
  return null;
}

function cover(g, img, x, y, w, h) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s, sh = h / s;
  g.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h);
}

async function wantedPoster({ photo, name, reward }) {
  const W = 900, H = 1200;
  const { c, g } = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#e8d3a2'); bg.addColorStop(1, '#c9a96b');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(90,60,20,${((i * 37) % 100) / 1400})`; g.fillRect((i * 7919) % W, (i * 104729) % H, 3, 3); }
  g.strokeStyle = '#5b3a17'; g.lineWidth = 14; g.strokeRect(24, 24, W - 48, H - 48);
  g.fillStyle = '#3b2410'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.font = font(150, true); g.fillText('WANTED', W / 2, 200);
  g.font = font(44, true); g.fillText('DEAD OR ALIVE', W / 2, 262);
  const px = 120, py = 300, pw = W - 240, ph = 520;
  g.fillStyle = '#2b1a0a'; g.fillRect(px - 10, py - 10, pw + 20, ph + 20);
  if (photo) {
    const img = await loadImage(photo);
    g.save(); cover(g, img, px, py, pw, ph); g.globalCompositeOperation = 'multiply'; g.fillStyle = '#d9b77a'; g.fillRect(px, py, pw, ph); g.restore();
  } else { g.fillStyle = '#7a5a33'; g.fillRect(px, py, pw, ph); }
  const n = fit(g, name.toUpperCase(), W - 160, 110, { start: 96, min: 30, bold: true });
  g.fillStyle = '#3b2410'; g.font = font(n.size, true); g.fillText(n.lines[0], W / 2, 930);
  g.font = font(40, true); g.fillText('REWARD', W / 2, 1010);
  g.font = font(70, true); g.fillStyle = '#7a1a0a'; g.fillText(reward, W / 2, 1090);
  return png(c);
}

async function ytComment({ photo, name, text }) {
  const W = 1000, PAD = 36;
  const { g: mg } = canvas(10, 10);
  mg.font = font(34);
  const f = fit(mg, text, W - 200, 600, { start: 34, min: 34 });
  const H = 170 + f.lines.length * 44;
  const { c, g } = canvas(W, H);
  g.fillStyle = '#0f0f0f'; g.fillRect(0, 0, W, H);
  if (photo) { const img = await loadImage(photo); g.save(); g.beginPath(); g.arc(PAD + 40, PAD + 40, 40, 0, Math.PI * 2); g.clip(); cover(g, img, PAD, PAD, 80, 80); g.restore(); }
  else { g.fillStyle = '#ff3d00'; g.beginPath(); g.arc(PAD + 40, PAD + 40, 40, 0, Math.PI * 2); g.fill(); }
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  const handle = `@${name.replace(/\s+/g, '').slice(0, 30)}`;
  g.fillStyle = '#f1f1f1'; g.font = font(30, true); g.fillText(handle, PAD + 110, PAD + 30);
  const hw = g.measureText(handle).width;
  g.fillStyle = '#aaaaaa'; g.font = font(26); g.fillText('baru saja', PAD + 110 + hw + 18, PAD + 30);
  g.fillStyle = '#f1f1f1'; g.font = font(34); f.lines.forEach((l, i) => g.fillText(l, PAD + 110, PAD + 80 + i * 44));
  const y = PAD + 100 + f.lines.length * 44;
  g.fillStyle = '#aaaaaa'; g.font = font(28); g.fillText('👍  1,2 rb      👎      Balas', PAD + 110, y);
  return png(c);
}

module.exports = { photoOf, wantedPoster, ytComment };
