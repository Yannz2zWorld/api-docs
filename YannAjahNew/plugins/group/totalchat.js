'use strict';
// ----------------------------------------------------------------- pencatat & total chat
const crypto = require('crypto');
const scheduler = require('../../library/scheduler');
const { mention } = require('../../library/targets');
const { A, act, need } = require('../../lib/group-activity');

module.exports = A({ id: 'group.totalchat', name: 'totalchat', aliases: ['totalpesan'], permission: 'user', description: 'Peringkat jumlah chat member grup (sejak bot mencatat)',
  async run(ctx) {
    const a = act(ctx.group);
    const rows = Object.entries(a.users).sort((x, y) => y[1].count - x[1].count).slice(0, 30);
    if (!rows.length) return ctx.reply('📭 Belum ada chat yang tercatat.');
    const total = Object.values(a.users).reduce((s, u) => s + u.count, 0);
    await ctx.reply(`📊 *TOTAL CHAT GRUP*\nSejak: ${new Date(a.since).toLocaleDateString('id-ID', { timeZone: ctx.config.bot.timezone })}\nTotal: ${total.toLocaleString('id-ID')} pesan\n\n${rows.map(([j, u], i) => `${i + 1}. ${mention(j)} — ${u.count.toLocaleString('id-ID')}`).join('\n')}`);
  },
  // Hook: catat setiap pesan grup (+ exp & auto level). Tidak menghentikan pemrosesan.
  async onMessage(ctx) {
    const m = ctx.m;
    if (!m.isGroup || m.fromMe) return false;
    const g = ctx.db.group(m.chat); const a = act(g);
    const u = a.users[m.sender] = a.users[m.sender] || { count: 0, last: 0 };
    u.count++; u.last = Date.now();
    const user = ctx.db.user(m.sender);
    if (!user.lastXp || Date.now() - user.lastXp > 60000) {
      user.lastXp = Date.now(); user.exp = (user.exp || 0) + crypto.randomInt(5, 16);
      let up = false;
      while (user.exp >= need(user.level || 0)) { user.level = (user.level || 0) + 1; up = true; }
      if (up && g.autolevel) {
        const tpl = g.autolevelText || '🎉 Selamat @user naik ke level *@level*! (XP: @xp)';
        await ctx.yannajah.sendmessage(m.chat, { text: tpl.replace(/@user/g, mention(m.sender)).replace(/@level/g, user.level).replace(/@xp/g, user.exp), mentions: [m.sender] }).catch(() => {});
      }
    }
    ctx.db.touch();
    scheduler.start(ctx.yannajah, ctx.config);
    return false;
  } });
