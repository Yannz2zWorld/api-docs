'use strict';
const { render, DEFAULT_WELCOME } = require('../../lib/welcome');
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.testwelcome', name: 'testwelcome', description: 'Tes pesan welcome grup', async run(ctx) { await ctx.reply(render(ctx.group.welcomeText || DEFAULT_WELCOME, { user: ctx.m.sender, group: ctx.m.groupMetadata?.subject || 'grup', desc: ctx.m.groupMetadata?.desc || '', count: ctx.m.groupMetadata?.participants?.length || 0 })); } });
