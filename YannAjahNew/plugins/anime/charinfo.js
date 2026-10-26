'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { getJson } = require('../../lib/webjson');

module.exports = feature({ id: 'anime.charinfo', name: 'charinfo', aliases: ['searchchar', 'carikarakter'], category: 'anime', description: 'Info karakter anime/manga (MyAnimeList via Jikan)', usage: '<nama karakter>', cooldown: 5, limit: 1,
  async run(ctx) {
    const q = (ctx.text || '').trim().slice(0, 60);
    if (!q) throw new UsageError(`Contoh: ${ctx.prefix}${ctx.command} Nezuko`);
    const j = await getJson(`https://api.jikan.moe/v4/characters?q=${encodeURIComponent(q)}&limit=5&order_by=favorites&sort=desc`);
    const c = j?.data?.[0];
    if (!c) return ctx.reply(`Karakter "${q}" tidak ditemukan.`);
    const about = String(c.about || '').replace(/\n{2,}/g, '\n').slice(0, 900);
    const text = [`🎴 *${c.name}*${c.name_kanji ? ` (${c.name_kanji})` : ''}`, c.nicknames?.length ? `• Julukan: ${c.nicknames.slice(0, 5).join(', ')}` : '', `• Favorit: ${(c.favorites || 0).toLocaleString('id-ID')}`, `• MAL: ${c.url}`, about ? `\n${about}${c.about.length > 900 ? '…' : ''}` : '',
      j.data.length > 1 ? `\nLainnya: ${j.data.slice(1).map(x => x.name).join(', ')}` : ''].filter(Boolean).join('\n');
    const img = c.images?.jpg?.image_url;
    if (img) return ctx.sendFile(img, { caption: text.slice(0, 1000) }).then(() => (text.length > 1000 ? ctx.reply(text) : null)).catch(() => ctx.reply(text));
    await ctx.reply(text);
  } });
