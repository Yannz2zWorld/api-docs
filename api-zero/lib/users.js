'use strict';
const crypto = require('crypto');
const db = require('./db');
const tiers = require('./tiers');
const { hashPassword } = require('./crypto');

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/i;
const err = (code, message, status = 400) => Object.assign(new Error(message), { code, status });

function normPhone(p) {
  let d = String(p || '').replace(/[^\d]/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  return d;
}
function validate({ username, password, email, phone }, { requirePassword = true } = {}) {
  if (!USERNAME_RE.test(username || '')) throw err('INVALID_USERNAME', 'Username 3–20 karakter: huruf kecil, angka, atau _.');
  if (requirePassword && (!password || password.length < 6 || password.length > 100)) throw err('INVALID_PASSWORD', 'Sandi minimal 6 karakter.');
  if (email !== undefined && email !== null && email !== '' && !EMAIL_RE.test(email)) throw err('INVALID_EMAIL', 'Format email tidak valid.');
  if (phone !== undefined && phone !== null && phone !== '' && !/^\d{9,15}$/.test(normPhone(phone))) throw err('INVALID_PHONE', 'Nomor HP tidak valid (9–15 digit).');
}

async function blacklisted(...values) {
  const v = values.filter(Boolean).map(x => String(x).toLowerCase());
  if (!v.length) return false;
  const rows = await db.q('SELECT 1 FROM blacklist WHERE value = ANY($1) LIMIT 1', [v]);
  return rows.length > 0;
}

// ID publik user, mis. ZR-482913
const newPublicId = () => 'ZR-' + String(crypto.randomInt(100000, 1000000));

async function create({ username, password, email, phone, googleSub, tier = 'free', days }) {
  username = String(username || '').toLowerCase().trim();
  email = email ? String(email).toLowerCase().trim() : null;
  phone = phone ? normPhone(phone) : null;
  if (await blacklisted(username, email, phone)) throw err('BLACKLISTED', 'Akun ini diblokir.', 403);
  const expires = tiers.isPaid(tier) ? new Date(Date.now() + (days || tiers.PLAN_DAYS) * 86400000) : null;
  for (let i = 0; i < 5; i++) {
    try {
      return await db.one(`INSERT INTO users (public_id, username, email, phone, password_hash, google_sub, tier, tier_expires_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`, [newPublicId(), username, email, phone, password ? hashPassword(password) : null, googleSub || null, tier, expires]);
    } catch (e) {
      if (e.code !== '23505') throw e;
      if (/username/.test(e.constraint || '')) throw err('USERNAME_TAKEN', 'Username sudah dipakai.', 409);
      if (/email/.test(e.constraint || '')) throw err('EMAIL_TAKEN', 'Email sudah terdaftar.', 409);
      if (/google/.test(e.constraint || '')) throw err('GOOGLE_TAKEN', 'Akun Google sudah terdaftar.', 409);
      // public_id bentrok: coba lagi
    }
  }
  throw err('CREATE_FAILED', 'Gagal membuat akun, coba lagi.', 500);
}

// Aktifkan / perpanjang plan. Plan sama yang masih aktif diperpanjang; plan lain mulai dari sekarang.
async function activatePlan(userId, tierId, days = tiers.PLAN_DAYS, run = db.q) {
  if (!tiers.BY_ID[tierId]) throw err('INVALID_TIER', 'Plan tidak dikenal.');
  if (!tiers.isPaid(tierId)) {
    const [u] = await run('UPDATE users SET tier = $2, tier_expires_at = NULL WHERE id = $1 RETURNING *', [userId, tierId]);
    return u;
  }
  const [u] = await run(`UPDATE users SET
      tier_expires_at = CASE WHEN tier = $2 AND tier_expires_at > now() THEN tier_expires_at ELSE now() END + ($3 || ' days')::interval,
      tier = $2
    WHERE id = $1 RETURNING *`, [userId, tierId, String(Number(days))]);
  return u;
}

module.exports = { create, validate, activatePlan, blacklisted, normPhone, USERNAME_RE, EMAIL_RE, err };
