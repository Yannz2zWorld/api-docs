'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('wrap', 'Bungkus teks per N karakter: .wrap 20|teks', t => { const m = /^(\d{1,3})\s*\|\s*([\s\S]+)$/.exec(t); const w = m ? Math.max(5, Number(m[1])) : 40; const s = m ? m[2] : t; const out = []; let line = ''; for (const word of s.split(/\s+/)) { if ((line + ' ' + word).trim().length > w) { if (line) out.push(line); line = word; } else line = (line + ' ' + word).trim(); } if (line) out.push(line); return out.join('\n'); }, [{ input: '10|satu dua tiga empat', expect: 'satu dua\ntiga empat' }], { usage: '[lebar]|<teks>' });
