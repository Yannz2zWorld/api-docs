'use strict';
// Rank v2 & kuota lewat API dashboard asli + PostgreSQL:
//   MEMBER 0 · RESELLER 10 · SUKI 50 · RAJA 100 · DEWA 1000 · DEVELOPER tanpa batas (kuota nomor).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const h = require('./helpers');
const { createDb } = require('../../server/lib/db');
const { migrate } = require('../../server/lib/migrate');

let t;
before(async () => { if (!h.skip) t = await h.setup(); });
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const addBot = (s, extra = {}) => t.as(s).post('/api/dash/bots', { bot_name: 'Bot', phone_number: h.phone(), ...extra });
const addUser = (s, extra = {}) => t.as(s).post('/api/dash/accounts', { username: `m${Math.random().toString(36).slice(2, 10)}`, ...extra });
// Isi n bot langsung di database (untuk menguji batas 100/1000 tanpa ribuan request).
const fillBots = (ownerId, n) => t.db.query(`INSERT INTO bots (owner_id, bot_name, phone_number, created_by)
  SELECT $1, 'Isi ' || g, '7' || lpad(($1::bigint * 100000 + g)::text, 12, '0'), $1 FROM generate_series(1, $2) g`, [ownerId, n]);

it('MEMBER tidak bisa menambah nomor maupun user', async () => {
  const m = await t.login(await t.account('MEMBER'));
  const b = await addBot(m);
  assert.equal(b.status, 403); assert.equal(b.json.error, 'PERMISSION_DENIED');
  const u = await addUser(m);
  assert.equal(u.status, 403); assert.equal(u.json.error, 'PERMISSION_DENIED');
  const me = await t.as(m).get('/api/dash/me');
  assert.equal(me.json.quota.numbers.label, '0/0');
  assert.equal(me.json.quota.users.label, '0/0');
});

it('RESELLER: nomor ke-10 diterima, ke-11 ditolak; user ke-10 diterima, ke-11 ditolak', async () => {
  const r = await t.login(await t.account('RESELLER'));
  for (let i = 1; i <= 10; i++) assert.equal((await addBot(r)).status, 200, `bot ${i}`);
  const b11 = await addBot(r);
  assert.equal(b11.status, 409); assert.equal(b11.json.error, 'QUOTA_EXCEEDED'); assert.equal(b11.json.used, 10); assert.equal(b11.json.limit, 10);
  for (let i = 1; i <= 10; i++) assert.equal((await addUser(r)).status, 200, `user ${i}`);
  const u11 = await addUser(r);
  assert.equal(u11.status, 409); assert.equal(u11.json.error, 'QUOTA_EXCEEDED');
  const me = await t.as(r).get('/api/dash/me');
  assert.equal(me.json.quota.numbers.label, '10/10');
  assert.equal(me.json.quota.users.label, '10/10');
});

it('SUKI: nomor ke-50 diterima, ke-51 ditolak', async () => {
  const s = await t.login(await t.account('SUKI'));
  for (let i = 1; i <= 50; i++) assert.equal((await addBot(s)).status, 200, `bot ${i}`);
  const over = await addBot(s);
  assert.equal(over.json.error, 'QUOTA_EXCEEDED'); assert.equal(over.json.limit, 50);
});

for (const [rank, limit] of [['RAJA', 100], ['DEWA', 1000]]) {
  it(`${rank}: nomor ke-${limit} diterima, ke-${limit + 1} ditolak`, async () => {
    const acc = await t.account(rank);
    const s = await t.login(acc);
    await fillBots(acc.id, limit - 1);
    assert.equal((await addBot(s)).status, 200, `bot ke-${limit}`);
    const over = await addBot(s);
    assert.equal(over.status, 409); assert.equal(over.json.error, 'QUOTA_EXCEEDED'); assert.equal(over.json.limit, limit);
    assert.equal((await t.as(s).get('/api/dash/me')).json.quota.numbers.label, `${limit}/${limit}`);
  });
}

it('DEVELOPER: tanpa batas kuota (lebih dari 1000 nomor, label ∞)', async () => {
  const acc = await t.account('DEVELOPER');
  const s = await t.login(acc);
  await fillBots(acc.id, 1005);
  assert.equal((await addBot(s)).status, 200);
  assert.equal((await t.as(s).get('/api/dash/me')).json.quota.numbers.label, '1006/∞');
});

