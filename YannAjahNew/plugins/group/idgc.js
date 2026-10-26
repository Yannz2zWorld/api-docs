'use strict';
const { G } = require('../../lib/group-admin');

module.exports = G({ id: 'group.idgc', name: 'idgc', aliases: ['cekidgc', 'getidgc'], description: 'ID grup ini', async run(ctx) { await ctx.reply(`🆔 *${ctx.m.groupMetadata?.subject || 'Grup'}*\n${ctx.m.chat}`); } });
