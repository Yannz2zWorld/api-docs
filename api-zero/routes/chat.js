'use strict';
// Live chat: satu ruang obrolan untuk semua user + developer. Polling tiap beberapa detik.
const express = require('express');
const db = require('../lib/db');
const { requireUser, publicUser, isDev } = require('../lib/auth');
const { wrap, fail } = require('../lib/http');

const r = express.Router();
const lastPost = new Map();

function shape(row) {
  const u = { id: row.user_id, public_id: row.public_id, username: row.username, avatar: row.avatar_set ? 'x' : null, avatar_v: row.avatar_v, tier: row.tier, tier_expires_at: row.tier_expires_at, email: row.email, created_at: row.user_created };
  return { id: String(row.id), text: row.text, at: row.created_at, user: publicUser(u) };
}
const SELECT = `SELECT m.id, m.text, m.created_at, m.user_id, u.public_id, u.username, (u.avatar IS NOT NULL) AS avatar_set, u.avatar_v, u.tier, u.tier_expires_at, u.email, u.created_at AS user_created
  FROM chat_messages m JOIN users u ON u.id = m.user_id`;

r.get('/messages', requireUser, wrap(async (req, res) => {
  const after = /^\d+$/.test(String(req.query.after || '')) ? req.query.after : null;
  const rows = after
    ? await db.q(`${SELECT} WHERE m.id > $1 ORDER BY m.id ASC LIMIT 100`, [after])
    : (await db.q(`${SELECT} ORDER BY m.id DESC LIMIT 60`)).reverse();
  res.json({ status: true, me: req._user.public_id, developer: isDev(req._user), messages: rows.map(shape) });
}));

r.post('/messages', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const text = String(req.body?.text || '').trim().replace(/\s{3,}/g, '  ');
  if (!text) return fail(res, 400, 'EMPTY', 'Pesan kosong.');
  if (text.length > 500) return fail(res, 400, 'TOO_LONG', 'Pesan maksimal 500 karakter.');
  const last = lastPost.get(u.id) || 0;
  if (!isDev(u) && Date.now() - last < 2000) return fail(res, 429, 'SLOW_DOWN', 'Pelan-pelan ya, tunggu 2 detik.');
  lastPost.set(u.id, Date.now());
  const row = await db.one('INSERT INTO chat_messages (user_id, text) VALUES ($1, $2) RETURNING id', [u.id, text]);
  // Bersih-bersih sesekali: pesan lebih dari 30 hari dihapus.
  if (Number(row.id) % 100 === 0) db.q("DELETE FROM chat_messages WHERE created_at < now() - interval '30 days'").catch(() => {});
  res.json({ status: true, id: String(row.id) });
}));

r.delete('/messages/:id', requireUser, wrap(async (req, res) => {
  const u = req._user;
  if (!/^\d+$/.test(req.params.id)) return fail(res, 400, 'INVALID_ID', 'ID tidak valid.');
  const rows = isDev(u)
    ? await db.q('DELETE FROM chat_messages WHERE id = $1 RETURNING id', [req.params.id])
    : await db.q('DELETE FROM chat_messages WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, u.id]);
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'Pesan tidak ditemukan.');
  res.json({ status: true });
}));

module.exports = r;
