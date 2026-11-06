'use strict';
// Developer panel API (khusus developer).
const express = require('express');
const db = require('../lib/db');
const users = require('../lib/users');
const keys = require('../lib/keys');
const tiers = require('../lib/tiers');
const settings = require('../lib/settings');
const endpoints = require('../lib/endpoints');
const PROVIDERS = require('../lib/providers');
const { requireDev, publicUser } = require('../lib/auth');
const { hashPassword, randomToken } = require('../lib/crypto');
const { wrap, fail } = require('../lib/http');

const r = express.Router();
r.use(requireDev);

const userRow = u => ({ ...publicUser(u, { self: true }), dbId: String(u.id), banned: u.banned, banReason: u.ban_reason, rawTier: u.tier, createdAt: u.created_at, lastLoginAt: u.last_login_at });

// ---------------------------------------------------------------- statistik
r.get('/stats', wrap(async (req, res) => {
  const [s] = await db.q(`SELECT
    (SELECT count(*) FROM users)::int AS users,
    (SELECT count(*) FROM users WHERE banned)::int AS banned,
    (SELECT count(*) FROM users WHERE tier NOT IN ('free','developer') AND tier_expires_at > now())::int AS paid,
    (SELECT coalesce(sum(count),0) FROM usage_daily WHERE day = $1)::int AS requests_today,
    (SELECT count(*) FROM orders WHERE status = 'pending')::int AS pending_orders,
    (SELECT count(*) FROM api_keys)::int AS keys`, [keys.today()]);
  const eps = await endpoints.listForDeveloper();
  res.json({ status: true, stats: { ...s, endpoints: eps.filter(e => !e.deleted).length, locked: eps.filter(e => e.locked && !e.deleted).length, hidden: eps.filter(e => e.hidden && !e.deleted).length }, maintenance: await settings.get('maintenance') });
}));

// ---------------------------------------------------------------- users
r.get('/users', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const page = Math.max(0, Number(req.query.page) || 0);
  const where = q ? 'WHERE username ILIKE $1 OR email ILIKE $1 OR public_id ILIKE $1 OR phone ILIKE $1' : '';
  const params = q ? [`%${q}%`] : [];
  const rows = await db.q(`SELECT * FROM users ${where} ORDER BY id DESC LIMIT 50 OFFSET ${page * 50}`, params);
  const [{ n }] = await db.q(`SELECT count(*)::int AS n FROM users ${where}`, params);
  const ids = rows.map(r => r.id);
  const usage = ids.length ? await db.q('SELECT user_id, count FROM usage_daily WHERE day = $1 AND user_id = ANY($2)', [keys.today(), ids]) : [];
  const um = new Map(usage.map(x => [String(x.user_id), x.count]));
  res.json({ status: true, total: n, users: rows.map(u => ({ ...userRow(u), usageToday: um.get(String(u.id)) || 0 })) });
}));

r.post('/users', wrap(async (req, res) => {
  const { username, password, email, phone, tier = 'free', days } = req.body || {};
  users.validate({ username: String(username || '').toLowerCase().trim(), password, email, phone });
  if (!tiers.BY_ID[tier]) return fail(res, 400, 'INVALID_TIER', 'Plan tidak dikenal.');
  const u = await users.create({ username, password, email, phone, tier, days: Number(days) || tiers.PLAN_DAYS });
  await keys.createKey(u, { label: 'Default' }).catch(() => {});
  res.json({ status: true, user: userRow(u) });
}));

const findUser = id => db.one('SELECT * FROM users WHERE public_id = $1', [id]);

