'use strict';
// Role v3 (final) lewat API dashboard asli + PostgreSQL:
//   RESELLER 10 · SUKI 50 · RAJA 100 · DEWA 1000 · DEVELOPER tanpa batas (kuota nomor).
//   MEMBER bukan akun website. Reseller/suki/raja/dewa HANYA kelola nomor + buat/hapus sub-role.
//   Operasi bot (password, enable/disable, ban, maintenance, cabut sesi) = DEVELOPER saja.
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
const addUser = (s, extra = {}) => t.as(s).post('/api/dash/accounts', { username: `a${Math.random().toString(36).slice(2, 10)}`, ...extra });
const fillBots = (ownerId, n) => t.db.query(`INSERT INTO bots (owner_id, bot_name, phone_number, created_by)
  SELECT $1, 'Isi ' || g, '7' || lpad(($1::bigint * 100000 + g)::text, 12, '0'), $1 FROM generate_series(1, $2) g`, [ownerId, n]);

it('RESELLER: nomor ke-10 diterima, ke-11 ditolak; nomor didaftarkan TANPA password (bukan otomatis)', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const first = await addBot(r);
  assert.equal(first.status, 200, first.text);
  assert.equal(first.json.bot.generated_password, undefined, 'tidak ada password yang dikembalikan');
  assert.equal(first.json.bot.password_set, false, 'nomor belum punya password; developer yang menetapkan');
  for (let i = 2; i <= 10; i++) assert.equal((await addBot(r)).status, 200, `bot ${i}`);
  const over = await addBot(r);
  assert.equal(over.status, 409); assert.equal(over.json.error, 'QUOTA_EXCEEDED'); assert.equal(over.json.limit, 10);
  assert.equal((await t.as(r).get('/api/dash/me')).json.quota.numbers.label, '10/10');
});

it('reseller tidak bisa menetapkan password bot (ditolak): password bot hanya DEVELOPER', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const res = await addBot(r, { password: 'MauPasswordIni9' });
  assert.equal(res.status, 403, res.text);
  assert.equal(res.json.error, 'PERMISSION_DENIED');
  // Nomor tidak ikut terbuat saat password ditolak.
  assert.equal((await t.as(r).get('/api/dash/me')).json.quota.numbers.label, '0/10');
});

it('DEVELOPER boleh menetapkan password bot saat menambah nomor (opsional) atau lewat tombol Password', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  // Tanpa password: nomor terdaftar, password belum diset.
  const bare = await addBot(dev);
  assert.equal(bare.status, 200, bare.text);
  assert.equal(bare.json.bot.password_set, false);
  // Dengan password di form tambah: langsung tersimpan (hanya hash; plaintext tidak dikembalikan).
  const withPw = await addBot(dev, { password: 'PasswordBot123' });
  assert.equal(withPw.status, 200, withPw.text);
  assert.equal(withPw.json.bot.password_set, true);
  assert.equal(withPw.json.bot.generated_password, undefined);
  assert.ok(!JSON.stringify(withPw.json).includes('PasswordBot123'), 'password bot tidak pernah dikirim balik');
  // DEVELOPER menetapkan password untuk nomor yang tadi kosong.
  const set = await t.as(dev).post(`/api/dash/bots/${bare.json.bot.id}/password`, { password: 'DitetapkanDev9' });
  assert.equal(set.status, 200, set.text);
  assert.ok((await t.as(dev).get('/api/dash/bots')).json.bots.find(b => b.id === bare.json.bot.id).password_set);
});

it('SUKI 50, RAJA 100, DEWA 1000, DEVELOPER tanpa batas', async () => {
  const suki = await t.login(await t.account('SUKI'));
  for (let i = 1; i <= 50; i++) assert.equal((await addBot(suki)).status, 200, `suki ${i}`);
  assert.equal((await addBot(suki)).json.limit, 50);
  for (const [rank, limit] of [['RAJA', 100], ['DEWA', 1000]]) {
    const acc = await t.account(rank); const s = await t.login(acc);
    await fillBots(acc.id, limit - 1);
    assert.equal((await addBot(s)).status, 200, `${rank} ke-${limit}`);
    const over = await addBot(s);
    assert.equal(over.status, 409); assert.equal(over.json.limit, limit);
  }
  const devAcc = await t.account('DEVELOPER'); const dev = await t.login(devAcc);
  await fillBots(devAcc.id, 1005);
  assert.equal((await addBot(dev)).status, 200);
  assert.equal((await t.as(dev).get('/api/dash/me')).json.quota.numbers.label, '1006/∞');
});

