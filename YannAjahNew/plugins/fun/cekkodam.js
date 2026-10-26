'use strict';
const { feature } = require('../../library/plugin-kit');
const { KODAM, daily } = require('../../lib/fun');

module.exports = feature({ id: 'fun.cekkodam', name: 'cekkodam', category: 'fun', description: 'Cek "khodam" kamu hari ini (hiburan)', usage: '[nama]',
  async run(ctx) { const n = ctx.text || ctx.m.pushName; await ctx.reply(`🔮 Khodam *${n}* hari ini: *${KODAM[daily('kodam', n.toLowerCase()) % KODAM.length]}*`); } });
