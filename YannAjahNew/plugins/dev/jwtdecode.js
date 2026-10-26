'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/devtools');

module.exports = T('jwtdecode', 'Decode payload JWT (TANPA verifikasi tanda tangan)', t => { const p = t.trim().split('.'); if (p.length !== 3) throw new UsageError('JWT harus 3 bagian dipisah titik.'); const dec = s => { try { return JSON.parse(Buffer.from(s, 'base64url').toString('utf8')); } catch { throw new UsageError('Bagian JWT bukan JSON base64url.'); } }; const h = dec(p[0]), b = dec(p[1]); const exp = b.exp ? `\nexp: ${new Date(b.exp * 1000).toISOString()}${b.exp * 1000 < Date.now() ? ' (KEDALUWARSA)' : ''}` : ''; return `Header:\n${JSON.stringify(h, null, 2)}\nPayload:\n${JSON.stringify(b, null, 2)}${exp}\n⚠️ Tanda tangan TIDAK diverifikasi.`; }, [{ input: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.x', expect: o => o.includes('"sub": "123"') && o.includes('"alg": "HS256"') }]);
