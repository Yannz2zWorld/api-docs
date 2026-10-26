'use strict';
// Audit log append-only. Detail disaring: key yang mirip secret tidak pernah ditulis.

const SECRET_KEY = /(password|passwd|token|secret|cookie|api[-_]?key|apikey|otp|pairing|credential|hash|session_ref)/i;

function sanitize(value, depth = 0) {
  if (value == null || typeof value !== 'object') return typeof value === 'string' ? value.slice(0, 500) : value;
  if (depth > 4) return '[…]';
  if (Array.isArray(value)) return value.slice(0, 50).map(v => sanitize(v, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(value)) if (!SECRET_KEY.test(k)) out[k] = sanitize(v, depth + 1);
  return out;
}

async function write(q, { actorType = 'account', actorId = null, action, targetType = null, targetId = null, details = {}, ip = null }) {
  await q.query(
    'INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, details, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [actorType, actorId, action, targetType, targetId, JSON.stringify(sanitize(details)), ip]
  );
}

// Daftar audit sesuai cakupan: audit.view_all = semua; audit.view = aksi oleh / terhadap akun & bot dalam pohon sendiri.
async function list(db, actor, { limit = 50, before = null, action = null } = {}) {
  const params = [limit];
  const where = [];
  if (before) { params.push(before); where.push(`l.id < $${params.length}`); }
  if (action) { params.push(action + '%'); where.push(`l.action LIKE $${params.length}`); }
  if (!actor.perms.has('audit.view_all')) {
    params.push(actor.id);
    const me = `$${params.length}`;
    where.push(`(
      (l.actor_type = 'account' AND (l.actor_id = ${me} OR l.actor_id IN (SELECT id FROM scope)))
      OR (l.target_type = 'account' AND l.target_id IN (SELECT id FROM scope))
      OR (l.target_type = 'bot' AND l.target_id IN (SELECT b.id FROM bots b WHERE b.owner_id = ${me} OR b.owner_id IN (SELECT id FROM scope))))`);
    const sql = `WITH RECURSIVE scope AS (
        SELECT id FROM accounts WHERE manager_id = ${me}
        UNION SELECT a.id FROM accounts a JOIN scope s ON a.manager_id = s.id)
      SELECT l.id, l.actor_type, l.actor_id, a.username AS actor_username, l.action, l.target_type, l.target_id, l.details, l.created_at
      FROM audit_logs l LEFT JOIN accounts a ON l.actor_type = 'account' AND a.id = l.actor_id
      WHERE ${where.join(' AND ')} ORDER BY l.id DESC LIMIT $1`;
    return db.query(sql, params);
  }
  const sql = `SELECT l.id, l.actor_type, l.actor_id, a.username AS actor_username, l.action, l.target_type, l.target_id, l.details, l.ip, l.created_at
    FROM audit_logs l LEFT JOIN accounts a ON l.actor_type = 'account' AND a.id = l.actor_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY l.id DESC LIMIT $1`;
  return db.query(sql, params);
}

module.exports = { write, list, sanitize };
