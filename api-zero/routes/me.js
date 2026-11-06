'use strict';
const express = require('express');
const db = require('../lib/db');
const users = require('../lib/users');
const keys = require('../lib/keys');
const { requireUser, publicUser, setSession } = require('../lib/auth');
const { verifyPassword, hashPassword } = require('../lib/crypto');
const { wrap, fail } = require('../lib/http');

const r = express.Router();

r.get('/me', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const lim = keys.limits(u);
  const [used, myKeys, orders] = await Promise.all([
    keys.usageToday(u.id), keys.listKeys(u.id),
    db.q('SELECT id, kind, tier, amount, method, status, admin_note, created_at FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 20', [u.id])
  ]);
  res.json({
    status: true,
    user: publicUser(u, { self: true }),
    plan: { id: lim.tier.id, name: lim.tier.name, daily: lim.daily === Infinity ? null : lim.daily, maxKeys: lim.maxKeys === Infinity ? null : lim.maxKeys, customKey: lim.customKey, rank: lim.tier.rank },
    usage: { today: used, limit: lim.daily === Infinity ? null : lim.daily },
    keys: myKeys,
    orders: orders.map(o => ({ ...o, id: String(o.id), amount: Number(o.amount) }))
  });
}));

r.patch('/me', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const username = String(req.body?.username || '').toLowerCase().trim();
  if (!users.USERNAME_RE.test(username)) return fail(res, 400, 'INVALID_USERNAME', 'Username 3–20 karakter: huruf kecil, angka, atau _.');
  if (await users.blacklisted(username)) return fail(res, 400, 'USERNAME_BLOCKED', 'Username itu tidak bisa dipakai.');
  try { await db.q('UPDATE users SET username = $2 WHERE id = $1', [u.id, username]); }
  catch (e) { if (e.code === '23505') return fail(res, 409, 'USERNAME_TAKEN', 'Username sudah dipakai.'); throw e; }
  res.json({ status: true, message: 'Username diganti.' });
}));

r.post('/me/password', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const { current, password } = req.body || {};
  if (!password || String(password).length < 6) return fail(res, 400, 'INVALID_PASSWORD', 'Sandi baru minimal 6 karakter.');
  if (u.password_hash && !verifyPassword(String(current || ''), u.password_hash)) return fail(res, 400, 'WRONG_PASSWORD', 'Sandi lama salah.');
  const nu = await db.one('UPDATE users SET password_hash = $2, session_version = session_version + 1 WHERE id = $1 RETURNING *', [u.id, hashPassword(String(password))]);
  setSession(req, res, nu);   // sesi lain keluar, sesi ini tetap login
  res.json({ status: true, message: 'Sandi berhasil diganti.' });
}));

// Foto profil: data URL gambar (dikecilkan di browser), maks 300 KB.
r.post('/me/avatar', requireUser, wrap(async (req, res) => {
  const m = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.image || ''));
  if (!m) return fail(res, 400, 'INVALID_IMAGE', 'File harus gambar PNG/JPG/WEBP/GIF.');
  if (Buffer.byteLength(m[2], 'base64') > 300 * 1024) return fail(res, 413, 'IMAGE_TOO_LARGE', 'Foto maksimal 300 KB.');
  await db.q('UPDATE users SET avatar = $2, avatar_v = avatar_v + 1 WHERE id = $1', [req._user.id, req.body.image]);
  res.json({ status: true, message: 'Foto profil diganti.' });
}));
r.delete('/me/avatar', requireUser, wrap(async (req, res) => {
  await db.q('UPDATE users SET avatar = NULL, avatar_v = avatar_v + 1 WHERE id = $1', [req._user.id]);
  res.json({ status: true });
}));

r.get('/u/:pid/avatar', wrap(async (req, res) => {
  const row = await db.one('SELECT avatar FROM users WHERE public_id = $1', [req.params.pid]);
  const m = row?.avatar && /^data:(image\/[a-z]+);base64,(.+)$/.exec(row.avatar);
  if (!m) return res.status(404).end();
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.type(m[1]).send(Buffer.from(m[2], 'base64'));
}));

// API key
r.post('/me/keys', requireUser, wrap(async (req, res) => {
  const key = await keys.createKey(req._user, { label: req.body?.label, custom: req.body?.custom ? String(req.body.custom).trim() : null });
  res.json({ status: true, key });
}));
r.delete('/me/keys/:id', requireUser, wrap(async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return fail(res, 400, 'INVALID_ID', 'ID key tidak valid.');
  const rows = await keys.deleteKey(req._user.id, req.params.id);
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'Key tidak ditemukan.');
  res.json({ status: true });
}));

// Profil publik (dipakai live chat).
r.get('/u/:pid', requireUser, wrap(async (req, res) => {
  const u = await db.one('SELECT * FROM users WHERE public_id = $1', [req.params.pid]);
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User tidak ditemukan.');
  res.json({ status: true, user: publicUser(u) });
}));

module.exports = r;
