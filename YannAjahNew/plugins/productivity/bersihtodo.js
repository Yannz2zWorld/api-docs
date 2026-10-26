'use strict';
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.todo.clear', name: 'bersihtodo', aliases: ['cleartodo'], description: 'Hapus to-do yang sudah selesai',
  async run(ctx) { const before = list(ctx, 'todos').length; ctx.user.todos = ctx.user.todos.filter(x => !x.done); ctx.db.touch(); await ctx.reply(`🧹 ${before - ctx.user.todos.length} to-do selesai dihapus.`); } });
