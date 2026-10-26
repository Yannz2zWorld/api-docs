'use strict';
const { O, onOff } = require('../../lib/owner');

module.exports = O({ id: 'owner.autotyping', name: 'autotyping', description: 'Tampilkan "mengetik..." saat memproses command', usage: 'on/off', run: ctx => onOff(ctx, 'autotyping', 'Autotyping') });
