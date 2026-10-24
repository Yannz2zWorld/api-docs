'use strict';
// Bot / nomor WhatsApp: buat (kuota nomor), ubah, enable/disable, ban/unban, maintenance per bot,
// reset password bot, cabut sesi, hapus (soft-delete).
// Status koneksi (connection_status) TERPISAH dari enabled dan banned. Status efektif dihitung:
//   banned > disabled > connection_status.

const v = require('../lib/validate');
const { forbidden, notFound, badRequest, fromDatabase } = require('../lib/errors');
const { hashPassword } = require('../lib/security');
const access = require('./accessControl');
const quota = require('./quotaService');
const audit = require('./auditService');

const FIELDS = `b.id, b.owner_id, b.user_account_id, b.bot_name, b.phone_number, b.connection_status, b.enabled, b.disabled_reason, b.disabled_at,
  b.banned, b.ban_reason, b.banned_by, b.banned_at, b.maintenance_enabled, b.maintenance_message, b.maintenance_at,
  b.last_seen_at, b.bot_version, b.created_by, b.created_at, b.updated_at,
  o.username AS owner_username, o.rank_code AS owner_rank, u.username AS user_username,
  (c.bot_id IS NOT NULL) AS password_set, c.updated_at AS password_updated_at,
  (SELECT count(*)::int FROM bot_sessions s WHERE s.bot_id = b.id AND s.revoked_at IS NULL AND s.expires_at > now()) AS active_sessions`;
const FROM = 'FROM bots b JOIN accounts o ON o.id = b.owner_id LEFT JOIN accounts u ON u.id = b.user_account_id LEFT JOIN bot_credentials c ON c.bot_id = b.id';

const effectiveStatus = b => (b.banned ? 'banned' : !b.enabled ? 'disabled' : b.connection_status);
const shape = b => b && ({ ...b, id: Number(b.id), owner_id: Number(b.owner_id), user_account_id: b.user_account_id ? Number(b.user_account_id) : null, status: effectiveStatus(b) });

async function mapDbError(fn) {
  try { return await fn(); } catch (e) { throw fromDatabase(e) || e; }
}

