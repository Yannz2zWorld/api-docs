'use strict';
const { toggle } = require('../../lib/group');

module.exports = toggle('mute', 'Mute bot di grup ini (bot hanya merespons owner)', { allowWhenMuted: true });
