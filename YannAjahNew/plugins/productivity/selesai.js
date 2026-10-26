'use strict';
const { UsageError } = require('../../library/errors');
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.todo.done', name: 'selesai', aliases: ['donetodo'], description: 'Tandai to-do selesai', usage: '<nomor>',
  async run(ctx) { const t = list(ctx, 'todos'); const x = t[Number(ctx.text) - 1]; if (!x) throw new UsageError('Nomor to-do tidak ada.'); x.done = true; ctx.db.touch(); await ctx.reply(`☑️ "${x.text}" selesai.`); } });
