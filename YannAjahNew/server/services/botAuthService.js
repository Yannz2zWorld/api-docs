'use strict';
// Autentikasi proses bot: nomor bot terdaftar + password bot -> token sesi (hanya hash yang disimpan).
// - Pesan gagal TIDAK membedakan "nomor tidak terdaftar" vs "password salah" vs "password belum diset".
// - Waktu respons disamakan (bcrypt terhadap hash dummy kalau nomor tidak ada).
// - Brute force: batas kegagalan per nomor (hash) dan per IP di tabel login_attempts + lock kredensial.
// - Status akun pemilik/pemakai dan status bot dicek SETELAH password benar (tidak membocorkan apa-apa ke penebak).
// - Satu sesi WhatsApp tidak dipakai dua proses: lease berbasis heartbeat per instance_id.

const { sha256, newToken, verifyPassword } = require('../lib/security');
const { HttpError, unauthorized, tooMany, badRequest } = require('../lib/errors');
const v = require('../lib/validate');
const audit = require('./auditService');
const maintenance = require('./maintenanceService');

const DEFAULTS = {
  sessionDays: 30,
  maxFailuresPerNumber: 5,
  maxFailuresPerIp: 30,
  failureWindowMinutes: 15,
  lockMinutes: 15,
  leaseSeconds: 180          // instance lain dianggap masih hidup kalau heartbeat < 3 menit lalu
};

const GENERIC = () => unauthorized('INVALID_CREDENTIALS', 'Nomor atau password salah.');
const identHash = phone => sha256('bot:' + phone);

async function recordAttempt(q, { phoneHash, success, reason, ip }) {
  await q.query('INSERT INTO login_attempts (kind, identifier_hash, success, reason, ip) VALUES ($1,$2,$3,$4,$5)', ['bot', phoneHash, success, reason, ip]);
}

async function tooManyFailures(q, phoneHash, ip, opt) {
  const rows = await q.query(`SELECT
      count(*) FILTER (WHERE identifier_hash = $1)::int AS by_ident,
      count(*) FILTER (WHERE ip = $2)::int AS by_ip
    FROM login_attempts WHERE kind = 'bot' AND success = false AND created_at > now() - make_interval(mins => $3::int)
      AND (identifier_hash = $1 OR ip = $2)`, [phoneHash, ip, opt.failureWindowMinutes]);
  return rows[0].by_ident >= opt.maxFailuresPerNumber || (ip && rows[0].by_ip >= opt.maxFailuresPerIp);
}

function validInstanceId(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9_-]{16,64}$/.test(s)) throw badRequest('INVALID_INSTANCE', 'instance_id tidak valid.');
  return s;
}

// Keadaan bot yang dipakai login/verify/heartbeat. allowed=false => bot wajib berhenti memakai fitur.
async function botState(q, botId) {
  const r = (await q.query(`SELECT b.id, b.bot_name, b.phone_number, b.enabled, b.banned, b.ban_reason, b.disabled_reason, b.deleted_at,
      b.maintenance_enabled, b.maintenance_message, o.status AS owner_status, o.rank_code AS owner_rank, o.deleted_at AS owner_deleted,
      u.status AS user_status, u.deleted_at AS user_deleted
    FROM bots b JOIN accounts o ON o.id = b.owner_id LEFT JOIN accounts u ON u.id = b.user_account_id WHERE b.id = $1`, [botId]))[0];
  if (!r) return { allowed: false, reasons: ['BOT_NOT_FOUND'] };
  const reasons = [];
  if (r.deleted_at) reasons.push('BOT_DELETED');
  if (r.banned) reasons.push('BOT_BANNED');
  if (!r.enabled) reasons.push('BOT_DISABLED');
  if (r.owner_deleted || r.owner_status !== 'active') reasons.push('OWNER_RESTRICTED');
  if (r.user_status && (r.user_deleted || r.user_status !== 'active')) reasons.push('USER_RESTRICTED');
  const global = await maintenance.get(q);
  return {
    allowed: reasons.length === 0,
    reasons,
    bot: { id: Number(r.id), name: r.bot_name, phone_number: r.phone_number },
    ban_reason: r.banned ? r.ban_reason : null,
    disabled_reason: !r.enabled ? r.disabled_reason : null,
    maintenance: maintenance.forBot(global, r, r.owner_rank)
  };
}

