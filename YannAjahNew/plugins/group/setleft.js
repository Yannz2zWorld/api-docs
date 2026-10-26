'use strict';
const { G } = require('../../lib/group');

module.exports = G({ id: 'group.setleft', name: 'setleft', description: 'Atur teks perpisahan (@user @group @count)', usage: '<teks>', permission: 'admin',
  async run(ctx) { ctx.group.leftText = ctx.requireText().slice(0, 1000); ctx.db.touch(); await ctx.reply('✅ Teks perpisahan disimpan.'); } });
