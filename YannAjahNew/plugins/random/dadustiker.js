'use strict';
const crypto = require('crypto');
const { feature } = require('../../library/plugin-kit');
const { load } = require('../../lib/random');

module.exports = feature({ id: 'random.dadu.sticker', name: 'dadustiker', aliases: ['randomdadu'], category: 'random', description: 'Stiker dadu acak 1-6', cooldown: 3,
  async run(ctx) { const d = load('dadu'); const x = d[crypto.randomInt(0, d.length)]; await ctx.sendFile(x.result); } });
