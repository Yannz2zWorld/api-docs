'use strict';
// Emoji jadi stiker (V15: .emoji / .emojiwa / .stickerwa). Ambil gambar emoji Apple dari jsdelivr (publik).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const extapi = require('../../lib/extapi');
const { sendStickerFromBuffer } = require('../../lib/stickerfetch');

const codepoints = emoji => [...emoji].map(c => c.codePointAt(0).toString(16)).join('-').replace(/-fe0f$/, '');

module.exports = feature({
  id: 'maker.emojiwa', name: 'emojiwa', aliases: ['emoji', 'stickerwa'], category: 'maker', cooldown: 5, limit: 1,
  description: 'Ubah 1 emoji jadi stiker (emoji Apple)', usage: '<emoji>',
  params: [{ name: 'emoji', required: true }], dependencies: { apis: ['jsdelivr'] },
  async run(ctx) {
    const emoji = (ctx.text || '').trim();
    if (!emoji) throw new UsageError(`Kirim 1 emoji. Contoh: ${ctx.prefix}${ctx.command} 😊`);
    if ([...emoji].length > 2) throw new UsageError('Kirim hanya 1 emoji.');
    await ctx.react('⏳');
    const code = codepoints(emoji);
    const url = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple@15.1.2/img/apple/64/${code}.png`;
    const { buffer } = await extapi.get(ctx, url, { as: 'buffer', maxBytes: 2 * 1024 * 1024 }).catch(() => { throw new UsageError('Emoji itu tidak ditemukan, coba emoji lain.'); });
    await sendStickerFromBuffer(ctx, buffer);
  }
});
