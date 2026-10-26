'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('htmlunescape', 'Unescape entitas HTML', t => t.replace(/&(amp|lt|gt|quot|#39|#x([0-9a-f]+)|#(\d+));/gi, (m, n, hx, dc) => (hx ? String.fromCodePoint(parseInt(hx, 16)) : dc ? String.fromCodePoint(Number(dc)) : { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[n.toLowerCase()])), [{ input: '&lt;a&gt; &#65;&#x42;', expect: '<a> AB' }]);
