'use strict';
const { UsageError } = require('../../library/errors');
const media = require('../../library/mediastore');
const { O, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.delcase', name: 'delcase', aliases: ['delcmd'], description: 'Hapus command buatan sendiri', usage: '<nama>',
  async run(ctx) { const c = obj(ctx.db.raw(), 'customCommands'); const k = ctx.requireText().toLowerCase(); if (!c[k]) throw new UsageError('❌ Command tidak ada.'); const old = c[k].media?.name; delete c[k]; ctx.db.touch(); media.release(old, ctx.db); await ctx.reply(`✅ Command ${k} dihapus.`); } });