async function getRow(q, id, { lock = false } = {}) {
  const rows = await q.query(`SELECT * FROM bots WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
  if (!rows[0] || rows[0].deleted_at) throw notFound('BOT_NOT_FOUND', 'Bot tidak ditemukan.');
  return rows[0];
}
const view = async (q, id) => shape((await q.query(`SELECT ${FIELDS} ${FROM} WHERE b.id = $1`, [id]))[0]);

async function list(db, actor) {
  access.require(actor, 'bot.view');
  if (actor.perms.has('bot.view_all')) return (await db.query(`SELECT ${FIELDS} ${FROM} WHERE b.deleted_at IS NULL ORDER BY b.id`)).map(shape);
  const rows = await db.query(`WITH RECURSIVE scope AS (SELECT id FROM accounts WHERE manager_id = $1 AND deleted_at IS NULL
      UNION SELECT x.id FROM accounts x JOIN scope s ON x.manager_id = s.id WHERE x.deleted_at IS NULL)
    SELECT ${FIELDS} ${FROM} WHERE b.deleted_at IS NULL
      AND (b.owner_id = $1 OR b.user_account_id = $1 OR b.owner_id IN (SELECT id FROM scope)) ORDER BY b.id`, [actor.id]);
  return rows.map(shape);
}

async function assertUserAssignable(tx, actor, ownerId, userId) {
  if (!userId) return null;
  const u = await access.getAccountRow(tx, userId);
  if (u.status !== 'active') throw badRequest('USER_NOT_ACTIVE', 'Akun pemakai tidak aktif.');
  if (u.id === ownerId || u.id === actor.id) return u.id;
  const ownerTree = await access.subtreeIds(tx, ownerId);
  if (ownerTree.has(u.id)) return u.id;
  if (actor.perms.has('scope.global') || (await access.subtreeIds(tx, actor.id)).has(u.id)) return u.id;
  throw forbidden('OUT_OF_SCOPE', 'Akun pemakai di luar cakupan.');
}

async function create(db, actor, input, { ip = null, bcryptCost = 12 } = {}) {
  access.require(actor, 'number.create');
  const name = v.botName(input.bot_name);
  const phone = v.phone(input.phone_number);
  const ownerId = input.owner_id ? v.id(input.owner_id, 'owner_id') : actor.id;
  const userId = input.user_account_id ? v.id(input.user_account_id, 'user_account_id') : null;
  // Password bot HANYA DEVELOPER yang bisa membuat — tidak ada password otomatis.
  // Reseller/dst. hanya mendaftarkan nomor (tanpa password); bot belum bisa jalan sampai
  // DEVELOPER menetapkan passwordnya (lewat setPassword). Kalau yang menambah nomor bukan
  // developer tapi tetap mengirim password, tolak.
  const canSetCredential = actor.perms.has('bot.credential.reset');
  if (input.password && !canSetCredential) throw forbidden('PERMISSION_DENIED', 'Hanya DEVELOPER yang bisa membuat password bot.');
  const initialPassword = input.password ? v.botPassword(input.password) : null;
  const passwordHash = initialPassword ? await hashPassword(initialPassword, bcryptCost) : null;
  return mapDbError(() => db.withTransaction(async tx => {
    if (ownerId !== actor.id) await access.assertCanManage(tx, actor, await access.getAccountRow(tx, ownerId));
    const q = await quota.assertCanAdd(tx, ownerId, 'numbers');
    const assigned = await assertUserAssignable(tx, actor, ownerId, userId);
    const id = Number((await tx.query('INSERT INTO bots (owner_id, user_account_id, bot_name, phone_number, created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [ownerId, assigned, name, phone, actor.id]))[0].id);
    if (passwordHash) await tx.query("INSERT INTO bot_credentials (bot_id, password_hash, set_by, set_via) VALUES ($1,$2,$3,'dashboard')", [id, passwordHash, actor.id]);
    await audit.write(tx, { actorId: actor.id, action: 'bot.create', targetType: 'bot', targetId: id, details: { bot_name: name, owner_id: ownerId, password_set: !!passwordHash, quota_after: `${q.used + 1}/${q.limit ?? '∞'}` }, ip });
    return view(tx, id);
  }));
}

async function update(db, actor, id, input, { ip = null } = {}) {
  access.require(actor, 'bot.manage');
  return mapDbError(() => db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    const changed = [];
    if (input.bot_name !== undefined) { await tx.query('UPDATE bots SET bot_name = $1 WHERE id = $2', [v.botName(input.bot_name), id]); changed.push('bot_name'); }
    if (input.user_account_id !== undefined) {
      const uid = input.user_account_id ? await assertUserAssignable(tx, actor, Number(bot.owner_id), v.id(input.user_account_id, 'user_account_id')) : null;
      await tx.query('UPDATE bots SET user_account_id = $1 WHERE id = $2', [uid, id]); changed.push('user_account_id');
    }
    if (changed.length) {
      await tx.query('UPDATE bots SET updated_at = now() WHERE id = $1', [id]);
      await audit.write(tx, { actorId: actor.id, action: 'bot.update', targetType: 'bot', targetId: id, details: { fields: changed }, ip });
    }
    return view(tx, id);
  }));
}

async function revokeSessions(tx, botId, reason, actorId) {
  return (await tx.query('UPDATE bot_sessions SET revoked_at = now(), revoked_reason = $2, revoked_by = $3 WHERE bot_id = $1 AND revoked_at IS NULL RETURNING id', [botId, reason, actorId])).length;
}

async function setEnabled(db, actor, id, enabled, reasonInput, { ip = null } = {}) {
  access.require(actor, 'bot.manage');
  v.bool(enabled, 'enabled');
  const reason = enabled ? null : v.reason(reasonInput);
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    if (bot.enabled === enabled) return view(tx, id);
    if (enabled) await tx.query('UPDATE bots SET enabled = true, disabled_reason = NULL, disabled_by = NULL, disabled_at = NULL, updated_at = now() WHERE id = $1', [id]);
    else await tx.query("UPDATE bots SET enabled = false, disabled_reason = $2, disabled_by = $3, disabled_at = now(), connection_status = 'disconnected', updated_at = now() WHERE id = $1", [id, reason, actor.id]);
    const revoked = enabled ? 0 : await revokeSessions(tx, id, 'bot_disabled', actor.id);
    await audit.write(tx, { actorId: actor.id, action: enabled ? 'bot.enable' : 'bot.disable', targetType: 'bot', targetId: id, details: { reason, revoked_sessions: revoked }, ip });
    return view(tx, id);
  });
}

async function setBanned(db, actor, id, banned, reasonInput, { ip = null } = {}) {
  access.require(actor, banned ? 'bot.ban' : 'bot.unban');
  const reason = banned ? v.reason(reasonInput) : v.optionalReason(reasonInput);
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    if (bot.banned === banned) return view(tx, id);
    if (banned) await tx.query("UPDATE bots SET banned = true, ban_reason = $2, banned_by = $3, banned_at = now(), connection_status = 'disconnected', updated_at = now() WHERE id = $1", [id, reason, actor.id]);
    else await tx.query('UPDATE bots SET banned = false, ban_reason = NULL, banned_by = NULL, banned_at = NULL, updated_at = now() WHERE id = $1', [id]);
    const revoked = banned ? await revokeSessions(tx, id, 'bot_banned', actor.id) : 0;
    await audit.write(tx, { actorId: actor.id, action: banned ? 'bot.ban' : 'bot.unban', targetType: 'bot', targetId: id, details: { reason, revoked_sessions: revoked }, ip });
    return view(tx, id);
  });
}

async function setMaintenance(db, actor, id, enabled, messageInput, { ip = null } = {}) {
  access.require(actor, 'bot.maintenance');
  v.bool(enabled, 'enabled');
  const message = enabled ? v.message(messageInput) : null;
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    await tx.query('UPDATE bots SET maintenance_enabled = $2, maintenance_message = $3, maintenance_by = $4, maintenance_at = now(), updated_at = now() WHERE id = $1', [id, enabled, message, actor.id]);
    await audit.write(tx, { actorId: actor.id, action: 'maintenance.bot.update', targetType: 'bot', targetId: id, details: { enabled, message }, ip });
    return view(tx, id);
  });
}

// Set / reset password bot. Password tidak pernah dikembalikan atau dicatat; sesi lama dicabut (rotasi).
async function setPassword(db, actor, id, password, { ip = null, bcryptCost = 12, via = 'dashboard' } = {}) {
  access.require(actor, 'bot.credential.reset');
  const hash = await hashPassword(v.botPassword(password), bcryptCost);
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    await tx.query(`INSERT INTO bot_credentials (bot_id, password_hash, set_by, set_via, updated_at, failed_attempts, locked_until)
      VALUES ($1,$2,$3,$4,now(),0,NULL)
      ON CONFLICT (bot_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, set_by = EXCLUDED.set_by, set_via = EXCLUDED.set_via, updated_at = now(), failed_attempts = 0, locked_until = NULL`, [id, hash, actor.id, via]);
    const revoked = await revokeSessions(tx, id, 'password_reset', actor.id);
    await audit.write(tx, { actorId: actor.id, action: 'bot.credential.reset', targetType: 'bot', targetId: id, details: { revoked_sessions: revoked, via }, ip });
    return { ok: true, revoked_sessions: revoked };
  });
}

async function revoke(db, actor, id, { ip = null } = {}) {
  access.require(actor, 'bot.session.revoke');
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    const n = await revokeSessions(tx, id, 'revoked_by_admin', actor.id);
    await tx.query("UPDATE bots SET connection_status = 'disconnected', updated_at = now() WHERE id = $1", [id]);
    await audit.write(tx, { actorId: actor.id, action: 'bot.session.revoke', targetType: 'bot', targetId: id, details: { revoked_sessions: n }, ip });
    return { revoked_sessions: n };
  });
}

async function remove(db, actor, id, { ip = null } = {}) {
  access.require(actor, 'number.delete');
  return db.withTransaction(async tx => {
    const bot = await getRow(tx, id, { lock: true });
    await access.assertBotWritable(tx, actor, bot);
    await tx.query("UPDATE bots SET deleted_at = now(), deleted_by = $2, connection_status = 'disconnected', updated_at = now() WHERE id = $1", [id, actor.id]);
    const n = await revokeSessions(tx, id, 'bot_deleted', actor.id);
    await audit.write(tx, { actorId: actor.id, action: 'bot.delete', targetType: 'bot', targetId: id, details: { bot_name: bot.bot_name, revoked_sessions: n }, ip });
    return { deleted: true };
  });
}

async function sessions(db, actor, id) {
  access.require(actor, 'bot.view');
  const bot = await getRow(db, id);
  await access.assertBotWritable(db, actor, bot);
  return db.query(`SELECT id, instance_id, instance_name, created_at, expires_at, last_seen_at, revoked_at, revoked_reason
    FROM bot_sessions WHERE bot_id = $1 ORDER BY id DESC LIMIT 20`, [id]);
}

module.exports = { list, create, update, setEnabled, setBanned, setMaintenance, setPassword, revoke, remove, sessions, effectiveStatus, getRow, view };
