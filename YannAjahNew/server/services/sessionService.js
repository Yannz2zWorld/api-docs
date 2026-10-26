'use strict';
// Sesi dashboard: token acak di cookie HttpOnly, hanya SHA-256-nya di database. Punya masa berlaku,
// bisa dicabut (logout, ban, hapus akun), dan akun dibaca ulang setiap request.

const { sha256, newToken } = require('../lib/security');

async function create(q, accountId, { provider, ip = null, userAgent = null, hours = 12 }) {
  const token = newToken('yad');
  const expires = new Date(Date.now() + hours * 3600000);
  await q.query('INSERT INTO dashboard_sessions (account_id, token_hash, provider, expires_at, last_seen_at, ip, user_agent) VALUES ($1,$2,$3,$4,now(),$5,$6)',
    [accountId, sha256(token), provider, expires, ip, userAgent ? String(userAgent).slice(0, 300) : null]);
  await q.query('UPDATE accounts SET last_login_at = now() WHERE id = $1', [accountId]);
  return { token, expiresAt: expires };
}

async function resolve(q, token) {
  if (typeof token !== 'string' || !/^yad_[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const s = (await q.query(`SELECT s.id, s.account_id, s.expires_at, s.revoked_at FROM dashboard_sessions s WHERE s.token_hash = $1`, [sha256(token)]))[0];
  if (!s || s.revoked_at || new Date(s.expires_at) <= new Date()) return null;
  // last_seen diperbarui paling sering sekali per menit
  await q.query("UPDATE dashboard_sessions SET last_seen_at = now() WHERE id = $1 AND (last_seen_at IS NULL OR last_seen_at < now() - interval '1 minute')", [s.id]);
  return { id: Number(s.id), accountId: Number(s.account_id) };
}

async function revoke(q, token) {
  if (typeof token !== 'string') return 0;
  return (await q.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL RETURNING id', [sha256(token)])).length;
}

async function revokeAll(q, accountId) {
  return (await q.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING id', [accountId])).length;
}

module.exports = { create, resolve, revoke, revokeAll };
