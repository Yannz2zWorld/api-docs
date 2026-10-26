'use strict';
const { UsageError } = require('../../library/errors');
const { T, rp } = require('../../lib/calc');

module.exports = T('ppn', 'Hitung PPN: .ppn 100000 [tarif% default 11]', t => { const p = t.trim().split(/\s+/).map(Number); if (!Number.isFinite(p[0])) throw new UsageError('Format: .ppn <harga> [tarif%]'); const r = Number.isFinite(p[1]) ? p[1] : 11; return `DPP: ${rp(p[0])}\nPPN ${r}%: ${rp(p[0] * r / 100)}\nTotal: *${rp(p[0] * (1 + r / 100))}*`; }, [{ input: '100000', expect: o => o.includes('Total: *Rp111.000*') }], { usage: '<harga> [tarif%]' });
