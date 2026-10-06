'use strict';
const crypto = require('crypto');
const { query, transaction } = require('../lib/db');
const { getTier } = require('./tierService');
const { digest } = require('../lib/keyCrypto');

// User-chosen key values ("custom keys", e.g. "Yannz2z"): letters, digits, '_' and '-'.
// They are stored as a SHA-256 digest like generated keys, so they must be unique across
// all users; the generated-key prefix is reserved.
const CUSTOM_KEY_RE = /^[A-Za-z0-9_-]{6,64}$/;
const GENERATED_PREFIX = 'yannz_live_';
// Guessing protection: this many invalid keys from one IP within 15 minutes blocks key
// authentication from that IP until the window ends.
const INVALID_KEY_LIMIT = () => Number(process.env.INVALID_KEY_LIMIT_PER_15MIN) || 30;

function customKeyProblem(value) {
  if (!CUSTOM_KEY_RE.test(value)) return 'Custom key harus 6–64 karakter: huruf, angka, _ atau -.';
  if (value.toLowerCase().startsWith(GENERATED_PREFIX)) return `Awalan "${GENERATED_PREFIX}" khusus untuk key otomatis.`;
  return null;
}

// What the UI may show of a key: generated keys keep their non-secret prefix; custom keys
// show only their first characters, since they are short.
function displayPrefix(plain, custom) {
  return custom ? plain.slice(0, Math.min(3, plain.length - 3)) : plain.slice(0, 19);
}

async function createKey(user, name, idempotencyKey = null, customValue = null) {
  const cap = getTier(user.tier).keys;
  if (cap === 0) throw Object.assign(new Error('Tier ini belum mendapat kuota API key.'), { code: 'KEYS_NOT_INCLUDED' });
  const custom = customValue !== null && customValue !== undefined && customValue !== '';
  const plain = custom ? String(customValue) : GENERATED_PREFIX + crypto.randomBytes(32).toString('base64url');
  if (custom) {
    const problem = customKeyProblem(plain);
    if (problem) throw Object.assign(new Error(problem), { code: 'INVALID_CUSTOM_KEY' });
  }
  // The per-user advisory lock is taken in its own statement, so the INSERT's count (a new
  // READ COMMITTED snapshot) sees keys committed by concurrent requests: the cap cannot be overrun.
  let saved;
  try {
    [, , saved] = await transaction([
      { text: 'SELECT pg_advisory_xact_lock(hashtext($1::text))', params: [String(user.id)] },
      // Custom values are global: serialize on the value too (in case the unique index is missing).
      { text: 'SELECT pg_advisory_xact_lock(hashtext($1::text))', params: [custom ? 'key:' + digest(plain) : 'key:none'] },
      {
        text: `INSERT INTO api_keys(user_id,name,key_hash,key_prefix,idempotency_key${custom ? ',custom' : ''})
          SELECT $1::uuid,$2::text,$3::text,$4::text,$5::text${custom ? ',true' : ''}
           WHERE ($6::boolean OR (SELECT count(*) FROM api_keys WHERE user_id=$1::uuid AND status='active')<$7::int)
             AND NOT EXISTS (SELECT 1 FROM api_keys WHERE key_hash=$3::text)
          ON CONFLICT(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
          RETURNING id,name,key_prefix,status,created_at,last_used_at${custom ? ',custom' : ''}`,
        params: [user.id, String(name || 'My API Key').trim().slice(0, 80) || 'My API Key', digest(plain), displayPrefix(plain, custom), idempotencyKey, !Number.isFinite(cap), Number.isFinite(cap) ? cap : 0]
      }
    ]);
  } catch (e) {
    // api_keys_key_hash_uidx: this exact value is already some key (active or revoked).
    if (e.code === '23505' && custom) throw Object.assign(new Error('Custom key ini sudah dipakai. Pilih value lain.'), { code: 'CUSTOM_KEY_TAKEN' });
    throw e;
  }
  if (!saved.length) {
    if (idempotencyKey) {
      const prior = await query('SELECT id FROM api_keys WHERE user_id=$1 AND idempotency_key=$2', [user.id, idempotencyKey]);
      if (prior.length) throw Object.assign(new Error('Permintaan key ini sudah diproses. Muat ulang daftar key; secret hanya ditampilkan saat pertama dibuat.'), { code: 'IDEMPOTENCY_REPLAY' });
    }
    if (custom && (await query('SELECT 1 FROM api_keys WHERE key_hash=$1', [digest(plain)])).length) {
      throw Object.assign(new Error('Custom key ini sudah dipakai. Pilih value lain.'), { code: 'CUSTOM_KEY_TAKEN' });
    }
    throw Object.assign(new Error('Batas API key tier kamu tercapai.'), { code: 'KEY_LIMIT' });
  }
  return { key: plain, record: { custom, ...saved[0] } };
}

