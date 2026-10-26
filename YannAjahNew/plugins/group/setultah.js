'use strict';
// ----------------------------------------------------------------- ulang tahun
const { UsageError } = require('../../library/errors');
const scheduler = require('../../library/scheduler');
const { G, MONTHS } = require('../../lib/group-activity');

module.exports = G({ id: 'group.setultah', name: 'setultah', description: 'Simpan tanggal ulang tahunmu: .setultah DD/MM atau DD/MM/YYYY (bot mengucapkan jam 07:00)', usage: 'DD/MM[/YYYY]',
  async run(ctx) {
    const mm = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}))?$/.exec(ctx.args[0] || '');
    if (!mm) throw new UsageError(`Format: ${ctx.prefix}setultah 25/12 atau 25/12/2005`);
    const [day, month, year] = [Number(mm[1]), Number(mm[2]), mm[3] ? Number(mm[3]) : null];
    const max = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    if (!max || day < 1 || day > max || (year && (year < 1900 || year > new Date().getFullYear()))) throw new UsageError('❌ Tanggal tidak valid.');
    const b = ctx.group.birthdays = ctx.group.birthdays || {}; b[ctx.m.sender] = { day, month, year }; ctx.db.touch();
    scheduler.start(ctx.yannajah, ctx.config);
    await ctx.reply(`🎂 Ulang tahunmu disimpan: ${day} ${MONTHS[month - 1]}${year ? ` ${year}` : ''}`);
  } });
