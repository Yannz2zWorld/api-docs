'use strict';
const { feature } = require('../../library/plugin-kit');
const { mention } = require('../../library/targets');

module.exports = feature({ id: 'group.antibadword', name: 'antibadword', aliases: ['antitoxic'], category: 'group', scope: 'group', permission: 'admin', description: 'Hapus otomatis pesan berisi kata terlarang (+ peringatan)', usage: 'on/off',
  async run(ctx) { const v = (ctx.args[0] || '').toLowerCase(); if (!['on', 'off'].includes(v)) return ctx.reply(`Antibadword: *${ctx.group.antibadword ? 'ON' : 'OFF'}*\n${ctx.usage()}`); ctx.group.antibadword = v === 'on'; ctx.db.touch(); await ctx.reply(`✅ Antibadword ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`); },
  async onMessage(ctx) {
    const m = ctx.m; if (!m.isGroup || !m.body || ctx.isAdmin || ctx.isOwner) return false;
    const g = ctx.db.get(['groups', m.chat]); if (!g?.antibadword || !g.badwords?.length) return false;
    const words = m.body.toLowerCase().split(/[^a-z0-9]+/);
    const hit = g.badwords.find(w => (w.includes(' ') ? m.body.toLowerCase().includes(w) : words.includes(w)));
    if (!hit) return false;
    if (ctx.isBotAdmin) await ctx.yannajah.sendmessage(m.chat, { delete: m.key }).catch(() => {});
    await ctx.reply(`⚠️ ${mention(m.sender)} jaga bahasa ya, pesan berisi kata terlarang.`);
    return true;
  } });
