'use strict';
// Auto-correct typo command (V15: .autocorrect on/off). Owner. Saat ON, command yang salah ketik
// dicoba disarankan/diperbaiki ke command terdekat (memakai registry.suggest di router).
const { feature } = require('../../library/plugin-kit');

module.exports = feature({
  id: 'owner.autocorrect', name: 'autocorrect', category: 'owner', permission: 'owner', cooldown: 2,
  description: 'Nyalakan/matikan auto-correct command typo', usage: 'on/off',
  async run(ctx) {
    const s = ctx.db.settings();
    const v = (ctx.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return ctx.reply(`Auto-correct: *${s.autoCorrect ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
    s.autoCorrect = v === 'on'; ctx.db.touch();
    await ctx.reply(`✅ Auto-correct ${v === 'on' ? 'AKTIF' : 'NONAKTIF'}.`);
  }
});