// Siapa boleh MEMBUAT & MENGHAPUS role apa.
const MATRIX = {
  RESELLER: { create: [], del: [] },
  SUKI: { create: ['RESELLER'], del: [] },
  RAJA: { create: ['RESELLER', 'SUKI'], del: ['RESELLER'] },
  DEWA: { create: ['RESELLER', 'SUKI', 'RAJA'], del: ['RESELLER', 'SUKI', 'RAJA'] },
  DEVELOPER: { create: ['RESELLER', 'SUKI', 'RAJA', 'DEWA'], del: ['RESELLER', 'SUKI', 'RAJA', 'DEWA'] }
};
const ALL = ['RESELLER', 'SUKI', 'RAJA', 'DEWA', 'DEVELOPER'];

for (const [actorRank, rule] of Object.entries(MATRIX)) {
  it(`${actorRank}: buat [${rule.create.join('/') || '-'}] hapus [${rule.del.join('/') || '-'}]; selain itu ditolak`, async () => {
    const actor = await t.login(await t.account(actorRank));
    for (const rank of ALL) {
      const res = await addUser(actor, { rank });
      if (rule.create.includes(rank)) assert.equal(res.status, 200, `${actorRank} buat ${rank}: ${res.text}`);
      else assert.equal(res.status, 403, `${actorRank} tidak boleh buat ${rank}`);
    }
    for (const rank of ALL.filter(r => r !== 'DEVELOPER')) {
      const target = await t.account(rank, { manager: actor.id });
      const res = await t.as(actor).del(`/api/dash/accounts/${target.id}`);
      if (rule.del.includes(rank)) assert.equal(res.status, 200, `${actorRank} hapus ${rank}: ${res.text}`);
      else assert.equal(res.status, 403, `${actorRank} tidak boleh hapus ${rank}`);
    }
  });
}

it('operasi bot (password, enable/disable, ban, maintenance, cabut sesi) HANYA developer', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const bot = (await addBot(r)).json.bot;
  const ops = [
    ['post', `/api/dash/bots/${bot.id}/password`, { password: 'PasswordBaru12' }],
    ['post', `/api/dash/bots/${bot.id}/enabled`, { enabled: false, reason: 'coba' }],
    ['post', `/api/dash/bots/${bot.id}/ban`, { banned: true, reason: 'coba' }],
    ['post', `/api/dash/bots/${bot.id}/maintenance`, { enabled: true, message: 'coba' }],
    ['post', `/api/dash/bots/${bot.id}/revoke`, {}]
  ];
  for (const [m, p, b] of ops) {
    const res = await t.as(r)[m](p, b);
    assert.equal(res.status, 403, `${p}`); assert.equal(res.json.error, 'PERMISSION_DENIED');
  }
  // Developer bisa.
  const dev = await t.login(await t.account('DEVELOPER'));
  assert.equal((await t.as(dev).post(`/api/dash/bots/${bot.id}/password`, { password: 'DevSetPass12' })).status, 200);
  assert.equal((await t.as(dev).post(`/api/dash/bots/${bot.id}/enabled`, { enabled: false, reason: 'oleh dev' })).status, 200);
});

it('rank DEVELOPER tidak bisa diberikan lewat website', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  assert.equal((await addUser(dev, { rank: 'DEVELOPER' })).status, 403);
  const raja = await t.account('RAJA', { manager: dev.id });
  assert.equal((await t.as(dev).post(`/api/dash/accounts/${raja.id}/rank`, { rank: 'DEVELOPER' })).status, 403);
});

it('menghapus nomor membebaskan slot', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await addBot(r)).json.bot.id);
  assert.equal((await addBot(r)).json.error, 'QUOTA_EXCEEDED');
  assert.equal((await t.as(r).del(`/api/dash/bots/${ids[0]}`)).status, 200);
  assert.equal((await addBot(r)).status, 200, 'slot bebas setelah hapus');
});

it('penurunan rank tidak menghapus nomor; penambahan diblokir; naik rank menambah kuota', async () => {
  const dewa = await t.login(await t.account('DEWA'));
  const sukiAcc = await t.account('SUKI', { manager: dewa.id });
  const suki = await t.login(sukiAcc);
  for (let i = 0; i < 12; i++) assert.equal((await addBot(suki)).status, 200);
  const down = await t.as(dewa).post(`/api/dash/accounts/${sukiAcc.id}/rank`, { rank: 'RESELLER' });
  assert.equal(down.status, 200, down.text); assert.equal(down.json.over_quota, true);
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [sukiAcc.id]))[0].n, 12);
  assert.equal((await addBot(suki)).json.limit, 10);
  assert.equal((await t.as(dewa).post(`/api/dash/accounts/${sukiAcc.id}/rank`, { rank: 'SUKI' })).status, 200);
  assert.equal((await addBot(suki)).status, 200);
});

it('request bersamaan tidak melewati batas (25 paralel untuk reseller kosong -> tepat 10)', async () => {
  const r = await t.login(await t.account('RESELLER'));
  const results = await Promise.all(Array.from({ length: 25 }, () => addBot(r)));
  assert.equal(results.filter(x => x.status === 200).length, 10);
  assert.equal(results.filter(x => x.json?.error === 'QUOTA_EXCEEDED').length, 15);
  assert.equal((await t.db.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [r.id]))[0].n, 10);
});

