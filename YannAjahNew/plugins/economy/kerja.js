'use strict';
const crypto = require('crypto');
const { UsageError } = require('../../library/errors');
const { E, JOBS } = require('../../lib/economy');

module.exports = E({ id: 'economy.kerja', name: 'kerja', aliases: ['work'], description: 'Bekerja untuk mendapat saldo (sekali per jam)', cooldown: 3,
  async run(ctx) {
    const u = ctx.user;
    const wait = (u.lastWork || 0) + 3600000 - Date.now();
    if (wait > 0) throw new UsageError(`Kamu masih capek. Bisa kerja lagi ${Math.ceil(wait / 60000)} menit lagi.`);
    const earn = crypto.randomInt(200, 1201);
    u.lastWork = Date.now(); u.money = (u.money || 0) + earn; u.exp = (u.exp || 0) + 10; ctx.db.touch();
    await ctx.reply(`💼 Kamu bekerja sebagai ${JOBS[crypto.randomInt(0, JOBS.length)]} dan mendapat *${earn}* saldo (+10 exp).`);
  } });
