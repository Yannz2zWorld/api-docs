'use strict';
const { U } = require('../../lib/owner-manage');

module.exports = U({ id: 'store.sewa', name: 'sewa', aliases: ['sewabot'], description: 'Info sewa bot ke grup', async run(ctx) { await ctx.yannajah.registry.resolve('prem').run(ctx); } });
