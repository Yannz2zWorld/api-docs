'use strict';
// API key per user + kuota harian (dihitung per akun, reset tiap 00:00 WIB).
const db = require('./db');
const { seal, unseal, sha256, randomToken } = require('./crypto');
const tiers = require('./tiers');
const { isDev } = require('./auth');

const CUSTOM_RE = /^[A-Za-z0-9_-]{6,40}$/;
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);   // WIB
const limits = user => {
  const t = isDev(user) ? tiers.BY_ID.developer : tiers.effectiveTier(user);
  return { tier: t, daily: t.daily, maxKeys: t.maxKeys, customKey: t.customKey };
};

async function listKeys(userId) {
  const rows = await db.q('SELECT id, key_enc, label, custom, last_used_at, created_at FROM api_keys WHERE user_id = $1 ORDER BY id', [userId]);
  return rows.map(r => ({ id: String(r.id), key: unseal('apikey', r.key_enc), label: r.label, custom: r.custom, lastUsedAt: r.last_used_at, createdAt: r.created_at }));
}

async function createKey(user, { label, custom } = {}) {
  const lim = limits(user);
  const err = (code, message, status = 400) => Object.assign(new Error(message), { code, status });
  const [{ n }] = await db.q('SELECT count(*)::int AS n FROM api_keys WHERE user_id = $1', [user.id]);
  if (n >= lim.maxKeys) throw err('KEY_LIMIT', `Plan ${lim.tier.name} maksimal ${lim.maxKeys} API key. Upgrade plan buat nambah.`, 403);
  let key;
  if (custom) {
    if (!lim.customKey) throw err('CUSTOM_KEY_NOT_ALLOWED', 'Custom API key mulai dari plan Premium.', 403);
    if (!CUSTOM_RE.test(custom)) throw err('INVALID_KEY', 'Custom key 6–40 karakter: huruf, angka, - atau _.');
    key = custom;
  } else key = 'zero-' + randomToken(24);
  try {
    await db.q('INSERT INTO api_keys (user_id, key_hash, key_enc, label, custom) VALUES ($1, $2, $3, $4, $5)', [user.id, sha256(key), seal('apikey', key), String(label || '').slice(0, 40) || null, Boolean(custom)]);
  } catch (e) {
    if (e.code === '23505') throw err('KEY_TAKEN', 'Key itu sudah dipakai, coba yang lain.');
    throw e;
  }
  return key;
}
const deleteKey = (userId, id) => db.q('DELETE FROM api_keys WHERE user_id = $1 AND id = $2 RETURNING id', [userId, id]);

async function userByKey(key) {
  if (!key || key.length > 80) return null;
  const row = await db.one('SELECT k.id AS key_id, u.* FROM api_keys k JOIN users u ON u.id = k.user_id WHERE k.key_hash = $1', [sha256(key)]);
  if (row) db.q('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.key_id]).catch(() => {});
  return row;
}

// Ambil 1 jatah. Mengembalikan { ok, used, limit } (atomic: aman dipanggil paralel).
async function consume(user) {
  const { daily } = limits(user);
  const day = today();
  if (daily === Infinity) {
    const [r] = await db.q('INSERT INTO usage_daily (user_id, day, count) VALUES ($1, $2, 1) ON CONFLICT (user_id, day) DO UPDATE SET count = usage_daily.count + 1 RETURNING count', [user.id, day]);
    return { ok: true, used: r.count, limit: null };
  }
  const rows = await db.q('INSERT INTO usage_daily (user_id, day, count) VALUES ($1, $2, 1) ON CONFLICT (user_id, day) DO UPDATE SET count = usage_daily.count + 1 WHERE usage_daily.count < $3 RETURNING count', [user.id, day, daily]);
  return rows.length ? { ok: true, used: rows[0].count, limit: daily } : { ok: false, used: daily, limit: daily };
}
// Request gagal (error dari server/sumber) tidak memotong kuota.
const refund = user => db.q('UPDATE usage_daily SET count = GREATEST(count - 1, 0) WHERE user_id = $1 AND day = $2', [user.id, today()]).catch(() => {});
async function usageToday(userId) {
  const r = await db.one('SELECT count FROM usage_daily WHERE user_id = $1 AND day = $2', [userId, today()]);
  return r ? r.count : 0;
}

module.exports = { listKeys, createKey, deleteKey, userByKey, consume, refund, usageToday, limits, today };
