'use strict';
const { A, BOT_ID } = require('../../lib/group-admin');

module.exports = A({ id: 'group.antibot', name: 'antibot', description: 'Hapus (dan kick) pesan dari bot lain: .antibot delete on | .antibot kick on', usage: '<delete|kick> <on|off>',
  async run(ctx) {
    const [mode, v] = ctx.args.map(x => x.toLowerCase());
    if (!['delete', 'kick'].includes(mode) || !['on', 'off'].includes(v)) return ctx.reply(`🔧 *ANTI-BOT*\nDelete: ${ctx.group.antibot ? '✅' : '❌'}\nKick: ${ctx.group.antibotkick ? '✅' : '❌'}\n\n${ctx.prefix}antibot delete on\n${ctx.prefix}antibot kick off`);
    ctx.group[mode === 'kick' ? 'antibotkick' : 'antibot'] = v === 'on'; if (mode === 'kick' && v === 'on') ctx.group.antibot = true; ctx.db.touch();
    await ctx.reply(`✅ Antibot ${mode} ${v === 'on' ? 'aktif' : 'nonaktif'}.`);
  },
  async onMessage(ctx) {
    const m = ctx.m; if (!m.isGroup || m.fromMe || !BOT_ID.test(m.key?.id || '') || ctx.isAdmin || ctx.isOwner) return false;
    const g = ctx.db.get(['groups', m.chat]); if (!g?.antibot || !ctx.isBotAdmin) return false;
    await ctx.yannajah.sendmessage(m.chat, { delete: m.key }).catch(() => {});
    if (g.antibotkick) await ctx.yannajah.socket?.groupParticipantsUpdate(m.chat, [m.sender], 'remove').catch(() => {});
    return true;
  } });
