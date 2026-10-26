'use strict';
const { UsageError } = require('../../library/errors');
const { A } = require('../../lib/group-admin');

module.exports = A({ id: 'group.hidetagpoll', name: 'hidetagpoll', limit: 1, description: 'Poll dengan tag semua member: .hidetagpoll Pertanyaan?|Opsi1,Opsi2,Opsi3', usage: '<pertanyaan>|<opsi1,opsi2,...>',
  async run(ctx) {
    const [q, opts] = ctx.requireText().split('|'); const values = String(opts || '').split(',').map(x => x.trim()).filter(Boolean);
    if (!q?.trim() || values.length < 2 || values.length > 12) throw new UsageError(`❌ Format: ${ctx.prefix}hidetagpoll Menu makan siang?|Nasi Goreng,Mie Ayam,Bakso`);
    await ctx.yannajah.sendmessage(ctx.m.chat, { poll: { name: q.trim().slice(0, 255), values: values.map(v => v.slice(0, 100)), selectableCount: 1 }, mentions: (ctx.m.groupMetadata?.participants || []).map(p => p.id) });
  } });
