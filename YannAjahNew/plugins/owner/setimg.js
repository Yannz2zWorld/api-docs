'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setimage', name: 'setimg', aliases: ['setimage'], description: 'Ganti gambar/video menu: reply media + .setimg menu|menuvideo|reply (atau .setimg reset)', usage: '<menu|menuvideo|reply|reset>',
  async run(ctx) {
    const type = (ctx.args[0] || '').toLowerCase(); const st = ctx.db.settings(); st.images = st.images || {};
    if (type === 'reset') { const old = Object.values(st.images).map(x => x?.name); st.images = {}; ctx.db.touch(); old.forEach(n => media.release(n, ctx.db)); return ctx.reply('✅ Gambar menu kembali ke bawaan.'); }
    if (!['menu', 'menuvideo', 'reply'].includes(type)) throw new UsageError(`Contoh: reply gambar lalu ${ctx.prefix}setimg menu\nreply video lalu ${ctx.prefix}setimg menuvideo`);
    const md = await media.fromMessage(ctx, { kinds: type === 'menuvideo' ? ['video'] : ['image'] });
    if (!md) throw new UsageError(`Kirim/reply ${type === 'menuvideo' ? 'video' : 'gambar'} dengan caption ${ctx.prefix}setimg ${type}`);
    const old = st.images[type]?.name; st.images[type] = md; ctx.db.touch(); media.release(old, ctx.db);
    await ctx.reply(`✅ Media ${type} diganti.`);
  } });
