'use strict';
const { O } = require('../../lib/owner');

module.exports = O({ id: 'owner.listprefix', name: 'listprefix', description: 'Daftar prefix bot yang aktif',
  async run(ctx) {
    const s = ctx.db.settings();
    const list = s.prefix?.length ? s.prefix : ctx.config.prefix.list;
    await ctx.reply(`🔣 *Prefix aktif* (${s.prefix?.length ? 'diatur owner' : 'default settingsbot.js'}):\n${list.map((p, i) => `${i + 1}. ${p}`).join('\n')}`);
  } });
