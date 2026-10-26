'use strict';
const { T, parseJson } = require('../../lib/devtools');

module.exports = T('jsonformat', 'Rapikan (pretty print) JSON', t => JSON.stringify(parseJson(t), null, 2), [{ input: '{"a":1,"b":[1,2]}', expect: '{\n  "a": 1,\n  "b": [\n    1,\n    2\n  ]\n}' }], { aliases: ['prettyjson'] });
