'use strict';
const { O, sock } = require('../../lib/owner');

module.exports = O({ id: 'owner.listgc', name: 'listgc', aliases: ['listgroup'], description: 'Daftar grup yang diikuti bot',
  async run(ctx) { const all = Object.values(await sock(ctx).groupFetchAllParticipating()); await ctx.reply(`📋 ${all.length} grup:\n` + all.slice(0, 100).map((g, i) => `${i + 1}. ${g.subject} (${g.participants.length})`).join('\n')); } });
