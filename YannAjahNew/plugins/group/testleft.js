'use strict';
const { render, DEFAULT_LEFT } = require('../../lib/welcome');
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.testleft', name: 'testleft', description: 'Tes pesan left grup', async run(ctx) { await ctx.reply(render(ctx.group.leftText || DEFAULT_LEFT, { user: ctx.m.sender, group: ctx.m.groupMetadata?.subject || 'grup', desc: ctx.m.groupMetadata?.desc || '', count: ctx.m.groupMetadata?.participants?.length || 0 })); } });
