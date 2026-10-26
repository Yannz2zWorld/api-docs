'use strict';
const { T, parseJson } = require('../../lib/devtools');

module.exports = T('jsonminify', 'Minify JSON', t => JSON.stringify(parseJson(t)), [{ input: '{ "a": 1,\n "b": 2 }', expect: '{"a":1,"b":2}' }]);
