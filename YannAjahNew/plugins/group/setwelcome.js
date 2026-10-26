'use strict';
const { G } = require('../../lib/group');

module.exports = G({ id: 'group.setwelcome', name: 'setwelcome', description: 'Atur teks welcome (@user @group @desc @count)', usage: '<teks>', permission: 'admin',
  async run(ctx) { ctx.group.welcomeText = ctx.requireText().slice(0, 1000); ctx.db.touch(); await ctx.reply('✅ Teks welcome disimpan.'); } });
