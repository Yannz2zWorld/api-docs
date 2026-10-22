'use strict';
// Kuota per rank (dari tabel ranks):
//   - kuota NOMOR  = jumlah bot aktif (belum dihapus) dengan owner_id = akun
//   - kuota USER   = jumlah akun aktif (belum dihapus) dengan manager_id = akun
// Dua jenis kuota terpisah; satu entitas tidak pernah dihitung dua kali.
// Pemeriksaan dilakukan DI DALAM transaksi setelah baris akun pemilik dikunci (SELECT ... FOR UPDATE),
// jadi request bersamaan untuk pemilik yang sama diserialkan dan tidak bisa melewati batas.
// Kalau rank turun dan pemakaian sudah melebihi batas baru, data lama TIDAK dihapus; penambahan baru diblokir.

const { conflict } = require('../lib/errors');
const access = require('./accessControl');

async function countNumbers(q, accountId) {
  return Number((await q.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [accountId]))[0].n);
}
async function countManagedUsers(q, accountId) {
  return Number((await q.query('SELECT count(*)::int AS n FROM accounts WHERE manager_id = $1 AND deleted_at IS NULL', [accountId]))[0].n);
}

async function usage(q, accountId, rankCode) {
  const ranks = await access.loadRanks(q);
  const r = ranks.get(rankCode);
  const [numbers, users] = await Promise.all([countNumbers(q, accountId), countManagedUsers(q, accountId)]);
  return {
    numbers: { used: numbers, limit: r.max_numbers, label: label(numbers, r.max_numbers) },
    users: { used: users, limit: r.max_managed_users, label: label(users, r.max_managed_users) }
  };
}
const label = (used, limit) => (limit === null || limit === undefined ? `${used}/∞` : `${used}/${limit}`);

// Wajib dipanggil di dalam withTransaction. Mengunci baris pemilik lalu menghitung.
async function assertCanAdd(tx, ownerId, kind) {
  const owner = await access.getAccountRow(tx, ownerId, { lock: true });
  if (owner.status !== 'active') throw conflict('OWNER_NOT_ACTIVE', 'Akun pemilik kuota sedang tidak aktif.');
  const ranks = await access.loadRanks(tx);
  const r = ranks.get(owner.rank_code);
  const limit = kind === 'numbers' ? r.max_numbers : r.max_managed_users;
  const used = kind === 'numbers' ? await countNumbers(tx, ownerId) : await countManagedUsers(tx, ownerId);
  if (limit !== null && used >= limit) {
    throw conflict('QUOTA_EXCEEDED', limit === 0
      ? `Rank ${owner.rank_code} tidak bisa menambah ${kind === 'numbers' ? 'nomor' : 'user'}.`
      : `Kuota ${kind === 'numbers' ? 'nomor' : 'user'} penuh (${used}/${limit}).`, { kind, used, limit, rank: owner.rank_code });
  }
  return { owner, used, limit };
}

module.exports = { usage, assertCanAdd, countNumbers, countManagedUsers, label };
