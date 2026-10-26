'use strict';
const { T } = require('../../lib/text-analyze');

module.exports = T('wordfreq', 'Frekuensi kata terbanyak', t => {
  const freq = {};
  for (const w of t.toLowerCase().match(/\p{L}[\p{L}\p{N}'-]*/gu) || []) freq[w] = (freq[w] || 0) + 1;
  return Object.entries(freq).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 20).map(([w, n], i) => `${i + 1}. ${w} — ${n}`).join('\n') || '(tidak ada kata)';
}, [{ input: 'a b a c a b', expect: '1. a — 3\n2. b — 2\n3. c — 1' }]);
