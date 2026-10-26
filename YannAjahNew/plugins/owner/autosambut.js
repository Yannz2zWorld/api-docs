'use strict';
const { O, onOff } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.autosambut', name: 'autosambut', aliases: ['sambutowner'], description: 'Bot menyambut owner saat owner chat di grup (cooldown menit)', usage: 'on/off/set <menit>',
  async run(ctx) {
    const st = ctx.db.settings(); const c = st.sambutOwner = st.sambutOwner || { enabled: false, cooldown: 15 };
    const a = (ctx.args[0] || '').toLowerCase();
    if (a === 'set' && Number(ctx.args[1]) >= 1) c.cooldown = Math.min(Number(ctx.args[1]), 1440);
    else if (onOff(a) !== null) c.enabled = onOff(a);
    else return ctx.reply(`⚙️ Auto Sambut Owner\nStatus: ${c.enabled ? 'ON' : 'OFF'}\nCooldown: ${c.cooldown} menit\n\n${ctx.prefix}sambutowner on/off/set <menit>`);
    ctx.db.touch(); await ctx.reply(`✅ Auto sambut owner ${c.enabled ? 'AKTIF' : 'NONAKTIF'} (cooldown ${c.cooldown} menit).`);
  },
  async onMessage(ctx) {
    const c = ctx.db.settings().sambutOwner;
    if (!c?.enabled || !ctx.m.isGroup || !ctx.isOwner || ctx.m.fromMe) return false;
    const g = ctx.db.group(ctx.m.chat);
    if (g.lastSambut && Date.now() - g.lastSambut < c.cooldown * 60000) return false;
    g.lastSambut = Date.now(); ctx.db.touch();
    await ctx.reply(`👑 Selamat datang owner ${ctx.config.owner.name}! Bot siap melayani.`);
    return false;
  } });
