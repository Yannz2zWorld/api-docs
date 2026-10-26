'use strict';
const { O, onOff } = require('../../lib/owner');

module.exports = O({ id: 'owner.autoread', name: 'autoread', description: 'Tandai pesan masuk sebagai dibaca otomatis', usage: 'on/off', run: ctx => onOff(ctx, 'autoread', 'Autoread') });
