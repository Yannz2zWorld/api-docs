'use strict';
// Authorization terpusat: rank & permission dari database, cakupan (pohon delegasi lewat
// accounts.manager_id), dan aturan hierarki. Dipakai semua service — UI bukan sumber kebenaran.

const { forbidden, notFound } = require('../lib/errors');

// Permission yang dibutuhkan untuk membuat / menghapus (atau menaikkan ke / menurunkan dari) rank tertentu.
const CREATE_PERM = { MEMBER: 'user.create', RESELLER: 'reseller.create', PARTNER: 'partner.create', OWNER: 'owner.create', CEO: 'ceo.create', DEVELOPER: null };
const DELETE_PERM = { MEMBER: 'user.delete', RESELLER: 'reseller.delete', PARTNER: 'partner.delete', OWNER: 'owner.delete', CEO: 'ceo.delete', DEVELOPER: null };

let cache = null;
let cacheAt = 0;
const CACHE_MS = 60000;

async function loadRanks(q, { fresh = false } = {}) {
  if (cache && !fresh && Date.now() - cacheAt < CACHE_MS) return cache;
  const ranks = await q.query('SELECT code, level, max_numbers, max_managed_users, assignable, description FROM ranks ORDER BY level');
  const perms = await q.query('SELECT rank_code, permission_code FROM rank_permissions');
  const map = new Map();
  for (const r of ranks) map.set(r.code, { ...r, level: Number(r.level), perms: new Set() });
  for (const p of perms) map.get(p.rank_code)?.perms.add(p.permission_code);
  cache = map; cacheAt = Date.now();
  return map;
}
const invalidate = () => { cache = null; };

// Aktor dibaca ULANG dari database setiap request (status/rank terbaru, bukan dari cookie).
async function loadActor(q, accountId) {
  const rows = await q.query('SELECT id, username, display_name, email, rank_code, status, manager_id, deleted_at FROM accounts WHERE id = $1', [accountId]);
  const a = rows[0];
  if (!a || a.deleted_at) return null;
  const ranks = await loadRanks(q);
  const r = ranks.get(a.rank_code);
  return { id: Number(a.id), username: a.username, displayName: a.display_name, email: a.email, rank: a.rank_code, level: r.level, status: a.status, managerId: a.manager_id ? Number(a.manager_id) : null, perms: new Set(r.perms) };
}

function require_(actor, perm) {
  if (!actor || actor.status !== 'active') throw forbidden('ACCOUNT_RESTRICTED', 'Akun kamu sedang tidak aktif.');
  if (!actor.perms.has(perm)) throw forbidden('PERMISSION_DENIED', `Butuh permission ${perm}.`);
}

// Semua id akun di bawah aktor (rekursif). UNION menghentikan rekursi kalau ada siklus.
async function subtreeIds(q, actorId) {
  const rows = await q.query(`WITH RECURSIVE scope AS (
      SELECT id FROM accounts WHERE manager_id = $1 AND deleted_at IS NULL
      UNION SELECT a.id FROM accounts a JOIN scope s ON a.manager_id = s.id WHERE a.deleted_at IS NULL)
    SELECT id FROM scope`, [actorId]);
  return new Set(rows.map(r => Number(r.id)));
}

async function getAccountRow(q, id, { lock = false } = {}) {
  const rows = await q.query(`SELECT id, username, display_name, email, phone_number, rank_code, status, manager_id, deleted_at FROM accounts WHERE id = $1 ${lock ? 'FOR UPDATE' : ''}`, [id]);
  const a = rows[0];
  if (!a || a.deleted_at) throw notFound('ACCOUNT_NOT_FOUND', 'Akun tidak ditemukan.');
  return { ...a, id: Number(a.id), manager_id: a.manager_id ? Number(a.manager_id) : null };
}

// Aktor boleh mengelola target kalau: bukan diri sendiri, rank target lebih rendah, dan target berada
// di pohon delegasinya — atau aktor punya scope.global.
async function assertCanManage(q, actor, target) {
  const ranks = await loadRanks(q);
  if (target.id === actor.id) throw forbidden('SELF_MANAGEMENT', 'Tidak bisa mengubah akun sendiri lewat aksi ini.');
  if (ranks.get(target.rank_code).level >= actor.level) throw forbidden('RANK_HIERARCHY', 'Tidak bisa mengelola akun dengan rank yang sama atau lebih tinggi.');
  if (actor.perms.has('scope.global')) return;
  if (!(await subtreeIds(q, actor.id)).has(target.id)) throw forbidden('OUT_OF_SCOPE', 'Akun ini di luar cakupan kamu.');
}

// Bot boleh dikelola kalau pemiliknya aktor sendiri, ada di pohon aktor, atau aktor scope.global
// dan rank pemilik lebih rendah.
async function assertBotWritable(q, actor, bot) {
  const ownerId = Number(bot.owner_id);
  if (ownerId === actor.id) return;
  const ranks = await loadRanks(q);
  const owner = await getAccountRow(q, ownerId).catch(() => null);
  if (actor.perms.has('scope.global') && owner && ranks.get(owner.rank_code).level < actor.level) return;
  if ((await subtreeIds(q, actor.id)).has(ownerId)) return;
  throw forbidden('OUT_OF_SCOPE', 'Bot ini di luar cakupan kamu.');
}

module.exports = { CREATE_PERM, DELETE_PERM, loadRanks, loadActor, invalidate, require: require_, subtreeIds, getAccountRow, assertCanManage, assertBotWritable };
