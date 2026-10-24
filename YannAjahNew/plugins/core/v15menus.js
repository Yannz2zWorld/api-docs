'use strict';
// Sub-menu gaya V15 (.menu-ai, .menu-group, ...) -> kategori registry. Isi selalu dari fitur yang
// benar-benar terdaftar (fitur planned/disabled tidak tampil).
const { feature } = require('../../library/plugin-kit');
const { buildMenu } = require('../../menu');

const MAP = {
  ai: ['ai'], stk: ['sticker'], stickers: ['sticker'], enc: ['enc'], owner: ['owner'], maker: ['maker', 'canvas', 'textpro'],
  animetheme: ['anime'], potoanime: ['anime'], anime: ['anime'], shop: ['store'], store: ['store'], group: ['group'],
  random: ['random'], islami: ['islamic'], ehpoto: ['ephoto', 'textpro'], rpg: ['economy'], game: ['game', 'games'],
  search: ['search', 'stalk'], download: ['downloader', 'music'], fun: ['fun', 'primbon'], tools: ['tools', 'convert', 'image', 'media'],
  primbon: ['primbon'], prem: []
};

module.exports = Object.entries(MAP).map(([k, cats]) => feature({
  id: `core.menu.${k}`, name: `menu-${k}`, category: 'core', cooldown: 3,
  description: k === 'prem' ? 'Daftar fitur khusus premium' : `Menu ${k} (kategori: ${cats.join(', ')})`,
  async run(ctx) {
    const reg = ctx.yannajah.registry;
    const opts = { prefix: ctx.prefix, statusOpts: { apiKey: ctx.api?.hasKey?.() ?? true, disabledList: ctx.config.plugin.disabled }, botName: ctx.config.bot.name, isOwner: ctx.isOwner };
    if (k === 'prem') {
      const list = [...reg.features.values()].filter(f => f.permission === 'premium' && !['planned', 'disabled'].includes(reg.effectiveStatus(f, opts.statusOpts)));
      return ctx.reply(list.length ? `💎 *MENU PREMIUM*\n${list.map(f => `│▣ ${ctx.prefix}${f.name}`).join('\n')}` : `💎 Semua fitur bisa dipakai user biasa (premium = tanpa limit harian). Info: ${ctx.prefix}prem`);
    }
    if (cats.includes('owner') && !ctx.isOwner) return ctx.reply(ctx.config.mess.owner);
    const text = cats.map(c => buildMenu(reg, { ...opts, category: c })).filter(Boolean).join('\n\n');
    await ctx.reply(text || `Belum ada fitur di menu ${k}.`);
  }
}));