// Siapa boleh menambah & menghapus rank apa (permintaan pemilik).
const MATRIX = {
  RESELLER: { create: ['MEMBER'], del: ['MEMBER'] },
  SUKI: { create: ['MEMBER', 'RESELLER'], del: ['MEMBER'] },
  RAJA: { create: ['MEMBER', 'RESELLER', 'SUKI'], del: ['MEMBER', 'RESELLER'] },
  DEWA: { create: ['MEMBER', 'RESELLER', 'SUKI', 'RAJA'], del: ['MEMBER', 'RESELLER', 'SUKI', 'RAJA'] },
  DEVELOPER: { create: ['MEMBER', 'RESELLER', 'SUKI', 'RAJA', 'DEWA'], del: ['MEMBER', 'RESELLER', 'SUKI', 'RAJA', 'DEWA'] }
};
const ALL = ['MEMBER', 'RESELLER', 'SUKI', 'RAJA', 'DEWA', 'DEVELOPER'];

for (const [actorRank, rule] of Object.entries(MATRIX)) {
  it(`${actorRank}: boleh tambah ${rule.create.join('/')}, hapus ${rule.del.join('/')}; selain itu ditolak`, async () => {
    const actor = await t.login(await t.account(actorRank));
    for (const rank of ALL) {
      const res = await addUser(actor, { rank });
      if (rule.create.includes(rank)) assert.equal(res.status, 200, `${actorRank} tambah ${rank}: ${res.text}`);
      else assert.equal(res.status, 403, `${actorRank} tidak boleh tambah ${rank}`);
    }
    // Hapus: akun target berada di bawah aktor (dibuat langsung agar menguji izin hapus saja).
    for (const rank of ALL.filter(r => r !== 'DEVELOPER')) {
      const target = await t.account(rank, { manager: actor.id });
      const res = await t.as(actor).del(`/api/dash/accounts/${target.id}`);
      if (rule.del.includes(rank)) assert.equal(res.status, 200, `${actorRank} hapus ${rank}: ${res.text}`);
      else assert.equal(res.status, 403, `${actorRank} tidak boleh hapus ${rank}`);
    }
  });
}

it('rank DEVELOPER tidak bisa diberikan lewat website', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  const res = await addUser(dev, { rank: 'DEVELOPER' });
  assert.equal(res.status, 403);
  const m = await t.account('MEMBER', { manager: dev.id });
  assert.equal((await t.as(dev).post(`/api/dash/accounts/${m.id}/rank`, { rank: 'DEVELOPER' })).status, 403);
});

it('menghapus resource membebaskan slot', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await addBot(r)).json.bot.id);
  assert.equal((await addBot(r)).json.error, 'QUOTA_EXCEEDED');
  assert.equal((await t.as(r).del(`/api/dash/bots/${ids[0]}`)).status, 200);
  assert.equal((await addBot(r)).status, 200, 'slot bebas setelah hapus');
  const users = [];
  for (let i = 0; i < 10; i++) users.push((await addUser(r)).json.account.id);
  assert.equal((await addUser(r)).json.error, 'QUOTA_EXCEEDED');
  assert.equal((await t.as(r).del(`/api/dash/accounts/${users[0]}`)).status, 200);
  assert.equal((await addUser(r)).status, 200);
});

it('penurunan rank tidak menghapus data; penambahan diblokir sampai di bawah batas; naik rank langsung menambah kuota', async () => {
  const dewa = await t.login(await t.account('DEWA'));
  const sukiAcc = await t.account('SUKI', { manager: dewa.id });
  const suki = await t.login(sukiAcc);
  for (let i = 0; i < 12; i++) assert.equal((await addBot(suki)).status, 200);
  const down = await t.as(dewa).post(`/api/dash/accounts/${sukiAcc.id}/rank`, { rank: 'RESELLER' });
  assert.equal(down.status, 200, down.text);
  assert.equal(down.json.over_quota, true);
  const count = (await t.db.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [sukiAcc.id]))[0].n;
  assert.equal(count, 12, 'data tidak dihapus otomatis');
  const blocked = await addBot(suki);
  assert.equal(blocked.json.error, 'QUOTA_EXCEEDED');
  assert.equal(blocked.json.limit, 10);
  assert.equal((await t.as(dewa).post(`/api/dash/accounts/${sukiAcc.id}/rank`, { rank: 'SUKI' })).status, 200);
  assert.equal((await addBot(suki)).status, 200);
});

it('SUKI bisa menaikkan member jadi reseller, tapi tidak bisa menurunkan reseller (butuh izin hapus reseller)', async () => {
  const suki = await t.login(await t.account('SUKI'));
  const m = await t.account('MEMBER', { manager: suki.id });
  assert.equal((await t.as(suki).post(`/api/dash/accounts/${m.id}/rank`, { rank: 'RESELLER' })).status, 200);
  assert.equal((await t.as(suki).post(`/api/dash/accounts/${m.id}/rank`, { rank: 'MEMBER' })).status, 403);
});

