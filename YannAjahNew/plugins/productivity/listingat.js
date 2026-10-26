'use strict';
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.remind.list', name: 'listingat', aliases: ['myreminders'], description: 'Daftar pengingat aktif',
  async run(ctx) { const r = list(ctx, 'reminders'); await ctx.reply(r.length ? r.map((x, i) => `${i + 1}. ${new Date(x.at).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })} — ${x.text}`).join('\n') : 'Tidak ada pengingat.'); } });
