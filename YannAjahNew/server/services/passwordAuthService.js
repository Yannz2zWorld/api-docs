'use strict';
// Login website dengan email + password, reset password oleh atasan, dan ganti password sendiri.
// - Hanya rank RESELLER ke atas yang boleh masuk website (MEMBER = pemakai bot saja).
//   Penolakan rank baru diberikan SETELAH password terbukti benar, supaya tidak bisa dipakai
//   untuk menebak email mana yang terdaftar.
// - Pesan gagal selalu sama ("Email atau password salah"), termasuk untuk email tidak terdaftar
//   (bcrypt tetap dijalankan dengan hash palsu agar waktu responsnya sama).
// - Brute force: batas kegagalan per email (hash) dan per IP di login_attempts + kunci akun sementara.

const { sha256, hashPassword, verifyPassword } = require('../lib/security');
const { HttpError, unauthorized, forbidden, tooMany } = require('../lib/errors');
const v = require('../lib/validate');
const access = require('./accessControl');
const audit = require('./auditService');

const DEFAULTS = { maxFailuresPerEmail: 5, maxFailuresPerIp: 30, failureWindowMinutes: 15, lockMinutes: 15 };
const WEB_MIN_RANK = 'RESELLER';
const GENERIC = () => unauthorized('INVALID_CREDENTIALS', 'Email atau password salah.');
const identHash = email => sha256('dashboard:' + email);

async function recordAttempt(q, { hash, success, reason, ip }) {
  await q.query("INSERT INTO login_attempts (kind, identifier_hash, success, reason, ip) VALUES ('dashboard', $1, $2, $3, $4)", [hash, success, reason, ip]);
}

async function tooManyFailures(q, hash, ip, opt) {
  const r = (await q.query(`SELECT
      count(*) FILTER (WHERE identifier_hash = $1)::int AS by_ident,
      count(*) FILTER (WHERE ip = $2)::int AS by_ip
    FROM login_attempts WHERE kind = 'dashboard' AND success = false AND created_at > now() - make_interval(mins => $3::int)
      AND (identifier_hash = $1 OR ip = $2)`, [hash, ip, opt.failureWindowMinutes]))[0];
  return r.by_ident >= opt.maxFailuresPerEmail || (ip && r.by_ip >= opt.maxFailuresPerIp);
}

// Boleh masuk website? (aktor sudah dimuat ulang dari database)
async function assertWebAccess(q, actor) {
  if (!actor || actor.status !== 'active') throw forbidden('ACCOUNT_RESTRICTED', 'Akun kamu sedang tidak aktif. Hubungi atasanmu.');
  const ranks = await access.loadRanks(q);
  if (actor.level < ranks.get(WEB_MIN_RANK).level) throw forbidden('WEB_ACCESS_DENIED', 'Akun MEMBER tidak punya akses website. Website khusus reseller ke atas.');
}

async function login(db, input, { ip = null, options = {} } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const email = String(input.email || '').trim().toLowerCase().slice(0, 254);
  const password = typeof input.password === 'string' ? input.password.slice(0, 128) : '';
  const hash = identHash(email);
  if (await tooManyFailures(db, hash, ip, opt)) {
    await recordAttempt(db, { hash, success: false, reason: 'RATE_LIMITED', ip });
    throw tooMany('TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan login. Coba lagi 15 menit lagi.');
  }
  const row = email ? (await db.query('SELECT id, password_hash, locked_until FROM accounts WHERE email = $1 AND deleted_at IS NULL', [email]))[0] : null;
  const locked = row?.locked_until && new Date(row.locked_until) > new Date();
  const ok = (await verifyPassword(password, row?.password_hash || null)) && !locked;
  if (!ok) {
    await db.withTransaction(async tx => {
      await recordAttempt(tx, { hash, success: false, reason: locked ? 'LOCKED' : 'INVALID_CREDENTIALS', ip });
      if (row?.password_hash && !locked) {
        await tx.query(`UPDATE accounts SET failed_logins = failed_logins + 1,
          locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3::int) ELSE locked_until END WHERE id = $1`,
        [row.id, opt.maxFailuresPerEmail, opt.lockMinutes]);
      }
    });
    throw GENERIC();
  }
  const accountId = Number(row.id);
  const actor = await access.loadActor(db, accountId);
  try { await assertWebAccess(db, actor); }
  catch (e) { await recordAttempt(db, { hash, success: false, reason: e.code, ip }); throw e; }
  await db.query('UPDATE accounts SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1', [accountId]);
  await recordAttempt(db, { hash, success: true, reason: null, ip });
  return { accountId };
}

// Atasan mengatur/reset password akun di bawahnya (atau DEVELOPER untuk siapa pun di bawah rank-nya).
async function setPassword(db, actor, targetId, password, { ip = null, bcryptCost = 12 } = {}) {
  access.require(actor, 'user.update');
  const pw = v.accountPassword(password);
  return db.withTransaction(async tx => {
    const target = await access.getAccountRow(tx, targetId, { lock: true });
    await access.assertCanManage(tx, actor, target);
    await tx.query('UPDATE accounts SET password_hash = $2, password_changed_at = now(), failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1', [targetId, await hashPassword(pw, bcryptCost)]);
    const n = (await tx.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING id', [targetId])).length;
    await audit.write(tx, { actorId: actor.id, action: 'account.password.reset', targetType: 'account', targetId, details: { revoked_sessions: n }, ip });
    return { success: true, revoked_sessions: n };
  });
}

// Ganti password sendiri: wajib password lama (kalau sudah punya). Sesi lain dicabut, sesi ini tetap.
async function changeOwn(db, actor, { current_password: current, new_password: next }, { ip = null, bcryptCost = 12, keepSessionHash = null } = {}) {
  const pw = v.accountPassword(next);
  const row = (await db.query('SELECT password_hash FROM accounts WHERE id = $1', [actor.id]))[0];
  if (row.password_hash && !(await verifyPassword(String(current || '').slice(0, 128), row.password_hash))) throw new HttpError(400, 'WRONG_PASSWORD', 'Password lama salah.');
  return db.withTransaction(async tx => {
    await tx.query('UPDATE accounts SET password_hash = $2, password_changed_at = now(), failed_logins = 0, locked_until = NULL, updated_at = now() WHERE id = $1', [actor.id, await hashPassword(pw, bcryptCost)]);
    const n = (await tx.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL AND token_hash IS DISTINCT FROM $2 RETURNING id', [actor.id, keepSessionHash])).length;
    await audit.write(tx, { actorId: actor.id, action: 'account.password.change', targetType: 'account', targetId: actor.id, details: { revoked_other_sessions: n }, ip });
    return { success: true };
  });
}

module.exports = { login, setPassword, changeOwn, assertWebAccess, WEB_MIN_RANK };
