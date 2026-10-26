'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('hex', 'Encode teks ke hex', t => Buffer.from(t, 'utf8').toString('hex'), [{ input: 'AB', expect: '4142' }], { aliases: ['tohex'] });
