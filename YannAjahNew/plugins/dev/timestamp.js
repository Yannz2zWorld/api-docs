'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = feature({ id: 'dev.timestamp', name: 'timestamp', aliases: ['epoch'], category: 'dev', description: 'Unix timestamp ↔ tanggal ISO', usage: '[timestamp | tanggal ISO]',
  pure: t => { const s = String(t || '').trim(); if (!s) return `Sekarang: ${Math.floor(Date.now() / 1000)}`; if (/^\d{9,13}$/.test(s)) { const ms = s.length > 10 ? Number(s) : Number(s) * 1000; return new Date(ms).toISOString(); } const d = new Date(s); if (Number.isNaN(d.getTime())) throw new UsageError('Tanggal tidak dikenali.'); return String(Math.floor(d.getTime() / 1000)); },
  tests: [{ input: '0000000000', expect: '1970-01-01T00:00:00.000Z' }, { input: '2024-01-01T00:00:00Z', expect: '1704067200' }],
  async run(ctx) { await ctx.reply(this.pure(ctx.text)); } });
