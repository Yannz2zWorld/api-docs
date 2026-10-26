'use strict';
const { UsageError } = require('../../library/errors');
const { MAX_ITEMS, P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.todo.add', name: 'todo', aliases: ['addtodo'], description: 'Tambah to-do', usage: '<tugas>',
  async run(ctx) { const t = list(ctx, 'todos'); if (t.length >= MAX_ITEMS) throw new UsageError(`Maks ${MAX_ITEMS} to-do.`); t.push({ text: ctx.requireText().slice(0, 300), done: false }); ctx.db.touch(); await ctx.reply(`✅ To-do #${t.length} ditambahkan.`); } });
