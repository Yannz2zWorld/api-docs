'use strict';
// Maintenance global (satu baris) + helper status maintenance efektif untuk sebuah bot.

const v = require('../lib/validate');
const access = require('./accessControl');
const audit = require('./auditService');

async function get(q) {
  const r = (await q.query('SELECT enabled, message, exempt_ranks, updated_by, updated_at FROM maintenance_settings WHERE id = 1'))[0];
  return { ...r, updated_by: r.updated_by ? Number(r.updated_by) : null };
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

// Status maintenance untuk bot: per-bot menang atas global; global tidak berlaku kalau rank pemilik dikecualikan.
function forBot(global, bot, ownerRank) {
  if (bot.maintenance_enabled) return { active: true, scope: 'bot', message: bot.maintenance_message || global.message };
  if (global.enabled && !(global.exempt_ranks || []).includes(ownerRank)) return { active: true, scope: 'global', message: global.message };
  return { active: false, scope: null, message: null };
}

module.exports = { get, setGlobal, forBot };
