'use strict';
const { toJid } = require('../../library/function');
const { O, sock, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.unblock', name: 'unblock', aliases: ['unblok'], description: 'Buka blokir kontak di WhatsApp', usage: '<nomor/@tag>', async run(ctx) { await sock(ctx).updateBlockStatus(toJid(targetNumber(ctx)), 'unblock'); await ctx.reply('✅ Blokir dibuka.'); } });
