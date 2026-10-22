'use strict';
// Akun dashboard (users): buat, ubah, ganti rank, ban/unban, hapus (soft-delete).
// Setiap operasi: autentikasi (aktor sudah di-load) -> permission -> cakupan/hierarki -> kuota
// -> validasi -> mutasi transaksional -> audit log -> respons aman (tanpa hash/token/google_sub).

const v = require('../lib/validate');
const { forbidden, conflict, fromDatabase } = require('../lib/errors');
const access = require('./accessControl');
const quota = require('./quotaService');
const audit = require('./auditService');

const PUBLIC_FIELDS = 'a.id, a.username, a.display_name, a.email, a.email_verified, a.phone_number, a.rank_code, a.status, a.status_reason, a.status_changed_at, a.manager_id, a.created_by, a.created_at, a.updated_at, a.last_login_at, (a.google_sub IS NOT NULL) AS google_linked';

function publicAccount(row) {
  if (!row) return row;
  const { google_sub, deleted_by, ...rest } = row;   // google_sub tidak pernah dikirim ke browser
  return { ...rest, id: Number(rest.id), manager_id: rest.manager_id ? Number(rest.manager_id) : null, created_by: rest.created_by ? Number(rest.created_by) : null };
}

async function mapDbError(fn) {
  try { return await fn(); }
  catch (e) { throw fromDatabase(e) || e; }
}

async function list(db, actor, { q = null, rank = null, status = null, limit = 100 } = {}) {
  const canAll = actor.perms.has('user.view_all');
  if (!canAll && !actor.perms.has('user.view')) {
    return [publicAccount((await db.query(`SELECT ${PUBLIC_FIELDS} FROM accounts a WHERE a.id = $1`, [actor.id]))[0])];
  }
  const params = [Math.min(limit, 500)];
  const where = ['a.deleted_at IS NULL'];
  let cte = '';
  if (!canAll) {
    params.push(actor.id);
    cte = `WITH RECURSIVE scope AS (SELECT id FROM accounts WHERE manager_id = $2 AND deleted_at IS NULL
      UNION SELECT x.id FROM accounts x JOIN scope s ON x.manager_id = s.id WHERE x.deleted_at IS NULL) `;
    where.push('(a.id = $2 OR a.id IN (SELECT id FROM scope))');
  }
  if (q) { params.push('%' + String(q).toLowerCase().slice(0, 60) + '%'); where.push(`(a.username LIKE $${params.length} OR coalesce(a.email,'') LIKE $${params.length} OR lower(a.display_name) LIKE $${params.length})`); }
  if (rank) { params.push(v.rank(rank)); where.push(`a.rank_code = $${params.length}`); }
  if (status) { params.push(String(status)); where.push(`a.status = $${params.length}`); }
  const rows = await db.query(`${cte}SELECT ${PUBLIC_FIELDS}, r.max_numbers, r.max_managed_users,
      (SELECT count(*)::int FROM bots b WHERE b.owner_id = a.id AND b.deleted_at IS NULL) AS numbers_used,
      (SELECT count(*)::int FROM accounts m WHERE m.manager_id = a.id AND m.deleted_at IS NULL) AS users_used,
      (SELECT coalesce(json_agg(json_build_object('id', b.id, 'bot_name', b.bot_name) ORDER BY b.id), '[]'::json)
         FROM bots b WHERE b.deleted_at IS NULL AND (b.owner_id = a.id OR b.user_account_id = a.id)) AS bots,
      mg.username AS manager_username
    FROM accounts a JOIN ranks r ON r.code = a.rank_code LEFT JOIN accounts mg ON mg.id = a.manager_id
    WHERE ${where.join(' AND ')} ORDER BY r.level DESC, a.id LIMIT $1`, params);
  return rows.map(r => ({
    ...publicAccount(r),
    quota: { numbers: quota.label(r.numbers_used, r.max_numbers), users: quota.label(r.users_used, r.max_managed_users) },
    numbers_used: r.numbers_used, users_used: r.users_used, max_numbers: r.max_numbers, max_managed_users: r.max_managed_users
  }));
}

async function get(db, actor, id) {
  const target = await access.getAccountRow(db, id);
  if (target.id !== actor.id) {
    if (!actor.perms.has('user.view_all')) {
      access.require(actor, 'user.view');
      if (!(await access.subtreeIds(db, actor.id)).has(target.id)) throw forbidden('OUT_OF_SCOPE', 'Akun ini di luar cakupan kamu.');
    }
  }
  const row = (await db.query(`SELECT ${PUBLIC_FIELDS} FROM accounts a WHERE a.id = $1`, [id]))[0];
  return { ...publicAccount(row), quota: await quota.usage(db, id, row.rank_code) };
}

