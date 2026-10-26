'use strict';
const { toJid } = require('../../library/function');
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.delprem', name: 'delprem', description: 'Cabut premium user', usage: '<nomor/@tag>', async run(ctx) { const u = ctx.db.user(toJid(targetNumber(ctx))); u.premiumUntil = 0; ctx.db.touch(); await ctx.reply('✅ Premium dicabut.'); } });
