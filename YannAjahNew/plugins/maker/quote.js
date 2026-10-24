'use strict';
// Quote sticker warna-warni (V15 .yannqc / .pink / .biru ...). Dibuat lokal dengan canvas + foto profil
// pengirim, lalu dijadikan stiker — tanpa API quote eksternal.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { canvas, fit, font, roundRect, png, loadImage } = require('../../library/canvas');
const { toWebpSticker, addExif } = require('../../library/media');

const M = f => feature({ category: 'maker', cooldown: 5, limit: 1, ...f });

// nama warna -> [latar, teks]
const COLORS = {
  pink: ['#f68ac9', '#ffffff'], biru: ['#6cace4', '#ffffff'], merah: ['#f44336', '#ffffff'], hijau: ['#4caf50', '#ffffff'],
  kuning: ['#ffeb3b', '#222222'], ungu: ['#9c27b0', '#ffffff'], birutua: ['#0d47a1', '#ffffff'], birumuda: ['#03a9f4', '#ffffff'],
  abu: ['#9e9e9e', '#ffffff'], orange: ['#ff9800', '#222222'], hitam: ['#111111', '#ffffff'], putih: ['#ffffff', '#111111'],
  teal: ['#009688', '#ffffff'], merahmuda: ['#ff80ab', '#222222'], cokelat: ['#795548', '#ffffff'], salmon: ['#fa8072', '#222222'],
  magenta: ['#e91e8c', '#ffffff'], tan: ['#d2b48c', '#222222'], wheat: ['#f5deb3', '#222222'], deeppink: ['#ff1493', '#ffffff'],
  api: ['#b22222', '#ffffff'], birulangit: ['#87ceeb', '#222222'], jingga: ['#ff7f24', '#222222'], hotpink: ['#ff69b4', '#ffffff'],
  hijaulaut: ['#2e8b57', '#ffffff'], merahtua: ['#8b0000', '#ffffff'], cyan: ['#00bcd4', '#222222'], hijaulumut: ['#6b8e23', '#ffffff'],
  hijaugelap: ['#1b5e20', '#ffffff'], birulaut: ['#1565c0', '#ffffff'], fuchsia: ['#ff00ff', '#ffffff'], peachpuff: ['#ffdab9', '#222222'],
  hijautua: ['#004d40', '#ffffff'], merahgelap: ['#7f0000', '#ffffff'], goldenrod: ['#daa520', '#222222'], emas: ['#ffd700', '#222222'], perak: ['#c0c0c0', '#222222']
};
const DEFAULT_PP = 'https://telegra.ph/file/a059a6a734ed202c879d3.jpg';

async function render({ text, name, bg, fg, ppBuffer }) {
  const W = 512, H = 512;
  const { c, g } = canvas(W, H);
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // avatar bulat
  let avatarH = 0;
  if (ppBuffer) {
    try {
      const img = await loadImage(ppBuffer);
      const r = 44, cx = 70, cy = 70;
      g.save(); g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
      g.drawImage(img, cx - r, cy - r, r * 2, r * 2); g.restore();
      g.fillStyle = fg; g.font = font(30, true); g.fillText(String(name).slice(0, 20), cx + r + 16, cy + 10);
      avatarH = 140;
    } catch { /* tanpa avatar */ }
  }
  // bubble teks
  const pad = 40, boxY = avatarH + 20, boxH = H - boxY - 40;
  g.fillStyle = fg === '#ffffff' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
  roundRect(g, pad - 10, boxY, W - (pad - 10) * 2, boxH, 28); g.fill();
  const f = fit(g, text, W - pad * 2, boxH - 50, { start: 70, min: 20, bold: true });
  g.fillStyle = fg; g.textAlign = 'left'; g.font = font(f.size, true);
  f.lines.forEach((l, i) => g.fillText(l, pad, boxY + 50 + i * f.size * 1.2));
  return png(c);
}

async function sendQuote(ctx, color, text) {
  const [bg, fg] = COLORS[color] || ['#ffffff', '#111111'];
  let ppBuffer = null;
  try { const url = await ctx.yannajah.socket?.profilePictureUrl(ctx.m.sender, 'image'); if (url) ppBuffer = await require('../../library/net').download(url, { maxBytes: 2 * 1024 * 1024 }).catch(() => null); } catch { /* pakai default */ }
  if (!ppBuffer) ppBuffer = await require('../../library/net').download(DEFAULT_PP, { maxBytes: 2 * 1024 * 1024 }).catch(() => null);
  const pngBuf = await render({ text: text.slice(0, 500), name: ctx.m.pushName, bg, fg, ppBuffer });
  let webp = await toWebpSticker(pngBuf);
  webp = await addExif(webp, { packname: ctx.config.bot.packname, author: ctx.config.bot.author });
  await ctx.sendFile({ buffer: webp, mime: 'image/webp' });
}

const COLOR_LIST = Object.keys(COLORS).join(', ');

module.exports = [
  M({ id: 'maker.yannqc', name: 'yannqc', aliases: ['yanqc', 'qc'], description: 'Stiker quote berwarna dari fotomu: .yannqc <warna> <teks>', usage: '<warna> <teks>',
    async run(ctx) {
      const [color, ...rest] = (ctx.text || '').split(' ');
      const msg = rest.join(' ');
      if (!ctx.text) throw new UsageError(`*Masukkan input!*\n\nContoh:\n${ctx.prefix}yannqc pink halo\n\nWarna: ${COLOR_LIST}`);
      const useColor = COLORS[color?.toLowerCase()] ? color.toLowerCase() : null;
      await sendQuote(ctx, useColor || 'putih', useColor ? msg || ctx.m.quoted?.text || '' : ctx.text);
    } }),
  // Alias warna langsung: .pink teks, .biru teks, ...
  ...Object.keys(COLORS).map(color => M({
    id: `maker.qc.${color}`, name: color, category: 'maker', description: `Stiker quote warna ${color}: .${color} <teks>`, usage: '<teks>',
    async run(ctx) { await sendQuote(ctx, color, ctx.requireText(`Contoh: ${ctx.prefix}${color} halo dunia`) || ctx.m.quoted?.text || ''); }
  }))
];
module.exports._render = render;
