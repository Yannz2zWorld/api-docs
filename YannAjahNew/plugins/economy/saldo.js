'use strict';
const { jidUser } = require('../../library/function');
const { E } = require('../../lib/economy');

module.exports = E({ id: 'economy.saldo', name: 'saldo', aliases: ['balance', 'bal', 'dompet'], description: 'Cek saldo virtual kamu (atau @user)',
  async run(ctx) { const j = ctx.m.mentionedJid?.[0] || ctx.m.sender; const u = ctx.db.user(j); await ctx.reply(`💰 Saldo @${jidUser(j)}: *${(u.money || 0).toLocaleString('id-ID')}*`); } });
