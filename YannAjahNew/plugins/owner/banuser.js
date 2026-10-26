'use strict';
const { UsageError } = require('../../library/errors');
const { toJid } = require('../../library/function');
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.ban', name: 'banuser', aliases: ['blacklist'], description: 'Blokir user dari memakai bot (lokal)', usage: '<nomor/@tag>',
  async run(ctx) { const n = targetNumber(ctx); if (n === ctx.config.owner.number) throw new UsageError('Tidak bisa ban owner utama.'); ctx.db.user(toJid(n)).banned = true; ctx.db.touch(); await ctx.reply(`🚫 ${n} tidak bisa memakai bot.`); } });
