'use strict';
// Master prompt §15.A — rank dan kuota (lewat API dashboard asli + PostgreSQL).
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let t;
before(async () => { if (!h.skip) t = await h.setup(); });
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

const addBot = (s, extra = {}) => t.as(s).post('/api/dash/bots', { bot_name: 'Bot', phone_number: h.phone(), ...extra });
const addUser = (s, extra = {}) => t.as(s).post('/api/dash/accounts', { username: `m${Math.random().toString(36).slice(2, 10)}`, ...extra });

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

it('PARTNER: resource ke-50 diterima, ke-51 ditolak (nomor dan user)', async () => {
  const p = await t.login(await t.account('PARTNER'));
  for (let i = 1; i <= 50; i++) assert.equal((await addBot(p)).status, 200, `bot ${i}`);
  assert.equal((await addBot(p)).json.error, 'QUOTA_EXCEEDED');
  for (let i = 1; i <= 50; i++) assert.equal((await addUser(p)).status, 200, `user ${i}`);
  assert.equal((await addUser(p)).json.error, 'QUOTA_EXCEEDED');
});

for (const rank of ['OWNER', 'CEO', 'DEVELOPER']) {
  it(`${rank}: tidak ada batas kuota numerik (55 nomor + 55 user, label ∞)`, async () => {
    const s = await t.login(await t.account(rank));
    for (let i = 0; i < 55; i++) assert.equal((await addBot(s)).status, 200);
    for (let i = 0; i < 55; i++) assert.equal((await addUser(s)).status, 200);
    const me = await t.as(s).get('/api/dash/me');
    assert.equal(me.json.quota.numbers.label, '55/∞');
    assert.equal(me.json.quota.users.label, '55/∞');
  });
}

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

it('penurunan rank tidak menghapus data; penambahan diblokir sampai di bawah batas; perubahan rank langsung mengubah kuota', async () => {
  const ceo = await t.login(await t.account('CEO'));
  const partnerAcc = await t.account('PARTNER', { manager: ceo.id });
  const partner = await t.login(partnerAcc);
  for (let i = 0; i < 12; i++) assert.equal((await addBot(partner)).status, 200);
  // Turun ke RESELLER (batas 10): 12 bot tetap ada, tambah ditolak.
  const down = await t.as(ceo).post(`/api/dash/accounts/${partnerAcc.id}/rank`, { rank: 'RESELLER' });
  assert.equal(down.status, 200, down.text);
  assert.equal(down.json.over_quota, true);
  const count = (await t.db.query('SELECT count(*)::int AS n FROM bots WHERE owner_id = $1 AND deleted_at IS NULL', [partnerAcc.id]))[0].n;
  assert.equal(count, 12, 'data tidak dihapus otomatis');
  const blocked = await addBot(partner);
  assert.equal(blocked.json.error, 'QUOTA_EXCEEDED');
  assert.equal(blocked.json.limit, 10);
  // Naik lagi ke PARTNER: kuota efektif 50, tambah diterima.
  assert.equal((await t.as(ceo).post(`/api/dash/accounts/${partnerAcc.id}/rank`, { rank: 'PARTNER' })).status, 200);
  assert.equal((await addBot(partner)).status, 200);
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
  for (const [method, path, body] of [
    ['patch', `/api/dash/bots/${botA.id}`, { bot_name: 'curian' }],
    ['post', `/api/dash/bots/${botA.id}/password`, { password: 'PasswordBaru123' }],
    ['post', `/api/dash/bots/${botA.id}/revoke`, {}],
    ['del', `/api/dash/bots/${botA.id}`],
    ['patch', `/api/dash/accounts/${userA.id}`, { display_name: 'x' }],
    ['del', `/api/dash/accounts/${userA.id}`]
  ]) {
    const res = await t.as(b)[method](path, body);
    assert.equal(res.status, 403, `${method} ${path} harus ditolak`);
    assert.equal(res.json.error, 'OUT_OF_SCOPE');
  }
  assert.equal((await t.as(b).get(`/api/dash/accounts/${userA.id}`)).status, 403);
  const listB = (await t.as(b).get('/api/dash/bots')).json.bots;
  assert.ok(!listB.some(x => x.id === botA.id), 'bot reseller lain tidak terlihat');
  // Reseller tidak bisa memakai kuota reseller lain lewat owner_id.
  const viaOwner = await addBot(b, { owner_id: a.id });
  assert.equal(viaOwner.status, 403);
});

it('aturan hierarki rank: reseller tidak bisa membuat reseller/partner, partner bisa membuat reseller tapi bukan owner', async () => {
  const r = await t.login(await t.account('RESELLER'));
  assert.equal((await addUser(r, { rank: 'RESELLER' })).json.error, 'PERMISSION_DENIED');
  assert.equal((await addUser(r, { rank: 'PARTNER' })).json.error, 'PERMISSION_DENIED');
  const p = await t.login(await t.account('PARTNER'));
  const res = await addUser(p, { rank: 'RESELLER' });
  assert.equal(res.status, 200); assert.equal(res.json.account.rank_code, 'RESELLER');
  assert.equal((await addUser(p, { rank: 'PARTNER' })).json.error, 'PERMISSION_DENIED');
  assert.equal((await addUser(p, { rank: 'OWNER' })).json.error, 'PERMISSION_DENIED');
  // Partner menghapus reseller dalam cakupannya.
  assert.equal((await t.as(p).del(`/api/dash/accounts/${res.json.account.id}`)).status, 200);
});
