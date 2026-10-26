'use strict';
// ----------------------------------------------------------------- badword
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { arr } = require('../../lib/owner-manage');

module.exports = feature({ id: 'group.addbadword', name: 'addbadword', aliases: ['tambahbadword'], category: 'group', scope: 'group', permission: 'admin', description: 'Tambah kata terlarang grup (pesan berisi kata itu dihapus saat .antibadword on)', usage: '<kata>',
  async run(ctx) { const w = ctx.requireText().toLowerCase().trim().slice(0, 40); const l = arr(ctx.group, 'badwords'); if (l.includes(w)) throw new UsageError(`❌ Kata "${w}" sudah ada!`); if (l.length >= 200) throw new UsageError('Maksimal 200 kata.'); l.push(w); ctx.db.touch(); await ctx.reply(`✅ "${w}" ditambahkan. ${ctx.group.antibadword ? '' : `Aktifkan: ${ctx.prefix}antibadword on`}`); } });
