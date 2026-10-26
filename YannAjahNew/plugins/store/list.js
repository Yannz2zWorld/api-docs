'use strict';
const media = require('../../library/mediastore');
const { S, renderList, sendEntry, store } = require('../../lib/store');

module.exports = S({ id: 'store.list', name: 'list', aliases: ['daftarlist', 'store'], description: 'Tampilkan list item grup (ketik nama item untuk detail)',
  async run(ctx) {
    const s = store(ctx);
    if (!s.items.length) return ctx.reply(`╭一緒 List\n│୭ ˚.ᵎᵎ Status : Belum ada item\n│୭ ˚.ᵎᵎ Tambah : ${ctx.prefix}addlist nama|deskripsi\n╰─────────一緒`);
    const text = renderList(ctx, s);
    const c = s.templateMedia ? media.content(s.templateMedia, text) : null;
    await ctx.yannajah.sendmessage(ctx.m.chat, c || { text }, { quoted: ctx.m.raw });
  },
  // Ketik nama item persis -> kirim detailnya (V15). Juga keyword payment.
  async onMessage(ctx) {
    const m = ctx.m;
    if (!m.isGroup || m.isCmd || m.fromMe || !m.body || m.body.length > 80) return false;
    const g = ctx.db.get(['groups', m.chat]);
    const key = m.body.toLowerCase().trim();
    const item = g?.store?.items?.find(i => i.name.toLowerCase() === key);
    if (item) { await sendEntry(ctx, item, item.desc); return true; }
    const pay = g?.store?.payments?.[key];
    if (pay) { await sendEntry(ctx, pay, pay.text); return true; }
    return false;
  } });
