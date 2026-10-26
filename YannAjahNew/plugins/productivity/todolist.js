'use strict';
const { P, list } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.todo.list', name: 'todolist', aliases: ['listtodo'], description: 'Daftar to-do',
  async run(ctx) { const t = list(ctx, 'todos'); await ctx.reply(t.length ? t.map((x, i) => `${i + 1}. ${x.done ? '☑️' : '⬜'} ${x.text}`).join('\n') : 'To-do kosong. Tambah: .todo <tugas>'); } });