it('tempat tiap reseller terpisah: reseller A tidak bisa melihat/mengubah/menghapus nomor reseller B', async () => {
  const a = await t.login(await t.account('RESELLER'));   // "Budi"
  const b = await t.login(await t.account('RESELLER'));   // "Agus"
  const botA = (await addBot(a)).json.bot;
  const listB = (await t.as(b).get('/api/dash/bots')).json.bots;
  assert.ok(!listB.some(x => x.id === botA.id), 'nomor Budi tidak terlihat oleh Agus');
  assert.equal((await t.as(b).del(`/api/dash/bots/${botA.id}`)).json.error, 'OUT_OF_SCOPE');
  assert.equal((await addBot(b, { owner_id: a.id })).status, 403, 'tidak bisa menumpang kuota reseller lain');
});

it('DEWA hanya mengelola akun di bawahnya; DEWA lain di luar cakupan', async () => {
  const d1 = await t.login(await t.account('DEWA'));
  const d2 = await t.login(await t.account('DEWA'));
  const raja = await t.account('RAJA', { manager: d1.id });
  assert.equal((await t.as(d2).del(`/api/dash/accounts/${raja.id}`)).json.error, 'OUT_OF_SCOPE');
});

it('SUKI melihat reseller bawahannya, tapi tidak bisa menghapusnya (butuh izin hapus reseller = RAJA ke atas)', async () => {
  const suki = await t.login(await t.account('SUKI'));
  const res = (await addUser(suki, { rank: 'RESELLER' })).json.account;
  const list = (await t.as(suki).get('/api/dash/accounts')).json.accounts;
  assert.ok(list.some(x => x.id === res.id), 'reseller bawahan terlihat');
  assert.equal((await t.as(suki).del(`/api/dash/accounts/${res.id}`)).status, 403);
  const raja = await t.login(await t.account('RAJA'));
  const res2 = (await addUser(raja, { rank: 'RESELLER' })).json.account;
  assert.equal((await t.as(raja).del(`/api/dash/accounts/${res2.id}`)).status, 200);
});

it('migrasi 003+005: PARTNER/OWNER/CEO lama -> SUKI/RAJA/DEWA; MEMBER dihapus; data nomor utuh', { skip: h.skip }, async () => {
  const schema = 'ym_' + crypto.randomBytes(6).toString('hex');
  const admin = createDb({ connectionString: process.env.TEST_DATABASE_URL, max: 1 });
  await admin.query(`CREATE SCHEMA ${schema}`);
  const db = createDb({ connectionString: process.env.TEST_DATABASE_URL, schema, max: 2 });
  const old = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-'));
  try {
    const dir = path.join(__dirname, '..', '..', 'server', 'migrations');
    for (const f of ['001_core.sql', '002_ranks_permissions.sql']) fs.copyFileSync(path.join(dir, f), path.join(old, f));
    await migrate(db, { dir: old });
    const ins = (u, r) => db.query('INSERT INTO accounts (username, rank_code) VALUES ($1, $2) RETURNING id', [u, r]);
    const [p] = await ins('lama_partner', 'PARTNER'); await ins('lama_owner', 'OWNER'); await ins('lama_ceo', 'CEO'); await ins('lama_member', 'MEMBER');
    await db.query("INSERT INTO bots (owner_id, bot_name, phone_number, created_by) VALUES ($1, 'Bot lama', '6281299990000', $1)", [p.id]);
    await migrate(db, { dir });
    const rows = Object.fromEntries((await db.query('SELECT username, rank_code FROM accounts')).map(r => [r.username, r.rank_code]));
    assert.deepEqual(rows, { lama_partner: 'SUKI', lama_owner: 'RAJA', lama_ceo: 'DEWA' }, 'MEMBER lama dihapus, lainnya dipindah');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM bots'))[0].n, 1, 'nomor lama tetap ada');
    const ranks = Object.fromEntries((await db.query('SELECT code, max_numbers FROM ranks')).map(r => [r.code, r.max_numbers]));
    assert.deepEqual(ranks, { RESELLER: 10, SUKI: 50, RAJA: 100, DEWA: 1000, DEVELOPER: null });
    // Hanya DEVELOPER yang punya izin operasi bot setelah migrasi.
    const perms = (await db.query("SELECT permission_code FROM rank_permissions WHERE rank_code = 'RESELLER' ORDER BY 1")).map(r => r.permission_code);
    assert.deepEqual(perms, ['bot.view', 'number.create', 'number.delete']);
    await assert.rejects(db.query("INSERT INTO accounts (username, rank_code) VALUES ('x_member', 'MEMBER')"), 'MEMBER tidak bisa dipakai lagi');
  } finally {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.close();
    fs.rmSync(old, { recursive: true, force: true });
  }
});
