'use strict';
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { A } = require('../../lib/group-activity');
const { timesFor, PRAYERS } = require('../../lib/autosholat');

module.exports = A({ id: 'group.autosholat', name: 'autosholat', description: 'Pengingat waktu sholat otomatis di grup: .autosholat on Jakarta / .autosholat off', usage: 'on <kota> | off',
  dependencies: { apiz2z: '/api/info/jadwal-sholat' },
  async run(ctx) {
    const [mode, ...kotaParts] = ctx.args;
    const kota = kotaParts.join(' ').trim().slice(0, 40);
    const g = ctx.group;
    if (mode === 'off') { g.autoSholat = { ...(g.autoSholat || {}), enabled: false }; ctx.db.touch(); return ctx.reply('✅ Pengingat sholat dimatikan.'); }
    if (mode !== 'on') return ctx.reply(`Pengingat sholat: *${g.autoSholat?.enabled ? `ON (${g.autoSholat.kota})` : 'OFF'}*\n${ctx.usage()}`);
    if (!kota) throw new UsageError('Tulis kotanya. Contoh: .autosholat on Jakarta');
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: ctx.config.bot.timezone }).format(new Date());
    const times = await timesFor(ctx.api, kota, today);
    if (!times) throw new UsageError(`Jadwal sholat untuk "${kota}" tidak ditemukan. Coba nama kota/kabupaten lain.`);
    g.autoSholat = { enabled: true, kota, last: '' }; ctx.db.touch();
    scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`✅ Pengingat sholat aktif untuk *${kota}*\n${PRAYERS.map(p => `• ${p.charAt(0).toUpperCase() + p.slice(1)}: ${times[p]}`).join('\n')}`);
  } });
