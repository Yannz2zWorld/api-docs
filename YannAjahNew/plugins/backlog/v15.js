'use strict';
// Backlog dari Yann AI V15 Fixed: nama command V15 yang BELUM punya implementasi di YannAjahNew
// (status planned) atau sengaja tidak diimplementasikan karena kebijakan keamanan/konten (status disabled).
// Tidak ada run(): router menjawab "masih planned" / "dinonaktifkan". Tidak tampil di menu.
// Sumber: library/catalog/v15-backlog.json (dibuat dari YannzAjah-cmd.js + plugins V15).
// Catatan: sebagian nama adalah alias satu sama lain di V15 (mis. varian enc-*), jadi jumlahnya
// BUKAN jumlah fitur unik — laporan fitur memisahkannya sebagai "backlog".

const catalog = require('../../library/catalog/v15-backlog.json');

module.exports = registry => catalog.items
  .filter(x => !registry.commands.has(x.name))
  .map(x => ({
    id: `v15.${x.name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    name: x.name,
    aliases: [],
    category: 'backlog',
    description: x.reason || `Command Yann AI V15 "${x.name}" — belum diimplementasikan.`,
    permission: 'user',
    scope: 'all',
    status: x.status,
    source: 'v15',
    params: [],
    dependencies: {}
  }));
