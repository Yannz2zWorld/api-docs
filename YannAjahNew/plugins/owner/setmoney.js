'use strict';
const { ownerMoney } = require('../../lib/bank');

module.exports = ownerMoney('setmoney', 'Atur', (u, n) => { u.money = n; });
