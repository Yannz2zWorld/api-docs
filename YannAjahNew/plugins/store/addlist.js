'use strict';
// ----------------------------------------------------------------- list produk
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, MAX_ITEMS, store } = require('../../lib/store');

module.exports = A({ id: 'store.addlist', name: 'addlist', description: 'Tambah item list grup: .addlist nama|deskripsi (boleh kirim/reply gambar, video, audio, stiker)', usage: '<nama>|<deskripsi>',
  async run(ctx) {
    const [name, ...rest] = ctx.requireText().split('|');
    const desc = rest.join('|').trim();
    if (!name?.trim() || !desc) throw new UsageError(`Format: ${ctx.prefix}addlist Burger|Burger dengan keju`);
    const s = store(ctx);
    if (s.items.length >= MAX_ITEMS) throw new UsageError(`Maksimal ${MAX_ITEMS} item per grup.`);
    if (s.items.some(i => i.name.toLowerCase() === name.trim().toLowerCase())) throw new UsageError(`Item "${name.trim()}" sudah ada. Pakai ${ctx.prefix}updatelist.`);
    s.items.push({ name: name.trim().slice(0, 80), desc: desc.slice(0, 4000), media: await media.fromMessage(ctx), by: ctx.m.sender, at: Date.now() });
    ctx.db.touch();
    await ctx.reply(`✅ Item "${name.trim()}" berhasil ditambahkan!`);
  } });
