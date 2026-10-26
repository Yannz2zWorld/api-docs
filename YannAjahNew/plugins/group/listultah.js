'use strict';
const { mention } = require('../../library/targets');
const { G, MONTHS } = require('../../lib/group-activity');

module.exports = G({ id: 'group.listultah', name: 'listultah', description: 'Daftar ulang tahun member grup',
  async run(ctx) { const l = Object.entries(ctx.group.birthdays || {}).sort((a, b) => a[1].month - b[1].month || a[1].day - b[1].day); await ctx.reply(l.length ? `🎂 *ULANG TAHUN MEMBER*\n\n${l.map(([j, b]) => `• ${b.day} ${MONTHS[b.month - 1]} — ${mention(j)}`).join('\n')}` : '📭 Belum ada yang mendaftarkan ulang tahun.'); } });
