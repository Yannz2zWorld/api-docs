'use strict';
const { toggle } = require('../../lib/group');

module.exports = toggle('onlyadmin', 'Mode hanya admin yang bisa pakai bot', { field: 'onlyAdmin', allowWhenMuted: true });
