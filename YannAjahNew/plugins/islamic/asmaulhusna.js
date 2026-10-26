'use strict';
const crypto = require('crypto');
const { UsageError } = require('../../library/errors');
const { ASMA, I, fmtAsma } = require('../../lib/islamic');

module.exports = I({ id: 'islamic.asmaulhusna', name: 'asmaulhusna', category: 'islamic', description: '99 Asmaul Husna: .asmaulhusna [nomor | acak | semua]', usage: '[nomor|semua]',
  pure: t => { const s = String(t || '').trim().toLowerCase(); if (s === 'semua' || s === 'all') return ASMA.map(fmtAsma).join('\n'); if (/^\d{1,2}$/.test(s)) { const a = ASMA[Number(s) - 1]; if (!a) throw new UsageError('Nomor 1-99.'); return fmtAsma(a); } return fmtAsma(ASMA[crypto.randomInt(0, ASMA.length)]); },
  tests: [{ input: '1', expect: '1. *Ar Rahman* — الرَّحْمَنُ\n   Yang Memiliki Mutlak sifat Pemurah' }, { input: 'semua', expect: o => o.split('\n').length === 198 }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
