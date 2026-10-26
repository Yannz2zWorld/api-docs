'use strict';
const { O, sock } = require('../../lib/owner-settings');

module.exports = O({ id: 'owner.clearchat', name: 'clearchat', aliases: ['clc'], description: 'Hapus chat ini dari WhatsApp bot',
  async run(ctx) { await sock(ctx).chatModify({ delete: true, lastMessages: [{ key: ctx.m.key, messageTimestamp: ctx.m.timestamp }] }, ctx.m.chat); } });
