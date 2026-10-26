'use strict';
// Sticker.ly (Yann AI V15 .caristiker / .caristikerdown, Lena AI .caristikerpack): cari pack lalu kirim
// stikernya. Hasil pencarian diingat per chat 10 menit supaya bisa dipilih dengan nomor
// (pengganti tombol list V15). Stiker dikirim satu per satu (maks MAX_STICKERS).
const net = require('../library/net');
const { TTLCache } = require('../library/function');
const { UsageError } = require('../library/errors');
const converter = require('../library/converter');
const exif = require('../library/exif');
const { dataOf } = require('./apiz2z-kit');

const MAX_STICKERS = 30;
const MAX_STICKER_BYTES = 2 * 1024 * 1024;
const PACK_URL_RE = /^https?:\/\/(?:www\.)?sticker\.ly\/\S+$/i;
const searches = new TTLCache({ ttlMs: 10 * 60 * 1000, max: 500 });

const authorOf = p => (typeof p.author === 'string' ? p.author : p.author?.name) || 'Unknown';

function remember(chat, packs) { searches.set(chat, packs); }

// Nomor dari pencarian terakhir di chat ini, atau URL sticker.ly.
function resolvePack(ctx) {
  const arg = (ctx.args[0] || '').trim();
  if (!arg) throw new UsageError(`Format: ${ctx.prefix}${ctx.command} <nomor|url sticker.ly>\nCari dulu: ${ctx.prefix}caristiker <kata kunci>`);
  if (/^\d{1,2}$/.test(arg)) {
    const packs = searches.get(ctx.m.chat);
    const p = packs?.[Number(arg) - 1];
    if (!p) throw new UsageError(`Nomor ${arg} tidak ada di hasil pencarian terakhir. Cari lagi: ${ctx.prefix}caristiker <kata kunci>`);
    return p.url;
  }
  if (!PACK_URL_RE.test(arg)) throw new UsageError('URL sticker pack tidak valid (harus dari sticker.ly).');
  return arg;
}

// Ubah gambar stiker jadi webp WhatsApp + metadata pack/author bot.
async function toSticker(buffer, mime, { animated, packname, author }) {
  const webp = /webp/.test(mime || '') ? buffer : await converter.toWebpSticker(buffer, { animated });
  return exif.addExif(webp, { packname, author });
}

async function sendPack(ctx, pack) {
  const stickers = (Array.isArray(pack?.stickers) ? pack.stickers : []).filter(s => s && typeof s.imageUrl === 'string');
  if (!stickers.length) throw new UsageError('Sticker pack kosong atau tidak ditemukan.');
  const list = stickers.slice(0, MAX_STICKERS);
  await ctx.reply(`乂 *Sticker.ly*\n◦ Pack : ${pack.name || '-'}\n◦ Oleh : ${authorOf(pack)}\n◦ Stiker : ${stickers.length}${stickers.length > list.length ? ` (dikirim ${list.length} pertama)` : ''}`);
  let sent = 0;
  for (const s of list) {
    try {
      const d = await net.download(s.imageUrl, { maxBytes: MAX_STICKER_BYTES, timeoutMs: 30000 });
      const buf = await toSticker(d.buffer, d.mime, { animated: Boolean(s.isAnimated || pack.isAnimated), packname: pack.name || ctx.config.bot.packname, author: ctx.config.bot.author });
      await ctx.sendFile({ buffer: buf, mime: 'image/webp' });
      sent++;
    } catch (e) { ctx.logger.warn('stiker sticker.ly gagal', { code: e.code, msg: e.message }); }
  }
  if (!sent) throw new UsageError('Semua stiker gagal diunduh. Coba lagi nanti.');
  return sent;
}

const packsOf = result => {
  const d = dataOf(result);
  return (Array.isArray(d) ? d : []).filter(p => p && typeof p.url === 'string' && PACK_URL_RE.test(p.url));
};

module.exports = { MAX_STICKERS, PACK_URL_RE, authorOf, remember, resolvePack, sendPack, packsOf, searches };
