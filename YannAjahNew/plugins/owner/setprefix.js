'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.setprefix', name: 'setprefix', description: 'Atur prefix (pisah spasi, 1-3 karakter). Kosong = kembali ke settingsbot.js', usage: '[prefix...]',
  async run(ctx) {
    const list = ctx.args.filter(p => p.length >= 1 && p.length <= 3 && !/\s/.test(p)).slice(0, 6);
    ctx.db.settings().prefix = list; ctx.db.touch();
    await ctx.reply(list.length ? `✅ Prefix: ${list.join(' ')}` : `✅ Prefix kembali ke default: ${ctx.config.prefix.list.join(' ')}`);
  } });
