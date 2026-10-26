'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { ZONES } = require('../../lib/datetime');

module.exports = feature({ id: 'datetime.time', name: 'jam', aliases: ['waktu', 'time'], category: 'datetime', description: 'Jam sekarang (WIB/WITA/WIT atau kota/zona IANA)', usage: '[zona]',
  pure: t => { const key = String(t || 'wib').trim().toLowerCase().replace(/\s+/g, ''); const tz = ZONES[key] || t.trim(); try { return `🕒 ${new Date().toLocaleString('id-ID', { timeZone: tz, dateStyle: 'full', timeStyle: 'medium' })} (${tz})`; } catch { throw new UsageError(`Zona waktu tidak dikenal. Contoh: ${Object.keys(ZONES).join(', ')}`); } },
  tests: [{ input: 'wita', expect: /Asia\/Makassar/ }, { input: 'Europe/Berlin', expect: /Europe\/Berlin/ }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
