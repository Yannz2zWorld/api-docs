'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.self', name: 'self', description: 'Mode self: bot hanya merespons owner', async run(ctx) { ctx.db.settings().public = false; ctx.db.touch(); await ctx.reply('🔒 Mode SELF aktif.'); } });
