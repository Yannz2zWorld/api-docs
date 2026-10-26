'use strict';
const { HTTP, T } = require('../../lib/devtools');

module.exports = T('httpstatus', 'Arti kode status HTTP', t => { const c = Number(t.trim()); return HTTP[c] ? `${c} ${HTTP[c]}` : `Kode ${t.trim()} tidak dikenal (${c >= 100 && c < 600 ? ['', 'Informational', 'Success', 'Redirection', 'Client error', 'Server error'][Math.floor(c / 100)] : 'di luar 100-599'})`; }, [{ input: '429', expect: '429 Too Many Requests' }], { aliases: ['statuscode'] });
