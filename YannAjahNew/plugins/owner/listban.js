'use strict';
const { jidUser } = require('../../library/function');
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.listban', name: 'listban', description: 'Daftar user yang diblokir dari bot', async run(ctx) { const l = Object.entries(ctx.db.raw().users).filter(([, u]) => u.banned).map(([j]) => `• ${jidUser(j)}`); await ctx.reply(l.join('\n') || 'Tidak ada.'); } });
