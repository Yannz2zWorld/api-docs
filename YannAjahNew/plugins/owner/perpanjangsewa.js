'use strict';
const { O } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.renewsewa', name: 'perpanjangsewa', aliases: ['renewsewa', 'renewsewagc'], description: 'Perpanjang sewa grup N hari', usage: '[id grup] <hari>', async run(ctx) { await ctx.yannajah.registry.resolve('addsewagc').run(ctx); } });
