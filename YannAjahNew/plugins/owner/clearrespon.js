'use strict';
const media = require('../../library/mediastore');
const { O, obj, sendResponse } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.clearrespon', name: 'clearrespon', description: 'Hapus semua respon otomatis',
  async run(ctx) { const r = obj(ctx.db.raw(), 'responses'); const names = Object.values(r).map(v => v.media?.name); const n = names.length; ctx.db.raw().responses = {}; ctx.db.touch(); names.forEach(x => media.release(x, ctx.db)); await ctx.reply(`✅ ${n} respon dihapus.`); },
  async onMessage(ctx) {
    if (ctx.m.isCmd || !ctx.m.body || ctx.m.body.length > 60 || ctx.m.fromMe) return false;
    const r = ctx.db.raw().responses?.[ctx.m.body.toLowerCase().trim()];
    if (!r) return false;
    await sendResponse(ctx, r); return true;
  } });
