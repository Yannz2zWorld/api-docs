'use strict';
const { feature } = require('../../library/plugin-kit');
const { arr } = require('../../lib/owner-manage');

module.exports = feature({ id: 'group.listbadword', name: 'listbadword', aliases: ['daftarbadword'], category: 'group', scope: 'group', description: 'Daftar kata terlarang grup',
  async run(ctx) { const l = arr(ctx.group, 'badwords'); await ctx.reply(l.length ? `📋 Badwords (${l.length}):\n${l.map((w, i) => `${i + 1}. ${w}`).join('\n')}` : '📭 Belum ada kata terlarang.'); } });
