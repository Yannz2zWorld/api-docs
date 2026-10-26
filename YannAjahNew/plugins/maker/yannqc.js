'use strict';
const { UsageError } = require('../../library/errors');
const { COLORS, COLOR_LIST, M, sendQuote } = require('../../lib/quote');

module.exports = M({ id: 'maker.yannqc', name: 'yannqc', aliases: ['yanqc', 'qc'], description: 'Stiker quote berwarna dari fotomu: .yannqc <warna> <teks>', usage: '<warna> <teks>',
  async run(ctx) {
    const [color, ...rest] = (ctx.text || '').split(' ');
    const msg = rest.join(' ');
    if (!ctx.text) throw new UsageError(`*Masukkan input!*\n\nContoh:\n${ctx.prefix}yannqc pink halo\n\nWarna: ${COLOR_LIST}`);
    const useColor = COLORS[color?.toLowerCase()] ? color.toLowerCase() : null;
    await sendQuote(ctx, useColor || 'putih', useColor ? msg || ctx.m.quoted?.text || '' : ctx.text);
  } });
