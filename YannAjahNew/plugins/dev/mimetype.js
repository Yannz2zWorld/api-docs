'use strict';
const { MIME, T } = require('../../lib/devtools');

module.exports = T('mimetype', 'MIME type dari ekstensi file', t => { const e = t.trim().toLowerCase().replace(/^.*\./, ''); return MIME[e] ? `.${e} → ${MIME[e]}` : `Ekstensi .${e} tidak ada di tabel.`; }, [{ input: 'foto.webp', expect: '.webp → image/webp' }], { aliases: ['mime'] });
