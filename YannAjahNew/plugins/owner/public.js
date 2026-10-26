'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.public', name: 'public', description: 'Mode public: bot merespons semua orang', async run(ctx) { ctx.db.settings().public = true; ctx.db.touch(); await ctx.reply('🌐 Mode PUBLIC aktif.'); } });
