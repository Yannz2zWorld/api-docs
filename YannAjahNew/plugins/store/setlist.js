'use strict';
const media = require('../../library/mediastore');
const { A, store } = require('../../lib/store');

module.exports = A({ id: 'store.setlist', name: 'setlist', description: 'Atur template .list (variabel @name @group @time @date @fulldate @daytime @x, baris "@prefix <simbol>")', usage: '<template>',
  async run(ctx) {
    if (!ctx.text) return ctx.reply(`╭一緒 Variabel tersedia\n│୭ ˚.ᵎᵎ @name - Nama user\n│୭ ˚.ᵎᵎ @group - Nama grup\n│୭ ˚.ᵎᵎ @time - Waktu (HH:mm:ss)\n│୭ ˚.ᵎᵎ @date - Tanggal (DD/MM/YYYY)\n│୭ ˚.ᵎᵎ @fulldate - Hari, Tanggal Bulan Tahun\n│୭ ˚.ᵎᵎ @daytime - Pagi/Siang/Sore/Malam\n│୭ ˚.ᵎᵎ @x - Daftar item\n│୭ ˚.ᵎᵎ @prefix teks - Simbol depan item\n╰─────────一緒\n\nContoh:\n${ctx.prefix}setlist ╭一緒 List Produk @group\n│ Customer : @name\n│ @x\n╰───\n@prefix │୭`);
    const s = store(ctx);
    s.template = ctx.text.slice(0, 4000);
    s.listPrefix = (/@prefix\s+([^\n]+)/i.exec(ctx.text) || [])[1]?.trim() || null;
    const old = s.templateMedia?.name;
    s.templateMedia = await media.fromMessage(ctx, { kinds: ['image'] });
    ctx.db.touch(); if (old && old !== s.templateMedia?.name) media.release(old, ctx.db);
    await ctx.reply('✅ Template list berhasil disimpan!');
  } });
