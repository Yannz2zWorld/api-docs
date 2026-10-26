'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.listowner', name: 'listowner', aliases: ['listown'], description: 'Daftar owner', async run(ctx) { await ctx.reply([`👑 ${ctx.config.owner.number} (utama)`, ...ctx.config.owner.extra.map(n => `• ${n} (settingsbot.js)`), ...ctx.db.raw().owners.map(n => `• ${n}`)].join('\n')); } });
