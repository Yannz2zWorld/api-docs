'use strict';
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.listcase', name: 'listcase', aliases: ['listcmd'], description: 'Daftar command buatan sendiri', async run(ctx) { const k = Object.keys(obj(ctx.db.raw(), 'customCommands')); await ctx.reply(k.length ? k.map(x => `• ${ctx.prefix}${x}`).join('\n') : 'Belum ada command buatan.'); } });
