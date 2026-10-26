'use strict';
const { O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.restart', name: 'restart', aliases: ['rst'], description: 'Restart bot (pm2 menyalakan lagi otomatis)',
  async run(ctx) { await ctx.reply('♻️ Memproses restart...'); await ctx.db.save(); setTimeout(() => process.kill(process.pid, 'SIGTERM'), 1500).unref?.(); } });
