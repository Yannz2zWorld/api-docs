'use strict';
const { feature } = require('../../library/plugin-kit');

module.exports = feature({ id: 'core.status', name: 'status', aliases: ['lisensi'], category: 'core', description: 'Status lisensi, koneksi WhatsApp, maintenance', allowInMaintenance: true,
  async run(ctx) {
    const h = ctx.yannajah.health(); const l = h.license || {};
    await ctx.reply([`Lisensi: ${l.active ? '✅ aktif' : `🔒 terkunci (${l.reason})`}`, `Bot: ${l.bot ? `${l.bot.name} (${l.bot.phone_number})` : '-'}`, `Instance: ${l.instanceName || '-'}`, `Maintenance: ${l.maintenance?.active ? `ya (${l.maintenance.scope})` : 'tidak'}`, `WhatsApp: ${h.wa}`, `Verifikasi terakhir: ${l.lastOkAt || '-'}`].join('\n'));
  } });
