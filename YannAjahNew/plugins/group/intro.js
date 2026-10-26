'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'group.intro', name: 'intro', category: 'group', scope: 'group', description: 'Tampilkan template perkenalan member grup',
  async run(ctx) { await ctx.reply(ctx.group.introTemplate || '╔──☉ INTRO MEMBER\n│ ✦ Nama: •••\n│ ✦ Umur: •••\n│ ✦ Gender: •••\n│ ✦ Askot: •••\n╚────────────☉'); } });
