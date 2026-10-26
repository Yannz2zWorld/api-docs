'use strict';
const { feature } = require('../../library/plugin-kit');
const { buildAllMenu } = require('../../source/yannai-menu');
const { statusOpts } = require('../../lib/core');

module.exports = feature({ id: 'core.allmenu', name: 'allmenu', category: 'core', description: 'Semua fitur aktif per kategori', cooldown: 10,
  async run(ctx) { await ctx.reply(buildAllMenu(ctx.yannajah.registry, { prefix: ctx.prefix, statusOpts: statusOpts(ctx), isOwner: ctx.isOwner })); } });
