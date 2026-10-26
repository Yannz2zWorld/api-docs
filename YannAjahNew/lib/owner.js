'use strict';
// Command owner (V15 menu-owner) yang aman. Sengaja TIDAK ada: eval/exec dari chat, broadcast massal
// (jpm/pushkontak), dan ambil-alih grup — lihat docs/FEATURES.md bagian "dikecualikan".
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { jidUser, normalizePhone, toJid } = require('../library/function');

const O = f => feature({ category: 'owner', permission: 'owner', cooldown: 1, allowInMaintenance: true, ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };
function targetNumber(ctx) {
  const j = ctx.m.mentionedJid?.[0] || ctx.m.quoted?.sender;
  if (j) return jidUser(j);
  const p = normalizePhone(ctx.args[0] || '');
  if (!p) throw new UsageError(`Tag/reply user atau tulis nomornya. ${ctx.usage()}`);
  return p;
}
const onOff = (ctx, key, label) => {
  const v = (ctx.args[0] || '').toLowerCase();
  const s = ctx.db.settings();
  if (!['on', 'off'].includes(v)) return ctx.reply(`${label}: *${s[key] ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
  s[key] = v === 'on'; ctx.db.touch();
  return ctx.reply(`✅ ${label} ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`);
};

module.exports = { O, sock, targetNumber, onOff };
