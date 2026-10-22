'use strict';
// Event grup (pengganti handler.js V15): welcome / left. Teks bisa diatur per grup (.setwelcome / .setleft)
// dengan placeholder @user, @group, @desc, @count. Tidak berjalan kalau lisensi terkunci.

const { jidUser } = require('../library/function');

const DEFAULT_WELCOME = 'Halo @user, selamat datang di *@group*! 👋\nKetik .menu untuk melihat fitur bot.';
const DEFAULT_LEFT = '@user telah meninggalkan *@group*. 👋';

function render(tpl, { user, group, desc = '', count = 0 }) {
  return String(tpl).replace(/@user/g, `@${jidUser(user)}`).replace(/@group/g, group).replace(/@desc/g, desc).replace(/@count/g, String(count));
}

function createGroupHandler(yannajah, { logger }) {
  return async function onParticipants(ev) {
    try {
      if (!yannajah.auth.isActive() || yannajah.auth.maintenance().active) return;
      const g = yannajah.database.get(`groups.${ev.id}`);
      if (!g) return;
      const action = ev.action;
      if (!((action === 'add' && g.welcome) || (action === 'remove' && g.left))) return;
      const meta = await yannajah.socket.groupMetadata(ev.id).catch(() => null);
      for (const p of ev.participants || []) {
        const jid = typeof p === 'string' ? p : p.phoneNumber || p.id;
        const text = render(action === 'add' ? g.welcomeText || DEFAULT_WELCOME : g.leftText || DEFAULT_LEFT, { user: jid, group: meta?.subject || 'grup', desc: meta?.desc || '', count: meta?.participants?.length || 0 });
        await yannajah.sendmessage(ev.id, { text, mentions: [jid] });
      }
    } catch (e) { logger.warn('group-participants handler error', e.message); }
  };
}

module.exports = { createGroupHandler, render, DEFAULT_WELCOME, DEFAULT_LEFT };
