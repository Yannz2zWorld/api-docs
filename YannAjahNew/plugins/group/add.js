'use strict';
const { jidUser } = require('../../library/function');
const { G, needTargets, sock } = require('../../lib/group');

module.exports = G({ id: 'group.add', name: 'add', description: 'Tambahkan anggota dengan nomor (hanya nomor yang mengizinkan)', usage: '<nomor>', permission: 'admin', botAdmin: true, cooldown: 10,
  async run(ctx) {
    const t = needTargets(ctx).slice(0, 5);
    const res = await sock(ctx).groupParticipantsUpdate(ctx.m.chat, t, 'add');
    const lines = (res || []).map(r => `${jidUser(r.jid)}: ${r.status === '200' ? '✅ ditambahkan' : r.status === '403' ? '🔒 perlu undangan (privasi)' : r.status === '409' ? 'sudah di grup' : `gagal (${r.status})`}`);
    await ctx.reply(lines.join('\n') || 'Selesai.');
  } });
