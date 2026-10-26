'use strict';
const { UsageError } = require('../../library/errors');
const { T } = require('../../lib/devtools');

module.exports = T('urlparse', 'Uraikan komponen URL', t => { let u; try { u = new URL(t.trim()); } catch { throw new UsageError('URL tidak valid.'); } return [`Protocol: ${u.protocol}`, `Host: ${u.hostname}`, `Port: ${u.port || '(default)'}`, `Path: ${u.pathname}`, `Query: ${[...u.searchParams].map(([k, v]) => `${k}=${v}`).join(', ') || '-'}`, `Hash: ${u.hash || '-'}`].join('\n'); }, [{ input: 'https://a.com:8080/x/y?q=1&r=2#top', expect: 'Protocol: https:\nHost: a.com\nPort: 8080\nPath: /x/y\nQuery: q=1, r=2\nHash: #top' }]);
