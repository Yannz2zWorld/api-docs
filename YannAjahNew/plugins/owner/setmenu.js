'use strict';
const { MENU_ALIASES, MENU_STYLES, O } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setmenu', name: 'setmenu', description: `Gaya tampilan .menu: ${Object.keys(MENU_STYLES).join('/')} (v1-v10 juga diterima)`, usage: '<gaya>',
  async run(ctx) {
    const v = (ctx.args[0] || '').toLowerCase(); const style = MENU_STYLES[v] ? v : MENU_ALIASES[v];
    if (!style) return ctx.reply(`Gaya menu sekarang: *${ctx.db.settings().menuStyle || 'text'}*\n${Object.entries(MENU_STYLES).map(([k, d]) => `• ${k} — ${d}`).join('\n')}\n${ctx.usage()}`);
    ctx.db.settings().menuStyle = style; ctx.db.touch(); await ctx.reply(`✅ Gaya menu: ${MENU_STYLES[style]}`);
  } });
