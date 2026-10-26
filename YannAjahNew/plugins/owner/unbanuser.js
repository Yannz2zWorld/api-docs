'use strict';
const { toJid } = require('../../library/function');
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.unban', name: 'unbanuser', aliases: ['unblacklist'], description: 'Buka blokir user', usage: '<nomor/@tag>', async run(ctx) { ctx.db.user(toJid(targetNumber(ctx))).banned = false; ctx.db.touch(); await ctx.reply('✅ Blokir dibuka.'); } });
