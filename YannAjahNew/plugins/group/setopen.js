'use strict';
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.setopenmsg', name: 'setopen', description: 'Pesan saat grup dibuka oleh .opentime', usage: '<pesan>', async run(ctx) { ctx.group.openMessage = ctx.requireText().slice(0, 500); ctx.db.touch(); await ctx.reply(`✅ Pesan open grup diset: "${ctx.group.openMessage}"`); } });
