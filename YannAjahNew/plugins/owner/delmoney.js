'use strict';
const { ownerMoney } = require('../../lib/bank');

module.exports = ownerMoney('delmoney', 'Kurangi', (u, n) => { u.money = Math.max(0, (u.money || 0) - n); });
