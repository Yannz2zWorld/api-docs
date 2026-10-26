'use strict';
const crypto = require('crypto');
const { textTool } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');

module.exports = textTool({ id: 'fun.ship', name: 'ship', aliases: ['jodoh', 'cocok'], category: 'fun', description: 'Persentase kecocokan dua nama (hiburan, hasil konsisten)', usage: '<nama1>|<nama2>', fn: t => { const [a, b] = t.split('|').map(s => s && s.trim()); if (!a || !b) throw new UsageError('Format: nama1|nama2'); const p = crypto.createHash('md5').update([a.toLowerCase(), b.toLowerCase()].sort().join('+')).digest().readUInt16BE(0) % 101; return `💞 ${a} × ${b}: *${p}%*\n${p > 80 ? 'Jodoh banget!' : p > 50 ? 'Lumayan cocok' : p > 25 ? 'Perlu usaha' : 'Mending temenan aja'}`; }, tests: [{ input: 'Budi|Ani', expect: o => /^💞 Budi × Ani: \*\d+%\*/.test(o) }, { input: 'Ani|Budi', expect: o => o.includes('%') }] });
