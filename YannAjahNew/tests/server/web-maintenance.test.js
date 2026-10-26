'use strict';
// Maintenance WEB DATABASE (khusus DEVELOPER): website hanya untuk DEVELOPER dan semua bot berhenti
// total sampai dimatikan. Kontrol bot per nomor (disable / maintenance) tetap dari web.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let t;
before(async () => { if (!h.skip) t = await h.setup(); });
after(async () => { await t?.close(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('maintenance web: hanya DEVELOPER yang bisa mengatur; selain itu PERMISSION_DENIED', async () => {
  for (const rank of ['RESELLER', 'SUKI', 'KING', 'CEO']) {
    const s = await t.login(await t.account(rank));
    const r = await t.as(s).put('/api/dash/maintenance/web', { enabled: true, message: 'coba' });
    assert.equal(r.status, 403, rank); assert.equal(r.json.error, 'PERMISSION_DENIED');
  }
});

it('maintenance web aktif: akun non-developer diblokir (API & login), developer tetap bisa; bot berhenti total', async () => {
  const devAcc = await t.account('DEVELOPER');
  const dev = await t.login(devAcc);
  const res = (await t.as(dev).post('/api/dash/accounts', { username: `wm-${Date.now()}`, password: 'ResellerWm123', rank: 'RESELLER' })).json.account;
  const resSession = await t.login(res);
  const bot = (await t.as(dev).post('/api/dash/bots', { bot_name: 'WM', phone_number: h.phone(), owner_id: res.id, password: 'WmBotPass123' })).json.bot;
  const login = await t.request('POST', '/api/bot/auth/login', { body: { phone_number: bot.phone_number, password: 'WmBotPass123', instance_id: h.instanceId() } });
  assert.equal(login.status, 200, login.text);
  const auth = { authorization: `Bearer ${login.json.token}` };

  const on = await t.as(dev).put('/api/dash/maintenance/web', { enabled: true, message: 'Upgrade web database' });
  assert.equal(on.status, 200, on.text);
  assert.equal(on.json.maintenance.web_enabled, true);
  assert.equal(on.json.maintenance.web_updated_by, devAcc.id);

  // Website: reseller (sesi lama & login baru) ditolak, developer tetap bisa.
  const blocked = await t.as(resSession).get('/api/dash/me');
  assert.equal(blocked.status, 503); assert.equal(blocked.json.error, 'WEB_MAINTENANCE'); assert.equal(blocked.json.message, 'Upgrade web database');
  const relog = await t.request('POST', '/auth/login', { body: { login: res.username, password: 'ResellerWm123' } });
  assert.equal(relog.status, 503); assert.equal(relog.json.error, 'WEB_MAINTENANCE');
  assert.equal((await t.as(dev).get('/api/dash/me')).status, 200);
  const cfg = (await t.request('GET', '/auth/config')).json;
  assert.deepEqual(cfg.maintenance, { web: true, message: 'Upgrade web database' });

  // Bot: tetap boleh login/verify (tidak diban), tapi status maintenance 'web' = berhenti total.
  const v = (await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state;
  assert.deepEqual(v.maintenance, { active: true, scope: 'web', message: 'Upgrade web database' });
  assert.equal(v.allowed, true);

  // Matikan: semuanya kembali normal.
  const off = await t.as(dev).put('/api/dash/maintenance/web', { enabled: false });
  assert.equal(off.json.maintenance.web_enabled, false);
  assert.equal(off.json.maintenance.web_message, 'Upgrade web database', 'pesan disimpan');
  assert.equal((await t.as(resSession).get('/api/dash/me')).status, 200);
  assert.equal((await t.request('POST', '/auth/login', { body: { login: res.username, password: 'ResellerWm123' } })).status, 200);
  assert.deepEqual((await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state.maintenance, { active: false, scope: null, message: null });
  const audits = await t.db.query("SELECT action FROM audit_logs WHERE action = 'maintenance.web.update' AND actor_id = $1", [devAcc.id]);
  assert.equal(audits.length, 2);
});

it('dari web, DEVELOPER bisa mematikan bot mana saja dan maintenance per bot', async () => {
  const dev = await t.login(await t.account('DEVELOPER'));
  const owner = await t.account('CEO');
  const bot = (await t.as(dev).post('/api/dash/bots', { bot_name: 'Ctl', phone_number: h.phone(), owner_id: owner.id, password: 'CtlBotPass123' })).json.bot;
  const login = await t.request('POST', '/api/bot/auth/login', { body: { phone_number: bot.phone_number, password: 'CtlBotPass123', instance_id: h.instanceId() } });
  const auth = { authorization: `Bearer ${login.json.token}` };
  assert.equal((await t.as(dev).post(`/api/dash/bots/${bot.id}/maintenance`, { enabled: true, message: 'Bot ini maintenance' })).status, 200);
  assert.equal((await t.request('POST', '/api/bot/auth/verify', { headers: auth })).json.state.maintenance.scope, 'bot');
  assert.equal((await t.as(dev).post(`/api/dash/bots/${bot.id}/enabled`, { enabled: false, reason: 'dimatikan dari web' })).status, 200);
  assert.equal((await t.request('POST', '/api/bot/auth/verify', { headers: auth })).status, 401, 'sesi bot dicabut saat dimatikan');
});
