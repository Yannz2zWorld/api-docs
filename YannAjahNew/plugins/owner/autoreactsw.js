'use strict';
const { O, onOff } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.autoreactsw', name: 'autoreactsw', aliases: ['autoreadsw'], description: 'Otomatis baca & beri reaksi status WhatsApp kontak', usage: 'on/off [emoji]',
  async run(ctx) { const v = onOff(ctx.args[0]); const st = ctx.db.settings(); if (v === null) return ctx.reply(`Auto read & react SW: *${st.autoReactSw ? 'ON' : 'OFF'}*\n${ctx.usage()}`); st.autoReactSw = v; if (ctx.args[1]) st.autoReactEmoji = [...ctx.args[1]].slice(0, 2).join(''); ctx.db.touch(); await ctx.reply(`✅ Auto Read & React SW ${v ? 'AKTIF' : 'NONAKTIF'}`); } });
