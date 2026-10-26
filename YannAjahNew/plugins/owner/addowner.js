'use strict';
const { O, targetNumber } = require('../../lib/owner');

module.exports = O({ id: 'owner.addowner', name: 'addowner', aliases: ['addown'], description: 'Tambah owner bot (disimpan di database lokal)', usage: '<nomor/@tag>',
  async run(ctx) { const n = targetNumber(ctx); const list = ctx.db.raw().owners; if (n === ctx.config.owner.number || list.includes(n)) return ctx.reply('Nomor itu sudah owner.'); list.push(n); ctx.db.touch(); ctx.logger.info('owner ditambah', { by: ctx.m.senderNumber.slice(0, 4) + '…' }); await ctx.reply(`✅ ${n} ditambahkan sebagai owner.`); } });