it('request bersamaan tidak melewati batas (25 request paralel untuk reseller kosong -> tepat 10 berhasil)', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const results = await Promise.all(Array.from({ length: 25 }, () => addBot(r)));
  assert.equal(results.filter(x => x.status === 200).length, 10);
  assert.equal(results.filter(x => x.json?.error === 'QUOTA_EXCEEDED').length, 15);
  const users = await Promise.all(Array.from({ length: 25 }, () => addUser(r)));
  assert.equal(users.filter(x => x.status === 200).length, 10);
  const n = (await t.db.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [r.id]))[0].n;
  assert.equal(n, 10);
});

it('ownership mencegah akses silang antar reseller', async () => {
  const a = await t.login(await t.account('RESELLER'));
  const b = await t.login(await t.account('RESELLER'));
  const botA = (await addBot(a)).json.bot;
  const userA = (await addUser(a)).json.account;
  for (const [method, p, body] of [
    ['patch', `/api/dash/bots/${botA.id}`, { bot_name: 'curian' }],
    ['post', `/api/dash/bots/${botA.id}/password`, { password: 'PasswordBaru123' }],
    ['post', `/api/dash/bots/${botA.id}/revoke`, {}],
    ['del', `/api/dash/bots/${botA.id}`],
    ['patch', `/api/dash/accounts/${userA.id}`, { display_name: 'x' }],
    ['del', `/api/dash/accounts/${userA.id}`]
  ]) {
    const res = await t.as(b)[method](p, body);
    assert.equal(res.status, 403, `${method} ${p} harus ditolak`);
    assert.equal(res.json.error, 'OUT_OF_SCOPE');
  }
  assert.equal((await t.as(b).get(`/api/dash/accounts/${userA.id}`)).status, 403);
  const listB = (await t.as(b).get('/api/dash/bots')).json.bots;
  assert.ok(!listB.some(x => x.id === botA.id), 'bot reseller lain tidak terlihat');
  assert.equal((await addBot(b, { owner_id: a.id })).status, 403);
});

it('DEWA hanya mengelola akun di bawahnya; DEWA lain di luar cakupan', async () => {
  const d1 = await t.login(await t.account('DEWA'));
  const d2 = await t.login(await t.account('DEWA'));
  const raja = await t.account('RAJA', { manager: d1.id });
  const res = await t.as(d2).del(`/api/dash/accounts/${raja.id}`);
  assert.equal(res.status, 403); assert.equal(res.json.error, 'OUT_OF_SCOPE');
});

it('migrasi 003: akun PARTNER/OWNER/CEO lama pindah ke SUKI/RAJA/DEWA tanpa kehilangan data', { skip: h.skip }, async () => {
  const schema = 'ym_' + crypto.randomBytes(6).toString('hex');
  const admin = createDb({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = createDb({ connectionString: process.env.TEST_DATABASE_URL, schema, max: 2 });
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  try {
    const dir = path.join(__dirname, '..', '..', 'server', 'migrations');
    for (const f of ['001_core.sql', '002_ranks_permissions.sql']) fs.copyFileSync(path.join(dir, f), path.join(old, f));
    await migrate(db, { dir: old });
    const ins = (u, r) => db.query("INSERT INTO accounts (username, rank_code) VALUES ($1, $2) RETURNING id", [u, r]);
    const [p] = await ins('lama_partner', 'PARTNER'); await ins('lama_owner', 'OWNER'); await ins('lama_ceo', 'CEO');
    await db.query("INSERT INTO bots (owner_id, bot_name, phone_number, created_by) VALUES ($1, 'Bot lama', '6281299990000', $1)", [p.id]);
    await db.query("UPDATE maintenance_settings SET exempt_ranks = ARRAY['DEVELOPER','CEO']");
    await migrate(db, { dir });
    const rows = Object.fromEntries((await db.query('SELECT username, rank_code FROM accounts')).map(r => [r.username, r.rank_code]));
    assert.deepEqual(rows, { lama_partner: 'SUKI', lama_owner: 'RAJA', lama_ceo: 'DEWA' });
    assert.equal((await db.query('SELECT count(*)::int AS n FROM bots'))[0].n, 1, 'bot lama tetap ada');
    assert.deepEqual((await db.query('SELECT exempt_ranks FROM maintenance_settings'))[0].exempt_ranks, ['DEVELOPER', 'DEWA']);
    const ranks = Object.fromEntries((await db.query('SELECT code, max_numbers FROM ranks')).map(r => [r.code, r.max_numbers]));
    assert.deepEqual(ranks, { MEMBER: 0, RESELLER: 10, SUKI: 50, RAJA: 100, DEWA: 1000, DEVELOPER: null });
    await assert.rejects(db.query("INSERT INTO accounts (username, rank_code) VALUES ('x_partner', 'PARTNER')"), 'rank lama tidak bisa dipakai lagi');
  } finally {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close();
    fs.rmSync(old, { recursive: true, force: true });
  }
});
