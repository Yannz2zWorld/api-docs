'use strict';
const { T } = require('../../lib/text-case');

module.exports = T('readmore', 'Teks "Baca selengkapnya" WhatsApp: .readmore depan|belakang', t => { const [a, ...b] = t.split('|'); return `${a}${'‎'.repeat(4001)}${b.join('|')}`; }, [{ input: 'a|b', expect: o => o.startsWith('a') && o.endsWith('b') && o.length === 4003 }], { usage: '<teks depan>|<teks belakang>', aliases: ['selengkapnya', 'spoiler'] });
