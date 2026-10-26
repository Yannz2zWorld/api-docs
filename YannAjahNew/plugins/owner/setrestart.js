'use strict';
const { O, scheduleRestart } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setrestart', name: 'setrestart', aliases: ['autorestart'], description: 'Restart otomatis tiap N jam (0 = mati)', usage: '<jam>',
  async run(ctx) {
    const st = ctx.db.settings(); const h = Number(ctx.args[0]);
    if (!ctx.args.length || !Number.isInteger(h) || h < 0 || h > 168) return ctx.reply(`*⚙️ Auto Restart*\nStatus: ${st.autoRestartHours ? `tiap ${st.autoRestartHours} jam` : 'nonaktif'}\n${ctx.prefix}setrestart 6 (tiap 6 jam)\n${ctx.prefix}setrestart 0 (matikan)`);
    st.autoRestartHours = h; ctx.db.touch(); scheduleRestart(h, ctx.logger);
    await ctx.reply(h ? `✅ Bot restart otomatis tiap ${h} jam.` : '✅ Auto restart dimatikan.');
  } });
