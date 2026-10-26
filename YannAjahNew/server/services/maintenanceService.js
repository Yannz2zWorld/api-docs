'use strict';
// Maintenance global bot + maintenance WEB DATABASE (satu baris) + status maintenance efektif untuk sebuah bot.

const v = require('../lib/validate');
const { HttpError } = require('../lib/errors');
const access = require('./accessControl');
const audit = require('./auditService');

async function get(q) {
  const r = (await q.query('SELECT enabled, message, exempt_ranks, updated_by, updated_at, web_enabled, web_message, web_updated_by, web_updated_at FROM maintenance_settings WHERE id = 1'))[0];
  return { ...r, updated_by: r.updated_by ? Number(r.updated_by) : null, web_updated_by: r.web_updated_by ? Number(r.web_updated_by) : null };
}

async function setGlobal(db, actor, input, { ip = null } = {}) {
  access.require(actor, 'maintenance.manage');
  const enabled = v.bool(input.enabled, 'enabled');
  const message = input.message !== undefined ? v.message(input.message) : null;
  let exempt = null;
  if (input.exempt_ranks !== undefined) {
    if (!Array.isArray(input.exempt_ranks) || input.exempt_ranks.length > 6) throw require('../lib/errors').badRequest('INVALID_INPUT', 'exempt_ranks harus daftar rank.');
    exempt = [...new Set(input.exempt_ranks.map(v.rank))];
  }
  return db.withTransaction(async tx => {
    const before = await get(tx);
    await tx.query(`UPDATE maintenance_settings SET enabled = $1, message = COALESCE($2, message), exempt_ranks = COALESCE($3, exempt_ranks),
      updated_by = $4, updated_at = now() WHERE id = 1`, [enabled, message, exempt, actor.id]);
    const after = await get(tx);
    await audit.write(tx, { actorId: actor.id, action: 'maintenance.global.update', targetType: 'maintenance', targetId: 1,
      details: { from: { enabled: before.enabled, message: before.message, exempt_ranks: before.exempt_ranks }, to: { enabled: after.enabled, message: after.message, exempt_ranks: after.exempt_ranks } }, ip });
    return after;
  });
}

// Maintenance web database: hanya DEVELOPER (maintenance.manage). Tercatat di audit.
async function setWeb(db, actor, input, { ip = null } = {}) {
  access.require(actor, 'maintenance.manage');
  const enabled = v.bool(input.enabled, 'enabled');
  const message = input.message !== undefined && input.message !== null && input.message !== '' ? v.message(input.message) : null;
  return db.withTransaction(async tx => {
    const before = await get(tx);
    await tx.query('UPDATE maintenance_settings SET web_enabled = $1, web_message = COALESCE($2, web_message), web_updated_by = $3, web_updated_at = now() WHERE id = 1', [enabled, message, actor.id]);
    const after = await get(tx);
    await audit.write(tx, { actorId: actor.id, action: 'maintenance.web.update', targetType: 'maintenance', targetId: 1,
      details: { from: { enabled: before.web_enabled, message: before.web_message }, to: { enabled: after.web_enabled, message: after.web_message } }, ip });
    return after;
  });
}

// Website saat maintenance web: hanya DEVELOPER yang boleh masuk/memakai API.
async function assertWebOpen(q, actor) {
  const m = await get(q);
  if (m.web_enabled && actor?.rank !== 'DEVELOPER') throw new HttpError(503, 'WEB_MAINTENANCE', m.web_message);
}

// Status maintenance untuk bot. Maintenance web menang atas semuanya (bot berhenti total / "stuck");
// lalu per-bot; lalu global (tidak berlaku kalau rank pemilik dikecualikan).
function forBot(global, bot, ownerRank) {
  if (global.web_enabled) return { active: true, scope: 'web', message: global.web_message };
  if (bot.maintenance_enabled) return { active: true, scope: 'bot', message: bot.maintenance_message || global.message };
  if (global.enabled && !(global.exempt_ranks || []).includes(ownerRank)) return { active: true, scope: 'global', message: global.message };
  return { active: false, scope: null, message: null };
}

module.exports = { get, setGlobal, setWeb, assertWebOpen, forBot };
