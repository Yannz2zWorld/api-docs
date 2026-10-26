'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { A, findItem, store } = require('../../lib/store');

module.exports = A({ id: 'store.updatelist', name: 'updatelist', aliases: ['editlist'], description: 'Ubah deskripsi item: .updatelist nama|deskripsi baru (kirim/reply media untuk ganti media)', usage: '<nama>|<deskripsi>',
  async run(ctx) {
    const [name, ...rest] = ctx.requireText().split('|');
    const desc = rest.join('|').trim();
    if (!desc) throw new UsageError(`Format: ${ctx.prefix}updatelist Burger|Deskripsi baru`);
    const s = store(ctx); const i = findItem(s.items, name);
    if (i < 0) throw new UsageError(`❌ Item "${name.trim()}" tidak ditemukan`);
    const it = s.items[i]; it.desc = desc.slice(0, 4000);
    const md = await media.fromMessage(ctx);
    if (md) { const old = it.media?.name; it.media = md; ctx.db.touch(); media.release(old, ctx.db); }
    ctx.db.touch();
    await ctx.reply(`✅ Item "${it.name}" berhasil diperbarui!`);
  } });
