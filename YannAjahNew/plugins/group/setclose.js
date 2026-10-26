'use strict';
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.setclosemsg', name: 'setclose', description: 'Pesan saat grup ditutup oleh .closetime', usage: '<pesan>', async run(ctx) { ctx.group.closeMessage = ctx.requireText().slice(0, 500); ctx.db.touch(); await ctx.reply(`✅ Pesan close grup diset: "${ctx.group.closeMessage}"`); } });
