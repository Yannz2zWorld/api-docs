'use strict';
const { jidUser } = require('../../library/function');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.listprem', name: 'listprem', description: 'Daftar user premium aktif',
  async run(ctx) { const list = Object.entries(ctx.db.raw().users).filter(([, u]) => u.premiumUntil > Date.now()); await ctx.reply(list.length ? list.map(([j, u]) => `• ${jidUser(j)} — s/d ${new Date(u.premiumUntil).toLocaleDateString('id-ID')}`).join('\n') : 'Belum ada user premium.'); } });
