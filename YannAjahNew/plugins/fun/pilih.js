'use strict';
const { textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { pick } = require('../../lib/fun');

module.exports = textTool({ id: 'fun.pilih', name: 'pilih', aliases: ['choose'], category: 'fun', description: 'Pilihkan satu opsi: .pilih nasi|mie|roti', usage: '<a>|<b>|...', fn: t => { const o = t.split('|').map(s => s.trim()).filter(Boolean); if (o.length < 2) throw new UsageError('Minimal 2 pilihan dipisah |'); return `🤔 Aku pilih: *${pick(o)}*`; }, tests: [{ input: 'a|b', expect: /^🤔 Aku pilih: \*(a|b)\*$/ }] });
