'use strict';
// Ekonomi virtual (saldo dalam bot, bukan uang sungguhan): saldo, kerja, transfer, papan peringkat.
const crypto = require('crypto');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { jidUser, normalizePhone, toJid } = require('../library/function');

const E = f => feature({ category: 'economy', ...f });
const JOBS = ['ojek online', 'barista', 'programmer freelance', 'kurir paket', 'penjual bakso', 'desainer grafis', 'guru les', 'admin toko online'];

module.exports = { E, JOBS };
