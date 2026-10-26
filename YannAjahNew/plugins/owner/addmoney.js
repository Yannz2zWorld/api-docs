'use strict';
const { ownerMoney } = require('../../lib/bank');

module.exports = ownerMoney('addmoney', 'Tambah', (u, n) => { u.money = (u.money || 0) + n; });
