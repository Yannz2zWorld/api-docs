'use strict';
// Link login sekali pakai, HANYA dibuat lewat CLI di server (butuh akses shell = prosedur administratif).
// Dipakai untuk bootstrap sebelum Google OAuth disetel atau akses darurat. Berlaku 15 menit, sekali pakai.

const { sha256, newToken } = require('../lib/security');
const audit = require('./auditService');

async function create(db, accountId, { minutes = 15 } = {}) {
  const token = newToken('yal');
  await db.withTransaction(async tx => {
    await tx.query("INSERT INTO login_links (account_id, token_hash, expires_at) VALUES ($1,$2, now() + make_interval(mins => $3::int))", [accountId, sha256(token), minutes]);
    await audit.write(tx, { actorType: 'cli', action: 'auth.login_link_created', targetType: 'account', targetId: accountId, details: { minutes } });
  });
  return token;
}

// Mengembalikan account_id kalau link valid; link langsung ditandai terpakai (atomik).
async function consume(db, token, { ip = null } = {}) {
  if (typeof token !== 'string' || !/^yal_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  return db.withTransaction(async tx => {
    const row = (await tx.query(`UPDATE login_links SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now()
      RETURNING account_id`, [sha256(token)]))[0];
    if (!row) return null;
    await audit.write(tx, { actorType: 'account', actorId: Number(row.account_id), action: 'auth.login_link_used', targetType: 'account', targetId: Number(row.account_id), ip });
    return Number(row.account_id);
  });
}

module.exports = { create, consume };
