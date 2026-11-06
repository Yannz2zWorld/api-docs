'use strict';
// Beli plan: bayar pakai saldo (langsung aktif) atau transfer manual (DANA/GoPay/...) yang dicek developer.
const express = require('express');
const db = require('../lib/db');
const tiers = require('../lib/tiers');
const users = require('../lib/users');
const settings = require('../lib/settings');
const { requireUser, isDev } = require('../lib/auth');
const { wrap, fail } = require('../lib/http');

const r = express.Router();

r.get('/plans', wrap(async (req, res) => {
  const payments = (await settings.get('payments')) || [];
  res.json({ status: true, days: tiers.PLAN_DAYS, plans: tiers.publicTiers(), payments });
}));

r.post('/buy', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const t = tiers.BY_ID[req.body?.tier];
  if (!t || t.hidden || !tiers.isPaid(t.id)) return fail(res, 400, 'INVALID_TIER', 'Plan tidak tersedia.');
  if (isDev(u)) return fail(res, 400, 'ALREADY_DEVELOPER', 'Akun developer sudah unlock all.');
  const updated = await db.tx(async run => {
    const paid = await run('UPDATE users SET balance = balance - $2 WHERE id = $1 AND balance >= $2 RETURNING id', [u.id, t.price]);
    if (!paid.length) return null;
    await run("INSERT INTO orders (user_id, kind, tier, amount, method, status, decided_at) VALUES ($1, 'plan', $2, $3, 'saldo', 'approved', now())", [u.id, t.id, t.price]);
    return users.activatePlan(u.id, t.id, tiers.PLAN_DAYS, run);
  });
  if (!updated) return fail(res, 402, 'INSUFFICIENT_BALANCE', `Saldo kurang. Harga ${t.name} Rp${t.price.toLocaleString('id-ID')}.`);
  res.json({ status: true, message: `Plan ${t.name} aktif sampai ${new Date(updated.tier_expires_at).toLocaleDateString('id-ID', { dateStyle: 'long' })}.` });
}));

// Pesanan transfer manual: plan atau top up saldo.
r.post('/order', requireUser, wrap(async (req, res) => {
  const u = req._user;
  const { kind, tier, amount, method, sender, note } = req.body || {};
  const payments = (await settings.get('payments')) || [];
  const pm = payments.find(p => p.id === method);
  if (!pm) return fail(res, 400, 'INVALID_METHOD', 'Pilih metode pembayaran.');
  if (!sender || String(sender).trim().length < 2) return fail(res, 400, 'SENDER_REQUIRED', 'Isi nama/nomor pengirim supaya bisa dicek.');
  let price, tierId = null;
  if (kind === 'plan') {
    const t = tiers.BY_ID[tier];
    if (!t || t.hidden || !tiers.isPaid(t.id)) return fail(res, 400, 'INVALID_TIER', 'Plan tidak tersedia.');
    price = t.price; tierId = t.id;
  } else if (kind === 'topup') {
    price = Math.floor(Number(amount));
    if (!Number.isFinite(price) || price < 1000 || price > 10000000) return fail(res, 400, 'INVALID_AMOUNT', 'Top up minimal Rp1.000.');
  } else return fail(res, 400, 'INVALID_KIND', 'Jenis pesanan tidak valid.');
  const [{ n }] = await db.q("SELECT count(*)::int AS n FROM orders WHERE user_id = $1 AND status = 'pending'", [u.id]);
  if (n >= 3) return fail(res, 429, 'TOO_MANY_PENDING', 'Masih ada 3 pesanan menunggu. Tunggu dicek developer dulu ya.');
  const o = await db.one('INSERT INTO orders (user_id, kind, tier, amount, method, sender, note) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [u.id, kind, tierId, price, pm.name, String(sender).slice(0, 80), String(note || '').slice(0, 300) || null]);
  res.json({ status: true, orderId: String(o.id), message: 'Pesanan dibuat. Developer akan mengecek pembayaran kamu.' });
}));

r.post('/order/:id/cancel', requireUser, wrap(async (req, res) => {
  const rows = await db.q("UPDATE orders SET status = 'cancelled', decided_at = now() WHERE id = $1 AND user_id = $2 AND status = 'pending' RETURNING id", [req.params.id, req._user.id]);
  if (!rows.length) return fail(res, 404, 'NOT_FOUND', 'Pesanan tidak ditemukan.');
  res.json({ status: true });
}));

module.exports = r;
