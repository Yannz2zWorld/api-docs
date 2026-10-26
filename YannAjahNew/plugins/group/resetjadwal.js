'use strict';
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.resetjadwal', name: 'resetjadwal', description: 'Hapus jadwal buka/tutup grup', async run(ctx) { delete ctx.group.dailySchedule; delete ctx.group.timedSetting; ctx.db.touch(); await ctx.reply('✅ Jadwal buka/tutup grup dihapus.'); } });
