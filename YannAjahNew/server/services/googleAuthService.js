'use strict';
// Login Google (OIDC). ID token diverifikasi di backend (signature, audience, issuer, expiry oleh
// google-auth-library) + nonce + email_verified. Aturan penautan akun yang eksplisit:
//   1. google_sub sudah tertaut ke akun -> akun itu (ditolak kalau dihapus/tidak aktif).
//   2. Belum tertaut, ada akun (belum dihapus, google_sub kosong) dengan email SAMA yang dibuat admin/CLI
//      -> ditautkan, karena Google menjamin email terverifikasi. Dicatat di audit.
//   3. Tidak ada -> akun baru rank MEMBER (rank paling aman, kuota 0), kalau pendaftaran terbuka.
// Rank tinggi tidak pernah diberikan otomatis. DEVELOPER hanya lewat CLI.

const crypto = require('crypto');
const { forbidden } = require('../lib/errors');
const audit = require('./auditService');

function usernameFrom(email) {
  const base = String(email).split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '').replace(/^[^a-z0-9]+/, '').slice(0, 20) || 'user';
  return `${base.length >= 3 ? base : base + 'usr'}-${crypto.randomBytes(3).toString('hex')}`;
}

async function signIn(db, profile, { openSignup = true, ip = null } = {}) {
  if (!profile?.sub || !profile.email || profile.email_verified !== true) throw forbidden('EMAIL_NOT_VERIFIED', 'Akun Google harus punya email terverifikasi.');
  const email = String(profile.email).toLowerCase();
  const name = String(profile.name || '').slice(0, 80);
  return db.withTransaction(async tx => {
    let acc = (await tx.query('SELECT id, status, deleted_at FROM accounts WHERE google_sub = $1 FOR UPDATE', [profile.sub]))[0];
    if (acc) {
      if (acc.deleted_at) throw forbidden('ACCOUNT_DELETED', 'Akun ini sudah dihapus. Hubungi admin.');
      if (acc.status !== 'active') {
        await audit.write(tx, { actorType: 'account', actorId: Number(acc.id), action: 'auth.login_denied', targetType: 'account', targetId: Number(acc.id), details: { reason: acc.status, provider: 'google' }, ip });
        throw forbidden('ACCOUNT_RESTRICTED', 'Akun kamu sedang tidak aktif.');
      }
      // Email Google berubah: ikut diperbarui, kecuali email itu sudah dipakai akun lain.
      await tx.query(`UPDATE accounts SET email = $2, email_verified = true, updated_at = now()
        WHERE id = $1 AND (email IS DISTINCT FROM $2 OR NOT email_verified)
          AND NOT EXISTS (SELECT 1 FROM accounts x WHERE x.email = $2 AND x.id <> $1 AND x.deleted_at IS NULL)`, [acc.id, email]);
      return { accountId: Number(acc.id), created: false, linked: false };
    }
    acc = (await tx.query('SELECT id, status FROM accounts WHERE email = $1 AND deleted_at IS NULL AND google_sub IS NULL FOR UPDATE', [email]))[0];
    if (acc) {
      if (acc.status !== 'active') throw forbidden('ACCOUNT_RESTRICTED', 'Akun kamu sedang tidak aktif.');
      await tx.query('UPDATE accounts SET google_sub = $2, email_verified = true, display_name = CASE WHEN display_name = \'\' THEN $3 ELSE display_name END, updated_at = now() WHERE id = $1', [acc.id, profile.sub, name]);
      await audit.write(tx, { actorType: 'account', actorId: Number(acc.id), action: 'auth.google_linked', targetType: 'account', targetId: Number(acc.id), details: { email }, ip });
      return { accountId: Number(acc.id), created: false, linked: true };
    }
    if (!openSignup) throw forbidden('SIGNUP_CLOSED', 'Pendaftaran ditutup. Minta admin membuatkan akun untuk email kamu.');
    const row = (await tx.query(`INSERT INTO accounts (username, display_name, email, email_verified, google_sub, rank_code)
      VALUES ($1,$2,$3,true,$4,'MEMBER') RETURNING id`, [usernameFrom(email), name, email, profile.sub]))[0];
    await audit.write(tx, { actorType: 'account', actorId: Number(row.id), action: 'auth.signup', targetType: 'account', targetId: Number(row.id), details: { provider: 'google', rank: 'MEMBER' }, ip });
    return { accountId: Number(row.id), created: true, linked: false };
  });
}

module.exports = { signIn, usernameFrom };
