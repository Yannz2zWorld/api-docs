'use strict';
const { UsageError } = require('../../library/errors');
const { O, obj, sendResponse } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.getcase', name: 'getcase', aliases: ['getcmd'], description: 'Lihat isi command buatan sendiri', usage: '<nama>',
  async run(ctx) { const c = obj(ctx.db.raw(), 'customCommands')[ctx.requireText().toLowerCase()]; if (!c) throw new UsageError('❌ Command tidak ada.'); await ctx.reply(`${c.media ? `[${c.media.kind}] ` : ''}${c.text || ''}`); },
  // Jalankan command buatan: .nama
  async onMessage(ctx) { if (!ctx.m.isCmd || ctx.user.banned) return false; const c = ctx.db.raw().customCommands?.[ctx.m.command]; if (!c || ctx.yannajah.registry.resolve(ctx.m.command)) return false; await sendResponse(ctx, c); return true; } });