const REASON_MESSAGES = {
  BOT_BANNED: 'Bot ini sedang diban.',
  BOT_DISABLED: 'Bot ini sedang dinonaktifkan.',
  BOT_DELETED: 'Bot ini sudah dihapus.',
  OWNER_RESTRICTED: 'Akun pemilik bot sedang tidak aktif.',
  USER_RESTRICTED: 'Akun pemakai bot sedang tidak aktif.'
};

async function login(db, input, { ip = null, options = {} } = {}) {
  const opt = { ...DEFAULTS, ...options };
  const instanceId = validInstanceId(input.instance_id);
  const instanceName = input.instance_name == null ? null : v.str(input.instance_name, { field: 'instance_name', max: 48, pattern: /^[a-zA-Z0-9._-]+$/ });
  const version = input.version == null ? null : v.str(String(input.version), { field: 'version', max: 40 });
  const password = typeof input.password === 'string' ? input.password : '';
  const phone = v.normalizePhone(input.phone_number);
  const phoneHash = identHash(phone || String(input.phone_number || '').slice(0, 40));

  if (await tooManyFailures(db, phoneHash, ip, opt)) {
    await recordAttempt(db, { phoneHash, success: false, reason: 'RATE_LIMITED', ip });
    throw tooMany('TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan login. Coba lagi nanti.');
  }

  const row = phone ? (await db.query(`SELECT b.id, c.password_hash, c.locked_until FROM bots b LEFT JOIN bot_credentials c ON c.bot_id = b.id
    WHERE b.phone_number = $1 AND b.deleted_at IS NULL`, [phone]))[0] : null;
  const locked = row?.locked_until && new Date(row.locked_until) > new Date();
  const ok = (await verifyPassword(password.slice(0, 128), row?.password_hash || null)) && !locked;

  if (!ok) {
    await db.withTransaction(async tx => {
      await recordAttempt(tx, { phoneHash, success: false, reason: locked ? 'LOCKED' : 'INVALID_CREDENTIALS', ip });
      if (row?.password_hash && !locked) {
        await tx.query(`UPDATE bot_credentials SET failed_attempts = failed_attempts + 1,
          locked_until = CASE WHEN failed_attempts + 1 >= $2 THEN now() + make_interval(mins => $3::int) ELSE locked_until END WHERE bot_id = $1`,
        [row.id, opt.maxFailuresPerNumber, opt.lockMinutes]);
      }
    });
    throw GENERIC();
  }

  const botId = Number(row.id);
  return db.withTransaction(async tx => {
    await tx.query('SELECT id FROM bots WHERE id = $1 FOR UPDATE', [botId]);   // serialisasi login untuk bot ini
    const state = await botState(tx, botId);
    if (!state.allowed) {
      await recordAttempt(tx, { phoneHash, success: false, reason: state.reasons[0], ip });
      await audit.write(tx, { actorType: 'bot', actorId: botId, action: 'bot.login_denied', targetType: 'bot', targetId: botId, details: { reasons: state.reasons }, ip });
      throw new HttpError(403, state.reasons[0], REASON_MESSAGES[state.reasons[0]] || 'Akses bot ditolak.', { reasons: state.reasons, ban_reason: state.ban_reason });
    }
    // Lease: proses lain dengan instance_id berbeda yang masih heartbeat -> tolak, kecuali force.
    const active = await tx.query(`SELECT id, instance_id, last_seen_at, created_at FROM bot_sessions
      WHERE bot_id = $1 AND revoked_at IS NULL AND expires_at > now()`, [botId]);
    const live = active.filter(s => s.instance_id !== instanceId && Date.now() - new Date(s.last_seen_at || s.created_at).getTime() < opt.leaseSeconds * 1000);
    if (live.length && input.force !== true) {
      await recordAttempt(tx, { phoneHash, success: false, reason: 'INSTANCE_ACTIVE', ip });
      throw new HttpError(409, 'INSTANCE_ACTIVE', 'Bot ini sedang dipakai oleh proses lain. Matikan proses itu dulu, atau login dengan force.');
    }
    await tx.query("UPDATE bot_sessions SET revoked_at = now(), revoked_reason = 'replaced' WHERE bot_id = $1 AND revoked_at IS NULL", [botId]);
    await tx.query('UPDATE bot_credentials SET failed_attempts = 0, locked_until = NULL WHERE bot_id = $1', [botId]);
    const token = newToken('yab');
    const expires = new Date(Date.now() + opt.sessionDays * 86400000);
    await tx.query('INSERT INTO bot_sessions (bot_id, token_hash, instance_id, instance_name, expires_at, last_seen_at, ip) VALUES ($1,$2,$3,$4,$5,now(),$6)',
      [botId, sha256(token), instanceId, instanceName, expires, ip]);
    await tx.query("UPDATE bots SET last_seen_at = now(), bot_version = COALESCE($2, bot_version), connection_status = 'connecting', updated_at = now() WHERE id = $1", [botId, version]);
    await recordAttempt(tx, { phoneHash, success: true, reason: null, ip });
    await audit.write(tx, { actorType: 'bot', actorId: botId, action: 'bot.login', targetType: 'bot', targetId: botId, details: { instance_name: instanceName, forced: live.length > 0, version }, ip });
    return { token, expires_at: expires.toISOString(), state };
  });
}

