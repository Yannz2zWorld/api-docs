'use strict';
const { mention } = require('../../library/targets');
const { A, DAY, act, botJid, members } = require('../../lib/group-activity');

module.exports = A({ id: 'group.sider', name: 'sider', aliases: ['ceksider', 'gcsider', 'groupsider', 'sidercek', 'sidergc', 'sidergroup'], description: 'Daftar member pasif (tidak chat N hari, default 7)', usage: '[hari]',
  async run(ctx) {
    const days = Math.min(Math.max(Number(ctx.args[0]) || 7, 1), 365);
    const a = act(ctx.group); const cut = Date.now() - days * DAY; const bot = botJid(ctx);
    const tracked = Math.floor((Date.now() - a.since) / DAY);
    const list = members(ctx).filter(p => !p.admin && p.jid !== bot && !((a.users[p.jid]?.last || 0) > cut));
    await ctx.reply(`👻 *SIDER GRUP* (tidak chat ${days} hari)\nBot mencatat sejak ${tracked} hari lalu${tracked < days ? ' — data belum lengkap' : ''}\nTotal: ${list.length} dari ${members(ctx).length} member\n\n${list.slice(0, 100).map((p, i) => `${i + 1}. ${mention(p.jid)}${a.users[p.jid] ? ` (terakhir ${Math.floor((Date.now() - a.users[p.jid].last) / DAY)} hari)` : ' (belum pernah chat)'}`).join('\n')}${list.length ? `\n\nKick: ${ctx.prefix}kicksider ${days} confirm` : ''}`);
  } });
