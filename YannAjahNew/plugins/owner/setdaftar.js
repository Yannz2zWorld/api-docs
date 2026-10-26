'use strict';
const { O, onOff } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.setdaftar', name: 'setdaftar', aliases: ['setregister'], description: 'Wajib daftar sebelum memakai bot: on/off', usage: 'on/off',
  async run(ctx) { const v = onOff(ctx.args[0]); const st = ctx.db.settings(); if (v === null) return ctx.reply(`📝 *SISTEM DAFTAR*\nStatus: ${(st.registerRequired ?? ctx.config.permission.registerRequired) ? '✅ AKTIF' : '❌ NONAKTIF'}\n${ctx.usage()}`); st.registerRequired = v; ctx.db.touch(); await ctx.reply(v ? '✅ Sistem daftar AKTIF\nUser baru harus daftar.' : '✅ Sistem daftar NONAKTIF'); } });