async function listKeys(userId) {
  return query(
    `SELECT id,name,key_prefix,status,created_at,last_used_at,revoked_at,
            COALESCE((to_jsonb(api_keys.*) ->> 'custom')::boolean,false) AS custom
       FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC`,
    [userId]
  );
}

async function revokeKey(userId, id) {
  const r = await query("UPDATE api_keys SET status='revoked',revoked_at=now() WHERE id=$1 AND user_id=$2 AND status='active' RETURNING id", [id, userId]);
  return !!r.length;
}

const BUCKET = "date_bin('15 minutes', now(), timestamptz '2000-01-01')";
let failureTable = true; // false until migration 007 creates api_key_failures

// One round trip: the key's owner and effective tier, plus how many invalid keys this IP
// sent in the current window. An expired paid tier is FREE; a stored OWNER without
// OWNER_EMAIL is FREE.
async function findKey(plain, ip = null) {
  if (!plain) return null;
  const sql = withFailures => `SELECT k.id AS key_id,k.user_id,k.status AS key_status,u.email,
      CASE WHEN lower(u.email)=lower($2) THEN 'OWNER'
           WHEN u.tier='OWNER' THEN 'FREE'
           WHEN (to_jsonb(u.*) ->> 'tier_expires_at')::timestamptz <= now() THEN 'FREE'
           ELSE u.tier END AS tier,
      u.status AS user_status,u.id AS uid${withFailures ? `,(SELECT count FROM api_key_failures WHERE ip=$3 AND bucket=${BUCKET}) AS ip_failures` : ''}
    FROM (SELECT 1) one
    LEFT JOIN api_keys k ON k.key_hash=$1
    LEFT JOIN users u ON u.id=k.user_id`;
  let rows;
  try {
    rows = await query(sql(failureTable), failureTable ? [digest(plain), process.env.OWNER_EMAIL || '', String(ip || '')] : [digest(plain), process.env.OWNER_EMAIL || '']);
  } catch (e) {
    if (e.code !== '42P01' || !failureTable) throw e;
    failureTable = false;
    rows = await query(sql(false), [digest(plain), process.env.OWNER_EMAIL || '']);
  }
  const row = rows[0] || {};
  if (Number(row.ip_failures || 0) >= INVALID_KEY_LIMIT()) return { throttled: true };
  return row.key_id ? row : null;
}

async function recordInvalidKey(ip) {
  if (!failureTable || !ip) return;
  await query(
    `INSERT INTO api_key_failures(ip,bucket,count) VALUES($1,${BUCKET},1)
     ON CONFLICT(ip,bucket) DO UPDATE SET count=api_key_failures.count+1`,
    [String(ip)]
  ).catch(e => { if (e.code === '42P01') failureTable = false; });
  // Old windows are useless; trim them occasionally.
  if (Math.random() < 0.02) await query("DELETE FROM api_key_failures WHERE bucket < now() - interval '1 day'").catch(() => {});
}

module.exports = { createKey, listKeys, revokeKey, findKey, recordInvalidKey, customKeyProblem, digest, CUSTOM_KEY_RE };
