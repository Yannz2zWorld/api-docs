'use strict';
const { O, scheduleBackup } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.autobackup', name: 'autobackup', description: 'Kirim backup database ke owner tiap N jam (0 = mati)', usage: '<jam>',
  async run(ctx) {
    const st = ctx.db.settings(); const h = Number(ctx.args[0]);
    if (!ctx.args.length || !Number.isInteger(h) || h < 0 || h > 168) return ctx.reply(`🗄️ Auto backup: ${st.autoBackupHours ? `tiap ${st.autoBackupHours} jam` : 'nonaktif'}\n${ctx.prefix}autobackup 24 | ${ctx.prefix}autobackup 0`);
    st.autoBackupHours = h; ctx.db.touch(); scheduleBackup(ctx.yannajah, ctx.config, h);
    await ctx.reply(h ? `✅ Backup dikirim ke chat owner tiap ${h} jam.` : '✅ Auto backup dimatikan.');
  } });
