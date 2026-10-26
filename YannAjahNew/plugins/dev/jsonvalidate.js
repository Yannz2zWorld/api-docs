'use strict';
const { T } = require('../../lib/devtools');

module.exports = T('jsonvalidate', 'Validasi JSON', t => { try { JSON.parse(t); return '✅ JSON valid'; } catch (e) { return `❌ JSON tidak valid: ${e.message.slice(0, 150)}`; } }, [{ input: '{"a":1}', expect: '✅ JSON valid' }, { input: '{a:1}', expect: /^❌/ }]);