async function create(db, actor, input, { ip = null } = {}) {
  const rank = v.rank(input.rank || 'MEMBER');
  const data = {
    username: v.username(input.username),
    display_name: input.display_name ? v.displayName(input.display_name) : '',
    email: v.email(input.email),
    phone_number: v.phone(input.phone_number, { optional: true })
  };
  const ranks = await access.loadRanks(db);
  if (!ranks.get(rank).assignable) throw forbidden('RANK_NOT_ASSIGNABLE', `Rank ${rank} hanya bisa diberikan lewat prosedur khusus.`);
  const perm = access.CREATE_PERM[rank];
  access.require(actor, perm);
  if (ranks.get(rank).level >= actor.level) throw forbidden('RANK_HIERARCHY', 'Tidak bisa membuat akun dengan rank yang sama atau lebih tinggi.');
  const managerId = input.manager_id ? v.id(input.manager_id, 'manager_id') : actor.id;

  return mapDbError(() => db.withTransaction(async tx => {
    if (managerId !== actor.id) {
      const mgr = await access.getAccountRow(tx, managerId);
      await access.assertCanManage(tx, actor, mgr);
      const mr = ranks.get(mgr.rank_code);
      if (!mr.perms.has(perm) || mr.level <= ranks.get(rank).level) throw forbidden('MANAGER_CANNOT_MANAGE_RANK', `Manager ${mgr.username} tidak boleh mengelola rank ${rank}.`);
    }
    const q = await quota.assertCanAdd(tx, managerId, 'users');
    const row = (await tx.query(`INSERT INTO accounts (username, display_name, email, phone_number, rank_code, manager_id, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [data.username, data.display_name, data.email, data.phone_number, rank, managerId, actor.id]))[0];
    const id = Number(row.id);
    await audit.write(tx, { actorId: actor.id, action: 'account.create', targetType: 'account', targetId: id, details: { username: data.username, rank, manager_id: managerId, quota_after: `${q.used + 1}/${q.limit ?? '∞'}` }, ip });
    return publicAccount((await tx.query(`SELECT ${PUBLIC_FIELDS} FROM accounts a WHERE a.id = $1`, [id]))[0]);
  }));
}

async function update(db, actor, id, input, { ip = null } = {}) {
  access.require(actor, 'user.update');
  return mapDbError(() => db.withTransaction(async tx => {
    const target = await access.getAccountRow(tx, id, { lock: true });
    await access.assertCanManage(tx, actor, target);
    const sets = [], params = [], changed = {};
    if (input.display_name !== undefined) { params.push(v.displayName(input.display_name)); sets.push(`display_name = $${params.length}`); changed.display_name = true; }
    if (input.email !== undefined) { params.push(v.email(input.email)); sets.push(`email = $${params.length}`, 'email_verified = false'); changed.email = true; }
    if (input.phone_number !== undefined) { params.push(v.phone(input.phone_number, { optional: true })); sets.push(`phone_number = $${params.length}`); changed.phone_number = true; }
    if (!sets.length) return publicAccount((await tx.query(`SELECT ${PUBLIC_FIELDS} FROM accounts a WHERE a.id = $1`, [id]))[0]);
    params.push(id);
    await tx.query(`UPDATE accounts SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
    await audit.write(tx, { actorId: actor.id, action: 'account.update', targetType: 'account', targetId: id, details: { fields: Object.keys(changed) }, ip });
    return publicAccount((await tx.query(`SELECT ${PUBLIC_FIELDS} FROM accounts a WHERE a.id = $1`, [id]))[0]);
  }));
}

// Ganti rank: butuh role.assign + permission rank tujuan (naik) / rank asal (turun).
// Rank DEVELOPER tidak pernah lewat sini. Data lama tidak dihapus kalau kuota baru lebih kecil.
async function changeRank(db, actor, id, newRankInput, { ip = null } = {}) {
  access.require(actor, 'role.assign');
  const newRank = v.rank(newRankInput);
  const ranks = await access.loadRanks(db);
  if (!ranks.get(newRank).assignable) throw forbidden('RANK_NOT_ASSIGNABLE', `Rank ${newRank} hanya bisa diberikan lewat prosedur khusus.`);
  if (ranks.get(newRank).level >= actor.level) throw forbidden('RANK_HIERARCHY', 'Tidak bisa memberi rank yang sama atau lebih tinggi dari rank kamu.');
  return db.withTransaction(async tx => {
    const target = await access.getAccountRow(tx, id, { lock: true });
    await access.assertCanManage(tx, actor, target);
    const oldRank = target.rank_code;
    if (oldRank === newRank) return { changed: false, rank: newRank };
    const up = ranks.get(newRank).level > ranks.get(oldRank).level;
    access.require(actor, up ? access.CREATE_PERM[newRank] : access.DELETE_PERM[oldRank]);
    // Hierarki tetap rapi: kalau manager lama tidak lebih tinggi dari rank baru, akun dipindah ke bawah aktor.
    let managerId = target.manager_id;
    let reparented = false;
    if (managerId && managerId !== actor.id) {
      const mgr = await access.getAccountRow(tx, managerId).catch(() => null);
      if (!mgr || ranks.get(mgr.rank_code).level <= ranks.get(newRank).level) {
        await quota.assertCanAdd(tx, actor.id, 'users');
        managerId = actor.id; reparented = true;
      }
    }
    await tx.query('UPDATE accounts SET rank_code = $1, manager_id = $2, updated_at = now() WHERE id = $3', [newRank, managerId, id]);
    const after = await quota.usage(tx, id, newRank);
    await audit.write(tx, { actorId: actor.id, action: 'account.rank_change', targetType: 'account', targetId: id, details: { from: oldRank, to: newRank, reparented_to: reparented ? actor.id : undefined, quota_after: { numbers: after.numbers.label, users: after.users.label } }, ip });
    return { changed: true, from: oldRank, rank: newRank, quota: after, over_quota: [after.numbers, after.users].some(x => x.limit !== null && x.used > x.limit) };
  });
}

// Ban / suspend / disable / aktifkan kembali. Sesi dashboard dan sesi bot yang terkait langsung dicabut.
async function setStatus(db, actor, id, status, reasonInput, { ip = null } = {}) {
  const restrictive = status !== 'active';
  if (restrictive) v.restrictiveStatus(status);
  access.require(actor, restrictive ? 'user.ban' : 'user.unban');
  const reason = restrictive ? v.reason(reasonInput) : v.optionalReason(reasonInput);
  return db.withTransaction(async tx => {
    const target = await access.getAccountRow(tx, id, { lock: true });
    await access.assertCanManage(tx, actor, target);
    if (target.status === status) return { changed: false, status };
    await tx.query('UPDATE accounts SET status = $1, status_reason = $2, status_changed_by = $3, status_changed_at = now(), updated_at = now() WHERE id = $4', [status, reason, actor.id, id]);
    let revoked = { dashboard: 0, bot: 0 };
    if (restrictive) {
      revoked.dashboard = (await tx.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL RETURNING id', [id])).length;
      revoked.bot = (await tx.query(`UPDATE bot_sessions SET revoked_at = now(), revoked_reason = $2, revoked_by = $3 WHERE revoked_at IS NULL
        AND bot_id IN (SELECT id FROM bots WHERE owner_id = $1 OR user_account_id = $1) RETURNING id`, [id, `account_${status}`, actor.id])).length;
    }
    const action = restrictive ? `account.${status === 'banned' ? 'ban' : status === 'suspended' ? 'suspend' : 'disable'}` : 'account.unban';
    await audit.write(tx, { actorId: actor.id, action, targetType: 'account', targetId: id, details: { from: target.status, to: status, reason, revoked }, ip });
    return { changed: true, status, revoked };
  });
}

// Soft-delete. Ditolak kalau masih punya akun/bot aktif di bawahnya (supaya tidak ada data yatim).
async function remove(db, actor, id, { ip = null } = {}) {
  return db.withTransaction(async tx => {
    const target = await access.getAccountRow(tx, id, { lock: true });
    if (!access.DELETE_PERM[target.rank_code]) throw forbidden('RANK_NOT_ASSIGNABLE', 'Akun DEVELOPER hanya bisa diubah lewat prosedur CLI.');
    access.require(actor, access.DELETE_PERM[target.rank_code]);
    await access.assertCanManage(tx, actor, target);
    const users = await quota.countManagedUsers(tx, id);
    const numbers = await quota.countNumbers(tx, id);
    if (users || numbers) throw conflict('HAS_DEPENDENTS', `Akun masih mengelola ${users} user dan ${numbers} nomor. Pindahkan/hapus dulu.`, { users, numbers });
    await tx.query('UPDATE accounts SET deleted_at = now(), deleted_by = $1, updated_at = now() WHERE id = $2', [actor.id, id]);
    await tx.query('UPDATE dashboard_sessions SET revoked_at = now() WHERE account_id = $1 AND revoked_at IS NULL', [id]);
    await tx.query('UPDATE bots SET user_account_id = NULL, updated_at = now() WHERE user_account_id = $1', [id]);
    await audit.write(tx, { actorId: actor.id, action: 'account.delete', targetType: 'account', targetId: id, details: { username: target.username, rank: target.rank_code }, ip });
    return { deleted: true };
  });
}

module.exports = { list, get, create, update, changeRank, setStatus, remove, publicAccount, PUBLIC_FIELDS };
