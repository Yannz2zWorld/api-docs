'use strict';
const { UsageError } = require('../../library/errors');
const { P, ensureReminderLoop, list, parseDuration } = require('../../lib/productivity');

module.exports = P({ id: 'productivity.remind', name: 'ingatkan', aliases: ['remind', 'reminder'], description: 'Pengingat: .ingatkan 30m minum obat (s/m/jam/hari, maks 30 hari)', usage: '<durasi> <pesan>',
  async run(ctx) {
    const ms = parseDuration(ctx.args[0]);
    const text = ctx.args.slice(1).join(' ').trim();
    if (!ms || !text) throw new UsageError(`Format: ${ctx.prefix}ingatkan 30m pesan (10 detik - 30 hari)`);
    const r = list(ctx, 'reminders');
    if (r.length >= 20) throw new UsageError('Maks 20 pengingat aktif.');
    r.push({ at: Date.now() + ms, text: text.slice(0, 500), chat: ctx.m.chat });
    ctx.db.touch();
    ensureReminderLoop(ctx.yannajah);
    await ctx.reply(`⏰ Oke, aku ingatkan ${new Date(Date.now() + ms).toLocaleString('id-ID', { timeZone: ctx.config.bot.timezone })}.`);
  },
  async onMessage(ctx) { ensureReminderLoop(ctx.yannajah); return false; } });
