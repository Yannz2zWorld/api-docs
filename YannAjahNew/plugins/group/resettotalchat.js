'use strict';
const { A } = require('../../lib/group-activity');

module.exports = A({ id: 'group.resettotalchat', name: 'resettotalchat', description: 'Reset hitungan chat grup',
  async run(ctx) { ctx.group.activity = { since: Date.now(), users: {} }; ctx.db.touch(); await ctx.reply('✅ Total chat grup direset.'); } });
