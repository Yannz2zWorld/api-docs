'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'group.setintro', name: 'setintro', category: 'group', scope: 'group', permission: 'admin', description: 'Atur template .intro grup', usage: '<template>',
  async run(ctx) { ctx.group.introTemplate = ctx.requireText('Format: .setintro <template>\nContoh: .setintro ╔──☉ INTRO\n│ ✧ Nama: •••\n╚───☉').slice(0, 2000); ctx.db.touch(); await ctx.reply('✅ Template intro disimpan.'); } });
