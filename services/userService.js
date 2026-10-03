'use strict';

const { query } = require('../lib/db');

const DEFAULT_TIER = 'FREE';
const DEFAULT_STATUS = 'active';
const OWNER_TIER = 'OWNER';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isOwnerEmail(email) {
  const configured = normalizeEmail(process.env.OWNER_EMAIL);
  return Boolean(configured && normalizeEmail(email) === configured);
}

function mapUser(row) {
  if (!row) return null;
  const owner = isOwnerEmail(row.email);
  return {
    id: row.id,
    googleId: row.google_id,
    email: row.email,
    name: row.name,
    picture: row.picture || '',
    tier: owner ? OWNER_TIER : (row.tier === OWNER_TIER ? DEFAULT_TIER : (row.tier || DEFAULT_TIER)),
    status: row.status || DEFAULT_STATUS,
    dailyUsage: Number(row.daily_usage || 0),
    lastUsageReset: row.last_usage_reset || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isOwner: owner
  };
}

async function findByGoogleIdOrEmail(googleId, email) {
  const rows = await query(
    `SELECT id, google_id, email, name, picture, tier, status,
            daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason
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
    `SELECT id, google_id, email, name, picture, tier, status,
            daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason
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
        RETURNING id, google_id, email, name, picture, tier, status,
                  daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason`,
      [googleId, email, name, picture, owner, existing.id]
    );
    return mapUser(rows[0]);
  }

  const rows = await query(
    `INSERT INTO users
       (google_id, email, name, picture, tier, status, daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason)
     VALUES ($1, $2, $3, $4, $5, $6, 0, CURRENT_DATE, NOW(), NOW(), NULL, NULL)
     RETURNING id, google_id, email, name, picture, tier, status,
               daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason`,
    [googleId, email, name, picture, owner ? OWNER_TIER : DEFAULT_TIER, DEFAULT_STATUS]
  );
  return mapUser(rows[0]);
}

async function getUserForSession(session) {
  const identity = session?.sub || session?.googleId || '';
  const row = await findByIdOrGoogleId(identity);
  return mapUser(row);
}

async function getUserById(id) {
  const rows = await query(
    `SELECT id, google_id, email, name, picture, tier, status,
            daily_usage, last_usage_reset, created_at, updated_at, banned_at, ban_reason
       FROM users WHERE id = $1 LIMIT 1`,
    [id]
  );
  return mapUser(rows[0]);
}

module.exports = {
  upsertGoogleUser,
  getUserForSession,
  getUserById,
  isOwnerEmail,
  mapUser
};
