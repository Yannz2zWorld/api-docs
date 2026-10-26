'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('base64', 'Encode teks ke Base64', t => Buffer.from(t, 'utf8').toString('base64'), [{ input: 'halo', expect: 'aGFsbw==' }], { aliases: ['enc64'] });