r.patch('/users/:pid', wrap(async (req, res) => {
  let u = await findUser(req.params.pid);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User tidak ditemukan.');
  const b = req.body || {};
  if (b.tier !== undefined) {
    if (!tiers.BY_ID[b.tier]) return fail(res, 400, 'INVALID_TIER', 'Plan tidak dikenal.');
    if (tiers.isPaid(b.tier)) {
      const days = Math.max(1, Math.min(3650, Number(b.days) || tiers.PLAN_DAYS));
      u = await db.one(`UPDATE users SET tier = $2, tier_expires_at = now() + ($3 || ' days')::interval WHERE id = $1 RETURNING *`, [u.id, b.tier, String(days)]);
    } else u = await users.activatePlan(u.id, b.tier);
  }
  if (b.balanceDelta !== undefined) {
    const d = Math.trunc(Number(b.balanceDelta));
    if (!Number.isFinite(d)) return fail(res, 400, 'INVALID_AMOUNT', 'Jumlah saldo tidak valid.');
    u = await db.one('UPDATE users SET balance = GREATEST(balance + $2, 0) WHERE id = $1 RETURNING *', [u.id, d]);
  }
  if (b.username !== undefined) {
    const name = String(b.username).toLowerCase().trim();
    if (!users.USERNAME_RE.test(name)) return fail(res, 400, 'INVALID_USERNAME', 'Username tidak valid.');
    try { u = await db.one('UPDATE users SET username = $2 WHERE id = $1 RETURNING *', [u.id, name]); }
    catch (e) { if (e.code === '23505') return fail(res, 409, 'USERNAME_TAKEN', 'Username sudah dipakai.'); throw e; }
  }
  if (b.password) {
    if (String(b.password).length < 6) return fail(res, 400, 'INVALID_PASSWORD', 'Sandi minimal 6 karakter.');
    u = await db.one('UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING *', [u.id, hashPassword(String(b.password))]);
  }
  if (b.banned !== undefined) {
    if (b.banned && u.id === req._user.id) return fail(res, 400, 'SELF', 'Tidak bisa ban akun sendiri.');
    u = await db.one('UPDATE users SET banned = $2, ban_reason = $3, session_version = session_version + 1 WHERE id = $1 RETURNING *', [u.id, Boolean(b.banned), b.banned ? String(b.reason || '').slice(0, 200) || null : null]);
    if (b.banned && b.blacklist) {
      for (const [kind, value] of [['email', u.email], ['phone', u.phone], ['username', u.username]]) {
        if (value) await db.q('INSERT INTO blacklist (value, kind, reason) VALUES ($1, $2, $3) ON CONFLICT (value) DO NOTHING', [value.toLowerCase(), kind, u.ban_reason]);
      }
    }
  }
  res.json({ status: true, user: userRow(u) });
}));

r.delete('/users/:pid', wrap(async (req, res) => {
  const u = await findUser(req.params.pid);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User tidak ditemukan.');
  if (u.id === req._user.id) return fail(res, 400, 'SELF', 'Tidak bisa menghapus akun sendiri.');
  await db.q('DELETE FROM users WHERE id = $1', [u.id]);
  res.json({ status: true });
}));

// ---------------------------------------------------------------- blacklist
r.get('/blacklist', wrap(async (req, res) => res.json({ status: true, items: await db.q('SELECT value, kind, reason, created_at FROM blacklist ORDER BY created_at DESC LIMIT 500') })));
r.post('/blacklist', wrap(async (req, res) => {
  const value = String(req.body?.value || '').toLowerCase().trim();
  const kind = ['email', 'phone', 'username'].includes(req.body?.kind) ? req.body.kind : 'username';
  if (!value) return fail(res, 400, 'INVALID_INPUT', 'Isi nilai yang mau diblokir.');
  await db.q('INSERT INTO blacklist (value, kind, reason) VALUES ($1, $2, $3) ON CONFLICT (value) DO UPDATE SET reason = EXCLUDED.reason', [kind === 'phone' ? users.normPhone(value) : value, kind, String(req.body?.reason || '').slice(0, 200) || null]);
  res.json({ status: true });
}));
r.delete('/blacklist', wrap(async (req, res) => {
  await db.q('DELETE FROM blacklist WHERE value = $1', [String(req.query.value || '').toLowerCase()]);
  res.json({ status: true });
}));

// ---------------------------------------------------------------- endpoints
r.get('/endpoints', wrap(async (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  let list = await endpoints.listForDeveloper();
  if (q) list = list.filter(e => `${e.name} ${e.path} ${e.category} ${e.desc} ${e.server}`.toLowerCase().includes(q));
  res.json({ status: true, total: list.length, plans: tiers.ENDPOINT_PLANS, servers: [...Object.keys(PROVIDERS), 'custom'], endpoints: list });
}));

// Atur plan / kunci / sembunyikan / hapus / pulihkan endpoint.
r.patch('/endpoints', wrap(async (req, res) => {
  const b = req.body || {};
  const ep = (await endpoints.listForDeveloper()).find(e => e.path.toLowerCase() === String(b.path || '').toLowerCase());
  if (!ep) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  if (b.plan !== undefined && !tiers.ENDPOINT_PLANS.includes(b.plan)) return fail(res, 400, 'INVALID_PLAN', 'Plan tidak dikenal.');
  const cur = await db.one('SELECT * FROM endpoint_settings WHERE path = $1', [ep.path]) || {};
  const next = {
    plan: b.plan !== undefined ? b.plan : cur.plan || null,
    locked: b.locked !== undefined ? Boolean(b.locked) : Boolean(cur.locked),
    hidden: b.hidden !== undefined ? Boolean(b.hidden) : Boolean(cur.hidden),
    deleted: b.deleted !== undefined ? Boolean(b.deleted) : Boolean(cur.deleted)
  };
  await db.q(`INSERT INTO endpoint_settings (path, plan, locked, hidden, deleted, updated_at) VALUES ($1,$2,$3,$4,$5, now())
    ON CONFLICT (path) DO UPDATE SET plan = EXCLUDED.plan, locked = EXCLUDED.locked, hidden = EXCLUDED.hidden, deleted = EXCLUDED.deleted, updated_at = now()`,
    [ep.path, next.plan, next.locked, next.hidden, next.deleted]);
  endpoints.invalidate();
  res.json({ status: true });
}));

