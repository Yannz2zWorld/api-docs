'use strict';
const { feature } = require('../../library/plugin-kit');
const { buildMenu } = require('../../source/yannai-menu');
const { sendMenu, statusOpts } = require('../../lib/core');

module.exports = feature({ id: 'core.menu', name: 'menu', aliases: ['help', 'start', 'yannaimenu', 'yannmenu'], category: 'core', description: 'Daftar kategori & fitur bot', usage: '[kategori]', cooldown: 3, allowInMaintenance: false,
  async run(ctx) {
    const reg = ctx.yannajah.registry;
    const text = buildMenu(reg, { prefix: ctx.prefix, category: ctx.args[0] || null, statusOpts: statusOpts(ctx), botName: ctx.config.bot.name, isOwner: ctx.isOwner });
    if (!text) return ctx.reply(`Kategori *${ctx.args[0]}* tidak ada. Ketik ${ctx.prefix}menu`);
    await sendMenu(ctx, text);
  } });
