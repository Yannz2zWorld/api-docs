'use strict';
// Menentukan user target sebuah command: mention, reply, atau nomor di argumen (V15: @tag / reply / 628xx).
const { UsageError } = require('./errors');
const { jidUser, normalizePhone, toJid } = require('./function');

// Mention di grup bisa berupa LID: ubah ke nomor (JID @s.whatsapp.net) lewat metadata grup.
function toPn(ctx, jid) {
  if (!String(jid).endsWith('@lid')) return jid;
  const p = ctx.m.groupMetadata?.participants?.find(x => x.lid === jid || x.id === jid);
  return p?.phoneNumber || (p?.id?.endsWith('@s.whatsapp.net') ? p.id : jid);
}

function targetJids(ctx, { max = 20 } = {}) {
  const out = new Set((ctx.m.mentionedJid || []).map(j => toPn(ctx, j)));
  if (ctx.m.quoted?.sender) out.add(ctx.m.quoted.sender);
  for (const a of ctx.args) {
    if (!/^@?\+?\d[\d\s-]{6,}$/.test(a)) continue;
    const p = normalizePhone(a.replace(/^@/, ''));
    if (p) out.add(toJid(p));
  }
  return [...out].slice(0, max);
}

function targetJid(ctx, { self = false } = {}) {
  const t = targetJids(ctx, { max: 1 })[0];
  if (t) return t;
  if (self) return ctx.m.sender;
  throw new UsageError(`Tag/reply user atau tulis nomornya. ${ctx.usage()}`);
}

// Angka di argumen yang bukan nomor telepon (mis. jumlah hari / limit).
function amountArg(ctx, { min = 1, max = 1e9, fallback = null } = {}) {
  const a = ctx.args.find(x => /^\d{1,9}$/.test(x) && x.length < 7);
  const n = a === undefined ? fallback : Number(a);
  if (n === null || !Number.isFinite(n) || n < min || n > max) return null;
  return n;
}

const mention = jid => `@${jidUser(jid)}`;

module.exports = { targetJids, targetJid, amountArg, mention, toPn };
