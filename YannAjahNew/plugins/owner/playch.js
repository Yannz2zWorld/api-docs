'use strict';
// Kirim lagu ke channel bot (V15: .playch lagu|link channel). Owner. Download lagu lewat APIZ2Z,
// lalu kirim sebagai audio ke channel (atau channel default bot).
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { callFirst, dataOf } = require('../../lib/apiz2z-kit');
const { toOpus } = require('../../library/converter');

function pickUrl(d) {
  if (!d) return null;
  if (typeof d === 'string' && /^https?:\/\//.test(d)) return d;
  for (const k of ['download', 'url', 'audio', 'mp3', 'link', 'result']) if (typeof d[k] === 'string' && /^https?:\/\//.test(d[k])) return d[k];
  return null;
}

module.exports = feature({
  id: 'owner.playch', name: 'playch', category: 'owner', permission: 'owner', cooldown: 10,
  description: 'Kirim lagu ke channel: .playch <judul>|<link channel?>', usage: '<judul>|<link channel>',
  dependencies: { apiz2z: '/api/download/play' },
  async run(ctx) {
    const [title, chLink] = (ctx.text || '').split('|').map(s => s && s.trim());
    if (!title) throw new UsageError('Contoh: .playch Juicy Luicy|https://whatsapp.com/channel/xxxx');
    let chId = ctx.config.links.channelId;
    if (chLink) {
      const code = /whatsapp\.com\/channel\/([A-Za-z0-9]+)/.exec(chLink)?.[1];
      if (!code) throw new UsageError('Link channel tidak valid.');
      const meta = await ctx.yannajah.socket?.newsletterMetadata('invite', code).catch(() => null);
      if (!meta?.id) throw new UsageError('Gagal mengambil data channel.');
      chId = meta.id;
    }
    if (!/@newsletter$/.test(chId || '')) throw new UsageError('ID channel belum diatur (set lewat link atau renamebot idsaluran).');
    await ctx.react('⏳');
    const { result } = await callFirst(ctx, [['/api/download/play', { query: title }], ['/api/download/ytmp3', { url: title }]]);
    const url = pickUrl(dataOf(result));
    if (!url) throw new UsageError('Gagal mendapatkan link lagu.');
    const { download } = require('../../library/net');
    const { buffer } = await download(url, { maxBytes: 50 * 1024 * 1024, timeoutMs: 120000 });
    const opus = await toOpus(buffer).catch(() => buffer);
    await ctx.yannajah.sendmessage(chId, { audio: opus, mimetype: 'audio/ogg; codecs=opus' });
    await ctx.reply(`✅ Lagu *${title}* dikirim ke channel.`);
  }
});