// Hapus: endpoint buatan sendiri dihapus permanen, endpoint bawaan ditandai terhapus (bisa dipulihkan).
r.delete('/endpoints', wrap(async (req, res) => {
  const path = String(req.query.path || '');
  const del = await db.q('DELETE FROM custom_endpoints WHERE lower(path) = lower($1) RETURNING path', [path]);
  if (!del.length) {
    if (!endpoints.builtinPaths().has(path.toLowerCase())) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
    await db.q(`INSERT INTO endpoint_settings (path, deleted) VALUES ($1, true) ON CONFLICT (path) DO UPDATE SET deleted = true, updated_at = now()`, [(await endpoints.listForDeveloper()).find(e => e.path.toLowerCase() === path.toLowerCase()).path]);
  } else await db.q('DELETE FROM endpoint_settings WHERE path = $1', [del[0].path]);
  endpoints.invalidate();
  res.json({ status: true });
}));

const PATH_RE = /^\/api\/[a-z0-9-]{2,30}\/[a-z0-9.-]{1,60}$/;
function readSpec(b) {
  const path = String(b.path || '').trim().toLowerCase();
  if (!PATH_RE.test(path)) throw Object.assign(new Error('Path harus /api/(path)/(fitur), huruf kecil/angka/-.'), { status: 400, code: 'INVALID_PATH' });
  const server = String(b.server || 'custom');
  if (server !== 'custom' && !PROVIDERS[server]) throw Object.assign(new Error('Server tidak dikenal.'), { status: 400, code: 'INVALID_SERVER' });
  const spec = {
    server, path,
    name: String(b.name || '').trim().slice(0, 60),
    desc: String(b.desc || '').trim().slice(0, 300),
    category: String(b.category || '').trim().slice(0, 30) || 'Tools',
    output: ['json', 'image', 'video', 'audio'].includes(b.output) ? b.output : 'json',
    plan: tiers.ENDPOINT_PLANS.includes(b.plan) ? b.plan : 'free',
    params: (Array.isArray(b.params) ? b.params : []).slice(0, 15).map(p => ({
      name: String(p.name || '').trim().slice(0, 30), required: Boolean(p.required),
      placeholder: String(p.placeholder || '').slice(0, 120),
      ...(Array.isArray(p.options) && p.options.length ? { options: p.options.map(String).slice(0, 30) } : {})
    })).filter(p => /^[A-Za-z0-9_]+$/.test(p.name)),
    sample: b.sample && typeof b.sample === 'object' ? b.sample : null
  };
  if (!spec.name) throw Object.assign(new Error('Nama endpoint wajib diisi.'), { status: 400, code: 'INVALID_NAME' });
  if (server === 'custom') {
    let u; try { u = new URL(String(b.url || '')); } catch {}
    if (!u || !/^https?:$/.test(u.protocol)) throw Object.assign(new Error('URL tujuan harus http(s)://...'), { status: 400, code: 'INVALID_URL' });
    spec.url = u.href;
    if (b.keyValue) { spec.keyValue = String(b.keyValue).slice(0, 200); spec.keyParam = String(b.keyParam || 'apikey').slice(0, 40); spec.keyMode = b.keyMode === 'header' ? 'header' : 'query'; }
  } else {
    const up = String(b.upstream || '').trim();
    if (!/^\/[\w./-]{1,120}$/.test(up)) throw Object.assign(new Error('Path di server sumber harus diawali / (mis. /ai/gpt).'), { status: 400, code: 'INVALID_UPSTREAM' });
    spec.upstream = up;
  }
  return spec;
}

