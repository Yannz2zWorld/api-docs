'use strict';
const { UsageError } = require('../../library/errors');
const { MAX_ITEMS, P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.note.add', name: 'catat', aliases: ['addnote'], description: 'Simpan catatan pribadi', usage: '<teks>',
  async run(ctx) { const n = list(ctx, 'notes'); if (n.length >= MAX_ITEMS) throw new UsageError(`Maks ${MAX_ITEMS} catatan.`); n.push({ text: ctx.requireText().slice(0, 1000), at: Date.now() }); ctx.db.touch(); await ctx.reply(`📝 Catatan #${n.length} disimpan.`); } });
