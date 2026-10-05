'use strict';
// One-time 6-digit email codes for account verification and password reset.
// Only an HMAC of the code is stored; a code expires after CODE_TTL_MINUTES, allows
// MAX_ATTEMPTS wrong guesses, and is single-use. Sending is throttled per user.
const crypto = require('crypto');
const { query } = require('../lib/db');

const CODE_TTL_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_PER_HOUR = 5;

function codeHash(userId, purpose, code) {
  return crypto.createHmac('sha256', process.env.AUTH_SECRET || '').update(`${userId}:${purpose}:${code}`).digest('hex');
}

// Returns { code } when a new code may be sent, or { throttled: true } when the user asked too
// recently / too often (callers still answer generically so nothing about the account leaks).
async function issueCode(userId, purpose) {
  const recent = (await query(
    `SELECT count(*) FILTER (WHERE created_at > now() - make_interval(secs => $3))::int AS cooldown,
            count(*) FILTER (WHERE created_at > now() - interval '1 hour')::int AS hourly
       FROM auth_codes WHERE user_id = $1 AND purpose = $2`,
    [userId, purpose, RESEND_COOLDOWN_SECONDS]
  ))[0];
  if (recent.cooldown > 0 || recent.hourly >= MAX_PER_HOUR) return { throttled: true };
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  // A new code replaces any older unused one for the same purpose.
  await query('UPDATE auth_codes SET consumed_at = now() WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL', [userId, purpose]);
  await query(
    `INSERT INTO auth_codes(user_id, purpose, code_hash, expires_at) VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
    [userId, purpose, codeHash(userId, purpose, code), CODE_TTL_MINUTES]
  );
  return { code, minutes: CODE_TTL_MINUTES };
}

// Consumes the latest live code if it matches. Wrong guesses count against the code.
async function consumeCode(userId, purpose, code) {
  const value = String(code || '').trim();
  if (!/^\d{6}$/.test(value)) return false;
  const row = (await query(
    `SELECT id, code_hash FROM auth_codes
      WHERE user_id = $1 AND purpose = $2 AND consumed_at IS NULL AND expires_at > now() AND attempts < $3
      ORDER BY created_at DESC LIMIT 1`,
    [userId, purpose, MAX_ATTEMPTS]
  ))[0];
  if (!row) return false;
  const expected = Buffer.from(row.code_hash, 'hex');
  const actual = Buffer.from(codeHash(userId, purpose, value), 'hex');
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    await query('UPDATE auth_codes SET attempts = attempts + 1 WHERE id = $1', [row.id]);
    return false;
  }
  // Single use, even under concurrent submissions of the same code.
  const used = await query('UPDATE auth_codes SET consumed_at = now() WHERE id = $1 AND consumed_at IS NULL RETURNING id', [row.id]);
  return used.length === 1;
}

module.exports = { issueCode, consumeCode, CODE_TTL_MINUTES, MAX_ATTEMPTS, RESEND_COOLDOWN_SECONDS };
