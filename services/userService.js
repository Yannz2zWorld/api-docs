'use strict';

const { query } = require('../lib/db');

const DEFAULT_TIER = 'FREE';
const DEFAULT_STATUS = 'active';
const OWNER_TIER = 'OWNER';
// tier_expires_at is read through to_jsonb so these queries keep working on a database
// that has not run migration 007 yet (the value is then simply NULL = no expiry).
const USER_COLUMNS = `id, google_id, email, name, picture, tier, status,
            daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason, session_version,
            (to_jsonb(users.*) ->> 'tier_expires_at')::timestamptz AS tier_expires_at`;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isOwnerEmail(email) {
  const configured = normalizeEmail(process.env.OWNER_EMAIL);
  return Boolean(configured && normalizeEmail(email) === configured);
}

// A purchased tier past its expiry counts as FREE; a stored 'OWNER' without OWNER_EMAIL too.
function effectiveTier(row, owner = isOwnerEmail(row?.email)) {
  if (owner) return OWNER_TIER;
  if (!row?.tier || row.tier === OWNER_TIER) return DEFAULT_TIER;
  if (row.tier_expires_at && new Date(row.tier_expires_at) <= new Date()) return DEFAULT_TIER;
  return row.tier;
}

function mapUser(row) {
  if (!row) return null;
  const owner = isOwnerEmail(row.email);
  const tier = effectiveTier(row, owner);
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture || '',
    tier,
    tierExpiresAt: !owner && tier !== DEFAULT_TIER && row.tier_expires_at ? new Date(row.tier_expires_at).toISOString() : null,
    status: row.status || DEFAULT_STATUS,
    dailyUsage: Number(row.daily_usage || 0),
    sessionVersion: Number(row.session_version || 0),
    lastUsageReset: row.last_usage_reset || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner: owner
  };
}

async function findByGoogleIdOrEmail(googleId, email) {
  const rows = await query(
    `SELECT ${USER_COLUMNS}
       FROM users
      WHERE google_id = $1 OR lower(email) = lower($2)
      ORDER BY CASE WHEN google_id = $1 THEN 0 ELSE 1 END
      LIMIT 1`,
    [String(googleId), normalizeEmail(email)]
  );
  return rows[0] || null;
}

async function findByIdOrGoogleId(identity) {
  const value = String(identity || '');
  const rows = await query(
    `SELECT ${USER_COLUMNS}
       FROM users
      WHERE google_id = $1 OR id::text = $1
      LIMIT 1`,
    [value]
  );
  return rows[0] || null;
}

async function upsertGoogleUser(profile) {
  const googleId = String(profile.googleId || profile.sub || '').trim();
  const email = normalizeEmail(profile.email);
  const name = String(profile.name || email.split('@')[0]).trim();
  const picture = String(profile.picture || '').trim();

  if (!googleId || !email) {
    const error = new Error('Identitas Google tidak lengkap.');
    error.code = 'INVALID_GOOGLE_PROFILE';
    throw error;
  }

  const existing = await findByGoogleIdOrEmail(googleId, email);
  const owner = isOwnerEmail(email);

  if (existing) {
    const rows = await query(
      `UPDATE users
          SET google_id = $1,
              email = $2,
              name = $3,
              picture = $4,
              tier = CASE WHEN $5 THEN 'OWNER' ELSE COALESCE(NULLIF(tier, ''), 'FREE') END,
              updated_at = NOW()
        WHERE id = $6
        RETURNING ${USER_COLUMNS}`,
      [googleId, email, name, picture, owner, existing.id]
    );
    return mapUser(rows[0]);
  }

  let rows;
  try {
    rows = await query(
      `INSERT INTO users
         (google_id, email, name, picture, tier, status, daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason)
       VALUES ($1, $2, $3, $4, $5, $6, 0, CURRENT_DATE, NOW(), NOW(), NULL, NULL)
       RETURNING ${USER_COLUMNS}`,
      [googleId, email, name, picture, owner ? OWNER_TIER : DEFAULT_TIER, DEFAULT_STATUS]
    );
  } catch (error) {
    // Two concurrent first logins: the other request inserted the row; update it instead.
    if (error.code === '23505' && !profile.retried) return upsertGoogleUser({ ...profile, retried: true });
    throw error;
  }
  return mapUser(rows[0]);
}

