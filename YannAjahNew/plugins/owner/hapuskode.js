'use strict';
const { UsageError } = require('../../library/errors');
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.hapuskode', name: 'hapuskode', aliases: ['delkode'], description: 'Hapus kode redeem', usage: '<kode>', async run(ctx) { const c = obj(ctx.db.raw(), 'redeemCodes'); const k = (ctx.args[0] || '').toUpperCase(); if (!c[k]) throw new UsageError('❌ Kode tidak ada.'); delete c[k]; ctx.db.touch(); await ctx.reply(`✅ Kode ${k} dihapus.`); } });
