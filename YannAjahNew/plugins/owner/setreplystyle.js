'use strict';
// .setreplystyle <text|card>: gaya balasan bot (Lena AI .setreply). Hanya gaya yang jujur: teks biasa
// atau teks + kartu link milik bot sendiri (gaya Lena v2-v5 meniru kontak Meta AI / kartu order palsu).
const { O } = require('../../lib/owner');
const { UsageError } = require('../../library/errors');

const ALIASES = { text: 'text', teks: 'text', biasa: 'text', off: 'text', v0: 'text', card: 'card', kartu: 'card', link: 'card', v1: 'card' };
const LABEL = { text: 'Teks biasa', card: 'Kartu link (nama bot, owner, thumbnail)' };

module.exports = O({ id: 'owner.setreplystyle', name: 'setreplystyle', aliases: ['setreply'], description: 'Gaya balasan bot: text (biasa) atau card (kartu link)', usage: '<text|card>',
  async run(ctx) {
    const st = ctx.db.settings();
    const cur = st.replyStyle || 'text';
    const arg = (ctx.args[0] || '').toLowerCase();
    if (!arg) return ctx.reply(`乂 *Reply Style*\n◦ Sekarang : ${cur} — ${LABEL[cur]}\n\n◦ text — ${LABEL.text}\n◦ card — ${LABEL.card}\n\nContoh: ${ctx.prefix}${ctx.command} card`);
    const style = ALIASES[arg];
    if (!style) throw new UsageError(`Pilihan: text, card. Contoh: ${ctx.prefix}${ctx.command} card`);
    st.replyStyle = style; ctx.db.touch();
    await ctx.reply(`✓ Reply style diubah ke *${style}* (${LABEL[style]}).`);
  } });