async function getUserForSession(session) {
  const identity = session?.sub || session?.googleId || '';
  const row = await findByIdOrGoogleId(identity);
  // A cookie issued before the last logout/ban carries an older version and is rejected.
  if (row && Number(session?.sv || 0) !== Number(row.session_version || 0)) return null;
  return mapUser(row);
}

async function revokeSessions(userId) {
  await query('UPDATE users SET session_version = session_version + 1, updated_at = NOW() WHERE id = $1', [userId]);
}

async function getUserById(id) {
  const rows = await query(
    `SELECT ${USER_COLUMNS}
       FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return mapUser(rows[0]);
}

// ---------------------------------------------------------------- email + password accounts
const AUTH_COLUMNS = "id, google_id, email, name, picture, tier, status, session_version, password_hash, email_verified, failed_login_count, locked_until, (to_jsonb(users.*) ->> 'tier_expires_at')::timestamptz AS tier_expires_at";

async function findAuthByEmail(email) {
  const rows = await query(`SELECT ${AUTH_COLUMNS} FROM users WHERE lower(email) = lower($1) LIMIT 1`, [normalizeEmail(email)]);
  return rows[0] || null;
}

async function createPasswordUser({ name, email, passwordHash }) {
  const normalized = normalizeEmail(email);
  const rows = await query(
    `INSERT INTO users (google_id, email, name, picture, tier, status, password_hash, password_updated_at, email_verified, created_at, updated_at)
     VALUES (NULL, $1, $2, '', $3, $4, $5, NOW(), false, NOW(), NOW())
     RETURNING ${AUTH_COLUMNS}`,
    [normalized, String(name).trim(), isOwnerEmail(normalized) ? OWNER_TIER : DEFAULT_TIER, DEFAULT_STATUS, passwordHash]
  );
  return rows[0];
}

async function markEmailVerified(userId) {
  await query('UPDATE users SET email_verified = true, updated_at = NOW() WHERE id = $1', [userId]);
}

// New password: proves inbox ownership (code), clears lockout and signs out every other session.
async function setPassword(userId, passwordHash) {
  const rows = await query(
    `UPDATE users SET password_hash = $2, password_updated_at = NOW(), email_verified = true,
            failed_login_count = 0, locked_until = NULL, session_version = session_version + 1, updated_at = NOW()
      WHERE id = $1 RETURNING ${AUTH_COLUMNS}`,
    [userId, passwordHash]
  );
  return rows[0] || null;
}

const MAX_FAILED_LOGINS = 10;
const LOCK_MINUTES = 15;
async function recordFailedLogin(userId) {
  await query(
    `UPDATE users SET
        locked_until = CASE WHEN failed_login_count + 1 >= $2 THEN NOW() + make_interval(mins => $3) ELSE locked_until END,
        failed_login_count = CASE WHEN failed_login_count + 1 >= $2 THEN 0 ELSE failed_login_count + 1 END
      WHERE id = $1`,
    [userId, MAX_FAILED_LOGINS, LOCK_MINUTES]
  );
}
async function clearFailedLogins(userId) {
  await query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1 AND (failed_login_count <> 0 OR locked_until IS NOT NULL)', [userId]);
}

// Google proved the email. If the account was created with a password that was never verified,
// someone else may have pre-registered this address: drop that password and its sessions.
async function secureGoogleLink(userId) {
  try {
    const rows = await query(
      `UPDATE users SET
          password_hash = CASE WHEN email_verified THEN password_hash ELSE NULL END,
          session_version = CASE WHEN NOT email_verified AND password_hash IS NOT NULL THEN session_version + 1 ELSE session_version END,
          email_verified = true, updated_at = NOW()
        WHERE id = $1 AND email_verified = false
        RETURNING session_version`,
      [userId]
    );
    return rows[0] ? Number(rows[0].session_version) : null;
  } catch (error) {
    // Before migration 006 there are no password accounts, so there is nothing to secure.
    if (error.code === '42703') return null;
    throw error;
  }
}

module.exports = {
  findAuthByEmail,
  createPasswordUser,
  markEmailVerified,
  setPassword,
  recordFailedLogin,
  clearFailedLogins,
  secureGoogleLink,
  MAX_FAILED_LOGINS,
  upsertGoogleUser,
  getUserForSession,
  getUserById,
  revokeSessions,
  isOwnerEmail,
  mapUser
};
