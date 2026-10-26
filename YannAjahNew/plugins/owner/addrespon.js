'use strict';
// ----------------------------------------------------------------- respon otomatis
const { UsageError } = require('../../library/errors');
const { KEY_RE, O, captureResponse, obj } = require('../../lib/owner-manage');

module.exports = O({ id: 'owner.addrespon', name: 'addrespon', description: 'Reply pesan + .addrespon <kata kunci>: bot membalas pesan itu tiap ada yang mengetik kata kunci', usage: '<kata kunci>',
  async run(ctx) {
    const key = ctx.requireText().toLowerCase().trim(); if (!KEY_RE.test(key)) throw new UsageError('Kata kunci 1-60 karakter.');
    const r = obj(ctx.db.raw(), 'responses'); if (r[key]) throw new UsageError(`Respon *${key}* sudah ada!`);
    if (Object.keys(r).length >= 300) throw new UsageError('Maksimal 300 respon.');
    r[key] = await captureResponse(ctx); ctx.db.touch();
    await ctx.reply(`✅ Respon untuk *${key}* disimpan.`);
  } });
