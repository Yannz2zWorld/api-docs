'use strict';
// Manajemen grup (V15 menu-group). Semua aksi lewat API grup Baileys:
// groupParticipantsUpdate, groupSettingUpdate, groupInviteCode, groupRevokeInvite,
// groupUpdateSubject, groupUpdateDescription, groupLeave, groupAcceptInvite.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const { jidUser, normalizePhone, toJid } = require('../library/function');

const G = (f) => feature({ category: 'group', scope: 'group', ...f });
const sock = ctx => { const s = ctx.yannajah.socket; if (!s) throw new UsageError('Bot belum terhubung.'); return s; };

// Target: mention, reply, atau nomor di argumen.
function targets(ctx) {
  const out = new Set(ctx.m.mentionedJid || []);
  if (ctx.m.quoted?.sender) out.add(ctx.m.quoted.sender);
  for (const a of ctx.args) { const p = normalizePhone(a.replace(/^@/, '')); if (p) out.add(toJid(p)); }
  return [...out].filter(j => j !== `${jidUser(ctx.yannajah.socket?.user?.id || '')}@s.whatsapp.net`);
}
function needTargets(ctx) { const t = targets(ctx); if (!t.length) throw new UsageError(`Tag/reply anggota atau tulis nomornya. ${ctx.usage()}`); return t.slice(0, 20); }

const toggle = (key, label, extra = {}) => G({
  id: `group.${key}`, name: key, category: 'group', description: `Nyalakan/matikan ${label}: .${key} on/off`, usage: 'on/off', permission: 'admin', ...extra,
  async run(ctx) {
    const v = (ctx.args[0] || '').toLowerCase();
    if (!['on', 'off'].includes(v)) return ctx.reply(`${label}: *${ctx.group[extra.field || key] ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
    ctx.group[extra.field || key] = v === 'on';
    ctx.db.touch();
    await ctx.reply(`✅ ${label} ${v === 'on' ? 'dinyalakan' : 'dimatikan'}.`);
  }
});

const LINK_RE = /chat\.whatsapp\.com\/([A-Za-z0-9]{10,})/i;

module.exports = { G, sock, needTargets, toggle, LINK_RE };