// Token -> sesi aktif. Token dicabut/kedaluwarsa -> 401 dengan alasan (bot harus mengunci diri).
async function authenticate(q, token) {
  if (typeof token !== 'string' || !/^yab_[A-Za-z0-9_-]{43}$/.test(token)) throw unauthorized('INVALID_TOKEN', 'Token bot tidak valid.');
  const s = (await q.query('SELECT id, bot_id, instance_id, expires_at, revoked_at, revoked_reason FROM bot_sessions WHERE token_hash = $1', [sha256(token)]))[0];
  if (!s) throw unauthorized('INVALID_TOKEN', 'Token bot tidak valid.');
  if (s.revoked_at) throw new HttpError(401, 'SESSION_REVOKED', 'Sesi bot sudah dicabut.', { reason: s.revoked_reason });
  if (new Date(s.expires_at) <= new Date()) throw new HttpError(401, 'SESSION_EXPIRED', 'Sesi bot sudah kedaluwarsa. Login ulang.');
  return { ...s, id: Number(s.id), bot_id: Number(s.bot_id) };
}

async function verify(db, token) {
  const s = await authenticate(db, token);
  return { session: { expires_at: s.expires_at }, state: await botState(db, s.bot_id) };
}

const CONNECTION = ['disconnected', 'connecting', 'connected'];

async function heartbeat(db, token, input = {}, { ip = null } = {}) {
  const s = await authenticate(db, token);
  if (input.instance_id !== s.instance_id) throw new HttpError(409, 'INSTANCE_MISMATCH', 'Token ini milik proses bot lain.');
  const conn = CONNECTION.includes(input.connection_status) ? input.connection_status : null;
  const state = await botState(db, s.bot_id);
  await db.query('UPDATE bot_sessions SET last_seen_at = now(), ip = COALESCE($2, ip) WHERE id = $1', [s.id, ip]);
  // Bot yang tidak diizinkan selalu tercatat disconnected walau prosesnya melapor "connected".
  await db.query('UPDATE bots SET last_seen_at = now(), connection_status = $2, updated_at = now() WHERE id = $1',
    [s.bot_id, state.allowed ? (conn || 'connected') : 'disconnected']);
  return { state };
}

async function logout(db, token, { ip = null } = {}) {
  const s = await authenticate(db, token);
  await db.withTransaction(async tx => {
    await tx.query("UPDATE bot_sessions SET revoked_at = now(), revoked_reason = 'logout' WHERE id = $1", [s.id]);
    await tx.query("UPDATE bots SET connection_status = 'disconnected', updated_at = now() WHERE id = $1", [s.bot_id]);
    await audit.write(tx, { actorType: 'bot', actorId: s.bot_id, action: 'bot.logout', targetType: 'bot', targetId: s.bot_id, ip });
  });
  return { ok: true };
}

module.exports = { login, verify, heartbeat, logout, authenticate, botState, DEFAULTS, identHash };