r.post('/endpoints', wrap(async (req, res) => {
  const spec = readSpec(req.body || {});
  if (endpoints.builtinPaths().has(spec.path) && !req.body.replace) return fail(res, 409, 'PATH_EXISTS', 'Path itu sudah dipakai endpoint bawaan.');
  const rows = await db.q('INSERT INTO custom_endpoints (path, spec) VALUES ($1, $2) ON CONFLICT (path) DO NOTHING RETURNING path', [spec.path, JSON.stringify(spec)]);
  if (!rows.length) return fail(res, 409, 'PATH_EXISTS', 'Path itu sudah ada.');
  await db.q('DELETE FROM endpoint_settings WHERE path = $1', [spec.path]);
  endpoints.invalidate();
  res.json({ status: true, path: spec.path });
}));
r.put('/endpoints', wrap(async (req, res) => {
  const spec = readSpec(req.body || {});
  const old = String(req.body.originalPath || spec.path);
  const ex = await db.one('SELECT spec FROM custom_endpoints WHERE path = $1', [old]);
  if (!ex) return fail(res, 404, 'NOT_FOUND', 'Hanya endpoint buatan sendiri yang bisa diedit penuh.');
  if (spec.server === 'custom' && !req.body.keyValue && ex.spec.keyValue) Object.assign(spec, { keyValue: ex.spec.keyValue, keyParam: ex.spec.keyParam, keyMode: ex.spec.keyMode });
  await db.tx(async run => {
    await run('DELETE FROM custom_endpoints WHERE path = $1', [old]);
    await run('INSERT INTO custom_endpoints (path, spec) VALUES ($1, $2)', [spec.path, JSON.stringify(spec)]);
  });
  endpoints.invalidate();
  res.json({ status: true, path: spec.path });
}));
r.get('/endpoints/custom', wrap(async (req, res) => {
  const row = await db.one('SELECT spec FROM custom_endpoints WHERE path = $1', [String(req.query.path || '')]);
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  const { keyValue, ...spec } = row.spec;
  res.json({ status: true, spec: { ...spec, hasKey: Boolean(keyValue) } });
}));

// ---------------------------------------------------------------- maintenance & pembayaran
r.put('/maintenance', wrap(async (req, res) => {
  const value = { on: Boolean(req.body?.on), message: String(req.body?.message || '').trim().slice(0, 500) || 'Server lagi maintenance sebentar ya.' };
  res.json({ status: true, maintenance: await settings.set('maintenance', value) });
}));

r.get('/payments', wrap(async (req, res) => res.json({ status: true, payments: (await settings.get('payments')) || [] })));
r.put('/payments', wrap(async (req, res) => {
  const list = (Array.isArray(req.body?.payments) ? req.body.payments : []).slice(0, 20).map(p => ({
    id: String(p.id || '').match(/^[a-z0-9-]{2,30}$/) ? p.id : 'pm-' + randomToken(6).toLowerCase(),
    name: String(p.name || '').trim().slice(0, 30),
    holder: String(p.holder || '').trim().slice(0, 60),
    number: String(p.number || '').trim().slice(0, 60),
    note: String(p.note || '').trim().slice(0, 200)
  })).filter(p => p.name && p.number);
  res.json({ status: true, payments: await settings.set('payments', list) });
}));

// ---------------------------------------------------------------- pesanan
r.get('/orders', wrap(async (req, res) => {
  const status = ['pending', 'approved', 'rejected', 'cancelled'].includes(req.query.status) ? req.query.status : null;
  const rows = await db.q(`SELECT o.*, u.username, u.public_id FROM orders o JOIN users u ON u.id = o.user_id ${status ? 'WHERE o.status = $1' : ''} ORDER BY o.id DESC LIMIT 100`, status ? [status] : []);
  res.json({ status: true, orders: rows.map(o => ({ ...o, id: String(o.id), user_id: undefined, amount: Number(o.amount) })) });
}));
r.post('/orders/:id/:action(approve|reject)', wrap(async (req, res) => {
  const result = await db.tx(async run => {
    const [o] = await run("SELECT * FROM orders WHERE id = $1 AND status = 'pending' FOR UPDATE", [req.params.id]);
    if (!o) return null;
    const approve = req.params.action === 'approve';
    await run('UPDATE orders SET status = $2, admin_note = $3, decided_at = now() WHERE id = $1', [o.id, approve ? 'approved' : 'rejected', String(req.body?.note || '').slice(0, 200) || null]);
    if (approve && o.kind === 'plan') await users.activatePlan(o.user_id, o.tier, tiers.PLAN_DAYS, run);
    if (approve && o.kind === 'topup') await run('UPDATE users SET balance = balance + $2 WHERE id = $1', [o.user_id, o.amount]);
    return true;
  });
  if (!result) return fail(res, 404, 'NOT_FOUND', 'Pesanan tidak ditemukan atau sudah diproses.');
  res.json({ status: true });
}));

module.exports = r;
