'use strict';
const { T } = require('../../lib/text-encode');

module.exports = T('htmlescape', 'Escape karakter HTML', t => t.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]), [{ input: '<b>"x"</b>', expect: '&lt;b&gt;&quot;x&quot;&lt;/b&gt;' }]);
