'use strict';
const express = require('express');
const crypto = require('crypto');
const path = require('path');
const settings = require('../settings');
const { query, healthCheck, checkSchema } = require('../lib/db');
const { classifyDatabaseError, missingAuthConfig } = require('../lib/authErrors');
const users = require('../services/userService');
const keys = require('../services/apiKeyService');
const tiers = require('../services/tierService');
const usage = require('../services/usageService');
const audit = require('../services/auditService');
const pakasir = require('../services/pakasirService');
const notifier = require('../services/ownerNotificationService');
const orderService = require('../services/orderService');
const emailService = require('../services/emailService');
const passwords = require('../services/passwordService');
const activity = require('../services/activityService');
const pluginService = require('../services/githubPluginService');

const router = express.Router();
const VIEWS = path.join(__dirname, '..', 'views');
const { parseProofImage, parseAvatarImage } = require('../lib/proofImage');
const { digest } = require('../lib/keyCrypto');
const QRCode = require('qrcode');

// Manual methods: QRIS (the owner's static QRIS image), DANA and GoPay transfers.
const MANUAL_METHODS = ['QRIS', 'DANA', 'GOPAY'];
const MAX_PENDING_ORDERS = 5;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const fail = (res, status, error, message, extra = {}) => res.status(status).json({ success: false, error, message, ...extra });
const ip = req => (req.ip || '').replace(/^::ffff:/, '').slice(0, 45) || null;
const finite = v => (Number.isFinite(v) ? v : null);

// State-changing requests must come from our own pages. The session cookie is SameSite=Lax
// (not sent on cross-site POST), and this also rejects cross-site Origin / Sec-Fetch-Site.
function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return fail(res, 403, 'CSRF_BLOCKED', 'Permintaan lintas-origin ditolak.');
  if (req.get('sec-fetch-site') === 'cross-site') return fail(res, 403, 'CSRF_BLOCKED', 'Permintaan lintas-origin ditolak.');
  next();
}

async function loadAccount(req) {
  const session = req.app.locals.getSession(req);
  if (!session) return { error: [401, 'AUTH_REQUIRED', 'Silakan login.'] };
  const user = await users.getUserForSession(session);
  if (!user) return { error: [401, 'AUTH_REQUIRED', 'Akun tidak ditemukan. Silakan login lagi.'] };
  if (user.status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun tidak aktif.'] };
  return { user };
}

function auth(req, res, next) {
  loadAccount(req).then(r => {
    if (r.error) return fail(res, ...r.error);
    req.account = r.user;
    next();
  }).catch(next);
}

// HTML pages: send unauthenticated visitors to the login page instead of a JSON error.
function pageAuth(req, res, next) {
  loadAccount(req).then(r => {
    if (r.error) return res.redirect(r.error[1] === 'ACCOUNT_RESTRICTED' ? '/?auth=restricted' : '/');
    req.account = r.user;
    next();
  }).catch(next);
}

// Owner is decided only by OWNER_EMAIL (mapUser), never by users.tier.
function owner(req, res, next) {
  if (!req.account?.isOwner) return fail(res, 403, 'OWNER_REQUIRED', 'Akses owner diperlukan.');
  next();
}

function validId(...names) {
  return (req, res, next) => {
    for (const n of names) if (!UUID_RE.test(String(req.params[n] || ''))) return fail(res, 404, 'NOT_FOUND', 'Data tidak ditemukan.');
    next();
  };
}

function usagePayload(tier, used) {
  const t = tiers.getTier(tier);
  return { used, limit: finite(t.limit), remaining: Number.isFinite(t.limit) ? Math.max(0, t.limit - used) : null, resetAt: usage.nextUtcMidnight() };
}

// ---------------------------------------------------------------- pages
router.get('/pricing', (req, res) => res.sendFile(path.join(VIEWS, 'pricing.html')));
router.get('/keys', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'keys.html')));
router.get('/profile', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'profile.html')));

// ---------------------------------------------------------------- profile
const NAME_RE = /^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,23}$/u;
const RESERVED_NAMES = /^(owner|admin|administrator|system|yannz ?api|moderator)$/i;
const migrationMissing = e => e && (e.code === '42703' || e.code === '42P01');

// ---------------------------------------------------------------- profile pictures
// Stored in user_avatars (migration 010) and served to signed-in users at /api/avatar/<id>?v=<version>.
// Missing table = no pictures yet (everything else keeps working).
async function avatarVersions(userIds) {
  if (!userIds.length) return new Map();
  try {
    const rows = await query('SELECT user_id,(extract(epoch FROM updated_at)*1000)::bigint AS v FROM user_avatars WHERE user_id = ANY($1::uuid[])', [userIds]);
    return new Map(rows.map(r => [r.user_id, String(r.v)]));
  } catch (e) {
    if (migrationMissing(e)) return new Map();
    throw e;
  }
}
const avatarUrl = (userId, version) => (version ? `/api/avatar/${userId}?v=${version}` : null);

router.put('/api/profile/avatar', sameOrigin, auth, async (req, res) => {
  const img = parseAvatarImage(req.body?.image);
  if (img.error) return fail(res, 400, img.error, img.error === 'IMAGE_TOO_LARGE' ? 'Foto maksimal 512 KB.' : 'Foto harus berupa gambar JPG, PNG atau WebP.');
  try {
    const [row] = await query(
      `INSERT INTO user_avatars(user_id,mime,size_bytes,data,updated_at) VALUES($1,$2,$3,decode($4,'base64'),now())
       ON CONFLICT(user_id) DO UPDATE SET mime=EXCLUDED.mime,size_bytes=EXCLUDED.size_bytes,data=EXCLUDED.data,updated_at=now()
       RETURNING (extract(epoch FROM updated_at)*1000)::bigint AS v`,
      [req.account.id, img.mime, img.size, img.buffer.toString('base64')]
    );
    await audit.writeAudit({ actorUserId: req.account.id, action: 'avatar_update', targetType: 'user', targetId: req.account.id, metadata: { mime: img.mime, size: img.size }, ipAddress: ip(req) }).catch(() => {});
    res.json({ success: true, avatarUrl: avatarUrl(req.account.id, String(row.v)) });
  } catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Foto profil butuh migration 010_user_avatars.sql.');
    throw e;
  }
});

router.delete('/api/profile/avatar', sameOrigin, auth, async (req, res) => {
  try {
    const r = await query('DELETE FROM user_avatars WHERE user_id=$1 RETURNING user_id', [req.account.id]);
    if (r.length) await audit.writeAudit({ actorUserId: req.account.id, action: 'avatar_delete', targetType: 'user', targetId: req.account.id, ipAddress: ip(req) }).catch(() => {});
    res.json({ success: true, deleted: r.length > 0 });
  } catch (e) {
    if (migrationMissing(e)) return res.json({ success: true, deleted: false });
    throw e;
  }
});

// Signed-in users only (the live chat shows other members' pictures). Served as an image with
// nosniff and a no-script CSP; ?v= changes on every upload, so it can be cached.
router.get('/api/avatar/:id', auth, validId('id'), async (req, res) => {
  let row;
  try {
    row = (await query("SELECT mime,encode(data,'base64') AS b64 FROM user_avatars WHERE user_id=$1", [req.params.id]))[0];
  } catch (e) {
    if (!migrationMissing(e)) throw e;
  }
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Foto profil tidak ada.');
  res.set({ 'Content-Type': row.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox" });
  res.send(Buffer.from(row.b64, 'base64'));
});

router.get('/api/profile', auth, async (req, res) => {
  const a = req.account;
  const row = (await query("SELECT (password_hash IS NOT NULL) AS has_password,(google_id IS NOT NULL) AS has_google,email_verified FROM users WHERE id=$1", [a.id]))[0] || {};
  const avatar = (await avatarVersions([a.id])).get(a.id);
  res.json({ success: true, profile: {
    id: a.publicId ? String(a.publicId) : a.id, publicId: a.publicId, internalId: a.id, accountName: a.accountName, displayName: a.displayName, defaultName: users.defaultAccountName(a.email),
    name: a.name, email: a.email, tier: a.tier, tierExpiresAt: a.tierExpiresAt, isOwner: a.isOwner, createdAt: a.createdAt,
    avatarUrl: avatarUrl(a.id, avatar),
    hasPassword: !!row.has_password, loginMethods: [row.has_google ? 'google' : null, row.has_password ? 'password' : null].filter(Boolean)
  } });
});

// Account name for the live chat / profile. Empty = back to the name derived from the email.
router.patch('/api/profile', sameOrigin, auth, async (req, res) => {
  const raw = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().replace(/\s+/g, ' ') : null;
  if (raw === null) return fail(res, 400, 'INVALID_NAME', 'Isi nama akun.');
  if (raw && (!NAME_RE.test(raw) || RESERVED_NAMES.test(raw))) return fail(res, 400, 'INVALID_NAME', 'Nama akun 2–24 karakter: huruf, angka, spasi, titik, _ atau -. Nama seperti "Owner"/"Admin" tidak boleh dipakai.');
  try {
    await query('UPDATE users SET display_name=$2,updated_at=now() WHERE id=$1', [req.account.id, raw || null]);
  } catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Fitur ini butuh migration 009_key_tiers_profile_chat.sql.');
    throw e;
  }
  res.json({ success: true, accountName: raw || users.defaultAccountName(req.account.email) });
});

// Website password (never the Google password). An account without one (signed up with Google)
// creates it here; an account with one must give the current password to change it.
// Either way every other session is signed out and this one stays signed in.
router.post('/api/profile/password', sameOrigin, auth, async (req, res) => {
  const current = typeof req.body?.current === 'string' ? req.body.current : '';
  const next = typeof req.body?.password === 'string' ? req.body.password : '';
  const acc = await users.findAuthByEmail(req.account.email);
  if (!acc) return fail(res, 404, 'USER_NOT_FOUND', 'Akun tidak ditemukan.');
  if (!acc.password_hash) {
    const weak = passwords.passwordProblem(next);
    if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
    const created = await users.setPassword(acc.id, await passwords.hashPassword(next));
    await audit.writeAudit({ actorUserId: acc.id, action: 'password_create', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
    const session = req.app.locals.getSession(req) || {};
    req.app.locals.issueSession(res, session.sub || acc.id, { id: acc.id, email: acc.email, name: acc.name, picture: acc.picture || '', sessionVersion: Number(created?.session_version || 0) }, session.provider || 'google');
    return res.json({ success: true, created: true, message: 'Sandi website dibuat. Sekarang kamu juga bisa login pakai email + sandi ini (sandi Google tidak berubah).' });
  }
  if (acc.locked_until && new Date(acc.locked_until) > new Date()) return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan sandi salah. Coba lagi dalam 15 menit.');
  if (!current || current.length > 128 || !(await passwords.verifyPassword(current, acc.password_hash))) {
    await users.recordFailedLogin(acc.id);
    await audit.writeAudit({ actorUserId: acc.id, action: 'password_change_failed', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
    return fail(res, 400, 'WRONG_PASSWORD', 'Sandi saat ini salah.');
  }
  const weak = passwords.passwordProblem(next);
  if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
  if (current === next) return fail(res, 400, 'SAME_PASSWORD', 'Sandi baru harus berbeda dari sandi lama.');
  const updated = await users.setPassword(acc.id, await passwords.hashPassword(next));
  await audit.writeAudit({ actorUserId: acc.id, action: 'password_change', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
  // setPassword bumped the session version: re-issue this browser's cookie so it stays signed in.
  const session = req.app.locals.getSession(req) || {};
  req.app.locals.issueSession(res, session.sub || acc.id, { id: acc.id, email: acc.email, name: acc.name, picture: acc.picture || '', sessionVersion: Number(updated?.session_version || 0) }, session.provider || 'password');
  res.json({ success: true, message: 'Sandi berhasil diganti. Sesi di perangkat lain sudah dikeluarkan.' });
});
router.get('/billing', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'billing.html')));
router.get('/owner', pageAuth, (req, res) => {
  if (!req.account.isOwner) return res.status(403).send('Akses owner diperlukan.');
  res.sendFile(path.join(VIEWS, 'owner.html'));
});

// ---------------------------------------------------------------- account
router.get('/usage', auth, async (req, res) => {
  const used = await usage.usageToday(req.account.id);
  res.json({ success: true, tier: req.account.tier, ...usagePayload(req.account.tier, used) });
});

router.get('/api/dashboard', auth, async (req, res) => {
  const [used, ks] = await Promise.all([usage.usageToday(req.account.id), keys.listKeys(req.account.id)]);
  const t = tiers.getTier(req.account.tier);
  res.json({
    success: true,
    user: { id: req.account.id, name: req.account.name, email: req.account.email, picture: req.account.picture, tier: req.account.tier, tierExpiresAt: req.account.tierExpiresAt, isOwner: req.account.isOwner },
    usage: usagePayload(req.account.tier, used),
    apiKeys: { used: ks.filter(k => k.status === 'active').length, limit: finite(t.keys) }
  });
});

// ---------------------------------------------------------------- API keys
router.get('/api/keys', auth, async (req, res) => {
  res.json({ success: true, keys: await keys.listKeys(req.account.id), shared: await keys.sharedWith(req.account.id), limit: finite(tiers.getTier(req.account.tier).keys), tier: req.account.tier });
});

router.post('/api/keys', sameOrigin, auth, async (req, res) => {
  try {
    const customValue = typeof req.body?.custom_key === 'string' ? req.body.custom_key : null;
    // Value-guessing via "already taken" answers: cap custom attempts per account per hour.
    if (customValue && (await query("SELECT count(*)::int AS n FROM audit_logs WHERE actor_user_id=$1 AND action='api_key_custom_attempt' AND created_at>now()-interval '1 hour'", [req.account.id]))[0].n >= 20) {
      return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan custom key. Coba lagi dalam 1 jam.');
    }
    if (customValue) await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_custom_attempt', targetType: 'api_key', ipAddress: ip(req) });
    const made = await keys.createKey(req.account, req.body?.name, String(req.get('Idempotency-Key') || '').slice(0, 100) || null, customValue);
    await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_create', targetType: 'api_key', targetId: made.record.id, ipAddress: ip(req) });
    res.status(201).json({ success: true, key: made.key, record: made.record, warning: 'Salin key sekarang. Plaintext hanya ditampilkan satu kali.' });
  } catch (e) {
    if (e.code === 'KEY_LIMIT' || e.code === 'KEYS_NOT_INCLUDED') return fail(res, 403, e.code, e.message);
    if (e.code === 'IDEMPOTENCY_REPLAY' || e.code === 'CUSTOM_KEY_TAKEN') return fail(res, 409, e.code, e.message);
    if (e.code === 'INVALID_CUSTOM_KEY') return fail(res, 400, e.code, e.message);
    throw e;
  }
});

async function revokeOwnKey(req, res) {
  const ok = await keys.revokeKey(req.account.id, req.params.id);
  if (!ok) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan atau sudah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_revoke', targetType: 'api_key', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true });
}
router.delete('/api/keys/:id', sameOrigin, auth, validId('id'), revokeOwnKey);
router.post('/api/keys/:id/revoke', sameOrigin, auth, validId('id'), revokeOwnKey);

// ---------------------------------------------------------------- orders & payments (user)
router.post('/api/orders', sameOrigin, auth, async (req, res) => {
  const tier = String(req.body?.tier || '').toUpperCase();
  if (!tiers.purchasable.includes(tier)) return fail(res, 400, 'INVALID_TIER', 'Paket pembelian tidak valid.');
  const rawDays = req.body?.duration_days ?? tiers.DURATION.default;
  const days = Number(rawDays);
  if (!Number.isInteger(days) || days < tiers.DURATION.min || days > tiers.DURATION.max) {
    return fail(res, 400, 'INVALID_DURATION', `Durasi harus ${tiers.DURATION.min}–${tiers.DURATION.max} hari.`);
  }
  const current = tiers.getTier(req.account.tier).rank;
  const wanted = tiers.getTier(tier).rank;
  if (wanted < current) return fail(res, 400, 'TIER_NOT_UPGRADE', `Tier kamu (${req.account.tier}) lebih tinggi dari ${tier}.`);
  // Same tier = extension; only possible when the current tier actually expires.
  if (wanted === current && !req.account.tierExpiresAt) return fail(res, 400, 'TIER_NOT_UPGRADE', `Tier ${tier} kamu tidak punya masa berlaku, jadi tidak perlu diperpanjang.`);
  await orderService.expirePendingOrdersSafe();
  const pending = (await query("SELECT count(*)::int AS n FROM orders WHERE user_id=$1 AND status='pending'", [req.account.id]))[0].n;
  const idem = String(req.get('Idempotency-Key') || '').slice(0, 100) || null;
  if (pending >= MAX_PENDING_ORDERS) {
    // Only a replay of an order that already exists is exempt; a fresh Idempotency-Key is not.
    const replay = idem && (await query('SELECT 1 FROM orders WHERE user_id=$1 AND idempotency_key=$2', [req.account.id, idem])).length > 0;
    if (!replay) return fail(res, 429, 'TOO_MANY_PENDING_ORDERS', `Maksimal ${MAX_PENDING_ORDERS} order pending. Selesaikan atau tunggu order lama kedaluwarsa.`);
  }
  // Amount always comes from the server-side tier table; any client-sent amount is ignored.
  const amount = tiers.priceFor(tier, days);
  const code = `YAN-${tier}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const rows = await query(
    `INSERT INTO orders(user_id,order_code,tier,amount,status,expires_at,idempotency_key,duration_days)
     VALUES($1,$2,$3,$4,'pending',now()+interval '2 hours',$5,$6)
     ON CONFLICT(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET updated_at=orders.updated_at WHERE orders.tier=EXCLUDED.tier AND orders.duration_days=EXCLUDED.duration_days
     RETURNING id,order_code,tier,amount,status,created_at,expires_at,duration_days`,
    [req.account.id, code, tier, amount, idem, days]
  );
  if (!rows.length) return fail(res, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key sudah dipakai untuk paket yang berbeda.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'order_create', targetType: 'order', targetId: rows[0].id, metadata: { tier, amount, days }, ipAddress: ip(req) });
  res.status(201).json({ success: true, order: rows[0] });
});

async function paymentSettings() {
  const row = (await query('SELECT to_jsonb(server_settings.*) AS s FROM server_settings WHERE id=1'))[0]?.s || {};
  const account = (number, name) => (number ? { number, name: name || null } : null);
  return { DANA: account(row.payment_dana_number, row.payment_dana_name), GOPAY: account(row.payment_gopay_number, row.payment_gopay_name) };
}

router.get('/api/orders', auth, async (req, res) => {
  await orderService.expirePendingOrdersSafe();
  const orders = await query(
    `SELECT o.id,o.order_code,o.tier,o.amount,o.status,o.created_at,o.expires_at,o.paid_at,
            COALESCE((to_jsonb(o.*) ->> 'duration_days')::int,30) AS duration_days,
            p.id AS payment_id,p.provider,p.payment_method,p.status AS payment_status,p.proof_url,
            p.payment_url,p.qr_string,p.va_number,p.gateway_expires_at
       FROM orders o
       LEFT JOIN LATERAL (SELECT * FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) p ON true
      WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`,
    [req.account.id]
  );
  const accounts = await paymentSettings();
  res.json({
    success: true,
    orders,
    tier: req.account.tier,
    tierExpiresAt: req.account.tierExpiresAt,
    duration: tiers.DURATION,
    prices: Object.fromEntries(tiers.purchasable.map(t => [t, tiers.TIERS[t].price])),
    methods: {
      QRIS_GATEWAY: { available: pakasir.isConfigured(), autoVerified: pakasir.isVerificationConfigured() },
      QRIS: { available: true, image: '/assets/qris-manual.jpg' },
      DANA: { available: Boolean(accounts.DANA), account: accounts.DANA },
      GOPAY: { available: Boolean(accounts.GOPAY), account: accounts.GOPAY }
    },
    // Kept for older clients.
    manualMethods: MANUAL_METHODS,
    gatewayMethods: pakasir.METHODS,
    gatewayConfigured: pakasir.isConfigured(),
    ownerNotify: notifier.status(),
    contact: settings.whatsappLink,
    manualInstructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || null
  });
});

async function pendingOrderFor(req) {
  await orderService.expirePendingOrdersSafe();
  return (await query("SELECT * FROM orders WHERE id=$1 AND user_id=$2 AND status='pending' AND expires_at>now()", [req.params.id, req.account.id]))[0];
}

router.post('/api/orders/:id/pakasir', sameOrigin, auth, validId('id'), async (req, res) => {
  const method = String(req.body?.method || 'qris');
  const order = await pendingOrderFor(req);
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan atau kedaluwarsa.');
  let data;
  try {
    data = await pakasir.createTransaction(order.order_code, method, order.amount);
  } catch (e) {
    if (e.code === 'PAYMENT_NOT_CONFIGURED') return fail(res, 503, e.code, 'Pembayaran otomatis belum dikonfigurasi. Gunakan pembayaran manual.');
    if (e.code === 'INVALID_PAYMENT_METHOD' || e.code === 'INVALID_PAYMENT_AMOUNT') return fail(res, 400, e.code, e.message);
    console.error('Pakasir create failed:', { status: e?.response?.status || null, code: e?.code || null });
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', 'Gateway pembayaran belum dapat memproses transaksi.');
  }
  const tx = data?.payment || data?.transaction || data?.data || data || {};
  const txnId = String(tx.txn_id || tx.transaction_id || order.order_code);
  const ref = String(tx.txn_id || tx.payment_number || tx.transaction_id || tx.reference || order.order_code);
  const gateway = { txn_id: tx.txn_id || null, payment_link: tx.payment_link || null, qr_string: tx.qr_string || (method === 'qris' ? tx.payment_number : null) || null, va_number: tx.va_number || (method !== 'qris' ? tx.payment_number : null) || null, expired_at: tx.expired_at || null, total_payment: tx.total_payment || order.amount };
  const gatewayExpires = gateway.expired_at && !Number.isNaN(Date.parse(gateway.expired_at)) ? new Date(gateway.expired_at).toISOString() : null;
  const payment = (await query(
    `INSERT INTO payments(order_id,user_id,provider,payment_method,transaction_id,provider_reference,amount,status,payment_url,qr_string,va_number,gateway_expires_at)
     VALUES($1,$2,'pakasir',$3,$4,$5,$6,'pending',$7,$8,$9,$10)
     ON CONFLICT(provider,transaction_id) WHERE transaction_id IS NOT NULL
     DO UPDATE SET payment_url=EXCLUDED.payment_url,qr_string=EXCLUDED.qr_string,va_number=EXCLUDED.va_number,gateway_expires_at=EXCLUDED.gateway_expires_at,updated_at=now()
     RETURNING id,status,provider_reference,amount`,
    [order.id, req.account.id, method, txnId, ref, order.amount, gateway.payment_link && /^https:\/\//i.test(gateway.payment_link) ? gateway.payment_link : null, gateway.qr_string, gateway.va_number, gatewayExpires]
  ))[0];
  res.status(201).json({ success: true, payment, gateway, note: 'Status tetap pending sampai pembayaran terverifikasi server.' });
});

// The gateway's QRIS payload rendered as a scannable image (never leaves our server).
router.get('/api/orders/:id/qr.svg', auth, validId('id'), async (req, res) => {
  const row = (await query(
    `SELECT p.qr_string FROM payments p JOIN orders o ON o.id=p.order_id
      WHERE o.id=$1 AND o.user_id=$2 AND p.provider='pakasir' AND p.qr_string IS NOT NULL
      ORDER BY p.created_at DESC LIMIT 1`,
    [req.params.id, req.account.id]
  ))[0];
  if (!row) return fail(res, 404, 'QR_NOT_FOUND', 'QRIS untuk order ini belum dibuat.');
  const svg = await QRCode.toString(row.qr_string, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'private, no-store');
  res.send(svg);
});

router.post('/api/orders/:id/manual', sameOrigin, auth, validId('id'), async (req, res) => {
  const method = String(req.body?.method || '').toUpperCase();
  if (!MANUAL_METHODS.includes(method)) return fail(res, 400, 'INVALID_PAYMENT_METHOD', 'Metode manual tidak valid. Pilih QRIS, DANA atau GOPAY.');
  if (method !== 'QRIS' && !(await paymentSettings())[method]) return fail(res, 400, 'PAYMENT_METHOD_UNAVAILABLE', `Nomor ${method} belum diatur owner. Pilih metode lain.`);
  // Proof: an uploaded image (billing page) or, for API clients, an HTTPS link.
  let image = null;
  let proofUrl = null;
  if (req.body?.proof_image !== undefined) {
    image = parseProofImage(req.body.proof_image);
    if (image.error === 'PROOF_TOO_LARGE') return fail(res, 413, image.error, 'Gambar bukti maksimal 2 MB.');
    if (image.error) return fail(res, 400, image.error, 'Bukti harus gambar JPG, PNG atau WebP.');
  } else {
    const proof = String(req.body?.proof_url || '').trim();
    let url;
    try { url = new URL(proof); } catch {}
    if (!url || url.protocol !== 'https:' || proof.length > 2048) return fail(res, 400, 'INVALID_PROOF_URL', 'Upload gambar bukti pembayaran (atau kirim URL HTTPS bukti).');
    proofUrl = url.href;
  }
  const order = await pendingOrderFor(req);
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan atau kedaluwarsa.');
  let payment;
  try {
    // payments_one_pending_manual_uidx (migration 005) makes "one pending proof per order" atomic;
    // the proof image is stored in the same statement.
    payment = (await query(
      `WITH p AS (
         INSERT INTO payments(order_id,user_id,provider,payment_method,amount,proof_url,status)
         SELECT $1,$2,'manual',$3,$4,$5,'pending'
          WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id=$1 AND provider='manual' AND status='pending')
         RETURNING id,status,proof_url,created_at),
       proof AS (
         INSERT INTO payment_proofs(payment_id,mime,size_bytes,sha256,data)
         SELECT p.id,$6,$7,$8,decode($9,'base64') FROM p WHERE $6::text IS NOT NULL RETURNING payment_id)
       SELECT p.*, EXISTS(SELECT 1 FROM proof) AS has_proof FROM p`,
      [order.id, req.account.id, method, order.amount, proofUrl, image?.mime || null, image?.size || null, image?.sha256 || null, image ? image.buffer.toString('base64') : null]
    ))[0];
  } catch (e) {
    if (e.code !== '23505') throw e;
  }
  if (!payment) return fail(res, 409, 'PAYMENT_ALREADY_SUBMITTED', 'Bukti pembayaran untuk order ini sudah dikirim dan sedang menunggu approval owner.');
  const days = Number(order.duration_days || 30);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'manual_payment_create', targetType: 'payment', targetId: payment.id, metadata: { method, amount: order.amount, days, upload: Boolean(image) }, ipAddress: ip(req) });
  const notice = await notifier.notifyManualPayment({
    orderCode: order.order_code, tier: order.tier, days, amount: order.amount, method, email: req.account.email,
    panelUrl: `${req.protocol}://${req.get('host')}/owner#payments`, proof: image ? { buffer: image.buffer, mime: image.mime } : null
  });
  if (notice.sent) await query('UPDATE payments SET owner_notified=$2 WHERE id=$1', [payment.id, notice.channel]).catch(() => {});
  res.status(201).json({
    success: true,
    payment,
    status: 'PAYMENT_PENDING',
    instructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || 'Bukti diterima. Status menunggu approval owner.',
    contact: settings.whatsappLink,
    notification: notice.sent ? 'sent' : notice.reason === 'TELEGRAM_NOT_CONFIGURED' ? 'not_configured' : 'failed',
    notificationChannel: notice.sent ? notice.channel : null,
    links: notice.links
  });
});

// ---------------------------------------------------------------- owner: dashboard & status
router.get('/owner/dashboard', auth, owner, async (req, res) => {
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_access', targetType: 'owner_dashboard', ipAddress: ip(req) }).catch(() => {});
  const r = await query(`SELECT (SELECT count(*)::int FROM users) users,(SELECT count(*)::int FROM users WHERE status='active') active_users,(SELECT count(*)::int FROM users WHERE status='banned') banned_users,(SELECT count(*)::int FROM users WHERE status='pending') pending_users,(SELECT count(*)::int FROM users WHERE tier='FREE') free,(SELECT count(*)::int FROM users WHERE tier='SULTAN') sultan,(SELECT count(*)::int FROM users WHERE tier='SEPUH') sepuh,(SELECT count(*)::int FROM users WHERE tier='DEWA') dewa,(SELECT COALESCE(sum(request_count),0)::int FROM daily_quota_counters WHERE usage_date=(now() AT TIME ZONE 'UTC')::date) requests_today,(SELECT count(*)::int FROM api_keys WHERE status='active') active_keys,(SELECT count(*)::int FROM payments) payments,(SELECT count(*)::int FROM payments WHERE status='pending') pending_payments,(SELECT COALESCE(sum(amount),0)::int FROM payments WHERE status='paid') revenue,(SELECT count(*)::int FROM endpoints WHERE status='active') active_endpoints,(SELECT count(*)::int FROM endpoints WHERE locked) locked_endpoints`);
  res.json({ success: true, stats: r[0] });
});

router.get('/owner/status', auth, owner, async (req, res) => {
  const loaded = [...(req.app.locals.loadedPluginPaths || [])];
  let database = { connected: false };
  let registry = [];
  try {
    database = { connected: await healthCheck(), ...(await checkSchema()) };
    registry = (await query('SELECT path FROM endpoints')).map(r => r.path);
  } catch (e) {
    database = { connected: false, error: classifyDatabaseError(e).error };
  }
  const configured = name => Boolean(String(process.env[name] || '').trim());
  res.json({
    success: true,
    database,
    // Names and presence only; values are never returned.
    config: Object.fromEntries(['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'AUTH_SECRET', 'OWNER_EMAIL', 'CORS_ORIGINS', 'PAKASIR_PROJECT', 'PAKASIR_API_KEY', 'PAKASIR_V2_VERIFY_URL', 'MANUAL_PAYMENT_INSTRUCTIONS', 'OWNER_WA', 'EMAIL_FROM', 'RESEND_API_KEY', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'].map(n => [n, configured(n)])),
    authConfigured: missingAuthConfig().length === 0,
    payments: { pakasirConfigured: pakasir.isConfigured(), automaticSettlement: pakasir.isVerificationConfigured() ? 'configured_not_verified' : 'disabled_fail_closed' },
    notifications: notifier.status(),
    email: emailService.status(),
    plugins: { loaded, registryWithoutHandler: registry.filter(p => !loaded.includes(p)), handlerWithoutRegistry: loaded.filter(p => !registry.includes(p)) },
    runtime: { node: process.version, vercel: Boolean(process.env.VERCEL), region: process.env.VERCEL_REGION || null, uptimeSeconds: Math.round(process.uptime()) }
  });
});

// ---------------------------------------------------------------- owner: users
router.get('/owner/users', auth, owner, async (req, res) => {
  const q = String(req.query.q || '').slice(0, 100);
  const tier = String(req.query.tier || '').toUpperCase();
  const status = String(req.query.status || '').toLowerCase();
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const offset = Math.max(0, Number(req.query.offset) || 0);
  const rows = await query(
    `SELECT u.id,u.email,u.name,u.picture,u.tier,u.status,u.created_at,u.banned_at,u.ban_reason,
            (to_jsonb(u.*) ->> 'tier_expires_at')::timestamptz AS tier_expires_at,
            (to_jsonb(u.*) ->> 'public_id') AS public_id,
            COALESCE(d.request_count,0)::int AS used_today,
            (SELECT count(*)::int FROM api_keys k WHERE k.user_id=u.id AND k.status='active') AS active_keys
       FROM users u
       LEFT JOIN daily_quota_counters d ON d.user_id=u.id AND d.usage_date=(now() AT TIME ZONE 'UTC')::date
      WHERE (u.email ILIKE $1 OR u.name ILIKE $1 OR u.id::text=$6 OR (to_jsonb(u.*) ->> 'public_id')=$6 OR ($6='100000000' AND lower(u.email)=lower($7)))
        AND ($2='' OR u.tier=$2) AND ($3='' OR u.status=$3)
      ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
    [`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`, tier, status, limit, offset, q.trim(), process.env.OWNER_EMAIL || '']
  );
  res.json({ success: true, users: rows.map(u => { const m = users.mapUser(u); return { ...u, publicId: m.publicId, storedTier: u.tier, tier: m.tier, tierExpiresAt: m.tierExpiresAt, isOwner: m.isOwner }; }), limit, offset });
});

router.get('/owner/users/:id', auth, owner, validId('id'), async (req, res) => {
  const u = (await query("SELECT id,google_id,email,name,picture,tier,status,created_at,updated_at,banned_at,ban_reason,email_verified,(password_hash IS NOT NULL) AS has_password,(to_jsonb(users.*) ->> 'tier_expires_at')::timestamptz AS tier_expires_at,(to_jsonb(users.*) ->> 'public_id') AS public_id FROM users WHERE id=$1", [req.params.id]))[0];
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User tidak ditemukan.');
  const mapped = users.mapUser(u);
  const [daily, apiKeys, orders] = await Promise.all([
    query("SELECT usage_date::text AS date,request_count AS used FROM daily_quota_counters WHERE user_id=$1 ORDER BY usage_date DESC LIMIT 14", [u.id]),
    keys.listKeys(u.id),
    query(`SELECT o.id,o.order_code,o.tier,o.amount,o.status,o.created_at,o.paid_at,COALESCE((to_jsonb(o.*) ->> 'duration_days')::int,30) AS duration_days,p.provider,p.status AS payment_status
             FROM orders o LEFT JOIN LATERAL (SELECT provider,status FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) p ON true
            WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [u.id])
  ]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const usedToday = daily.find(d => d.date === todayKey)?.used || 0;
  const { google_id, ...profile } = u;
  profile.loginMethods = [google_id ? 'google' : null, u.has_password ? 'password' : null].filter(Boolean);
  res.json({ success: true, user: { ...profile, publicId: mapped.publicId, storedTier: u.tier, tier: mapped.tier, tierExpiresAt: mapped.tierExpiresAt, isOwner: mapped.isOwner }, usage: { ...usagePayload(mapped.tier, usedToday), history: daily }, apiKeys, apiKeyLimit: finite(tiers.getTier(mapped.tier).keys), orders });
});

async function protectedTarget(req) {
  const target = (await query('SELECT id,email FROM users WHERE id=$1', [req.params.id]))[0];
  if (!target) return { error: [404, 'NOT_FOUND', 'User tidak ditemukan.'] };
  if (target.id === req.account.id || users.isOwnerEmail(target.email)) return { error: [400, 'SELF_ACTION_BLOCKED', 'Tindakan ini tidak dapat dilakukan pada akun owner.'] };
  return { target };
}

router.post('/owner/users/:id/ban', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  const reason = String(req.body?.reason || 'Dibatasi owner').slice(0, 500);
  const r = await query("UPDATE users SET status='banned',banned_at=now(),ban_reason=$2,session_version=session_version+1,updated_at=now() WHERE id=$1 RETURNING id,status", [req.params.id, reason]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_ban', targetType: 'user', targetId: req.params.id, metadata: { reason }, ipAddress: ip(req) });
  res.json({ success: true, user: r[0] });
});

router.post('/owner/users/:id/approve', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const r = await query("UPDATE users SET status='active',updated_at=now() WHERE id=$1 AND status='pending' RETURNING id,status", [req.params.id]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'User pending tidak ditemukan.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_approve', targetType: 'user', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true, user: r[0] });
});

router.post('/owner/users/:id/unban', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  const r = await query("UPDATE users SET status='active',banned_at=NULL,ban_reason=NULL,updated_at=now() WHERE id=$1 RETURNING id,status", [req.params.id]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_unban', targetType: 'user', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true, user: r[0] });
});

router.patch('/owner/users/:id/tier', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const tier = String(req.body?.tier || '').toUpperCase();
  if (!['FREE', 'SULTAN', 'SEPUH', 'DEWA'].includes(tier)) return fail(res, 400, 'INVALID_TIER', 'Tier tidak valid. OWNER hanya ditentukan oleh OWNER_EMAIL.');
  // Optional duration: empty = no expiry. FREE never expires.
  const days = req.body?.days === undefined || req.body?.days === null || req.body?.days === '' ? null : Number(req.body.days);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return fail(res, 400, 'INVALID_DURATION', 'Durasi harus 1–3650 hari atau kosong (permanen).');
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  const r = await query(
    `UPDATE users SET tier=$2,tier_expires_at=CASE WHEN $2='FREE' OR $3::int IS NULL THEN NULL ELSE now()+make_interval(days=>$3::int) END,updated_at=now()
      WHERE id=$1 RETURNING id,tier,tier_expires_at`,
    [req.params.id, tier, days]
  );
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_tier_change', targetType: 'user', targetId: req.params.id, metadata: { tier, days }, ipAddress: ip(req) });
  res.json({ success: true, user: r[0] });
});

router.delete('/owner/users/:id', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  // Cascades to the user's API keys, usage, orders, and payments (foreign keys ON DELETE CASCADE).
  await query('DELETE FROM users WHERE id=$1', [req.params.id]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_delete', targetType: 'user', targetId: req.params.id, metadata: { email: t.target.email }, ipAddress: ip(req) });
  res.json({ success: true });
});

// Reset a user's password by user ID or email. Empty password = generate one (shown once).
// Signs the user out everywhere. The owner account itself is changed from its own Profile page.
function generatedPassword() {
  const letters = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ', digits = '23456789', all = letters + digits;
  const pick = set => set[crypto.randomInt(set.length)];
  const chars = [pick(letters), pick(digits), ...Array.from({ length: 10 }, () => pick(all))];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join('');
}
router.post('/owner/users/reset-password', sameOrigin, auth, owner, async (req, res) => {
  const who = typeof req.body?.user === 'string' ? req.body.user.trim().slice(0, 200) : '';
  if (!who) return fail(res, 400, 'USER_REQUIRED', 'Isi ID atau email user.');
  const target = await users.findByAnyId(who);
  if (!target) return fail(res, 404, 'USER_NOT_FOUND', 'User dengan ID/email itu tidak ditemukan.');
  if (target.id === req.account.id || users.isOwnerEmail(target.email)) return fail(res, 400, 'SELF_ACTION_BLOCKED', 'Sandi owner diganti lewat halaman Profile.');
  const typed = typeof req.body?.password === 'string' ? req.body.password : '';
  const password = typed || generatedPassword();
  const weak = passwords.passwordProblem(password);
  if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
  await users.setPassword(target.id, await passwords.hashPassword(password));
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_password_reset', targetType: 'user', targetId: target.id, metadata: { email: target.email, generated: !typed }, ipAddress: ip(req) });
  res.json({ success: true, user: { id: target.id, email: target.email }, password: typed ? null : password, message: 'Sandi direset. User sudah dikeluarkan dari semua perangkat.' });
});

router.post('/owner/users/:id/keys/:keyId/revoke', sameOrigin, auth, owner, validId('id', 'keyId'), async (req, res) => {
  const ok = await keys.revokeKey(req.params.id, req.params.keyId);
  if (!ok) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan atau sudah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_revoke', targetType: 'api_key', targetId: req.params.keyId, metadata: { userId: req.params.id }, ipAddress: ip(req) });
  res.json({ success: true });
});

// ---------------------------------------------------------------- live chat
// One public room for signed-in users. Messages show the account name (never the email).
// Clients poll GET /api/chat?after=<last id> every few seconds (no websockets on serverless).
const CHAT_PAGE = 60;
const chatName = row => (row.display_name && String(row.display_name).trim()) || users.defaultAccountName(row.email);
function chatRow(row, me, avatars = new Map()) {
  return { id: Number(row.id), name: chatName(row), owner: users.isOwnerEmail(row.email), mine: row.user_id === me.id, body: row.body, at: row.created_at, avatar: avatarUrl(row.user_id, avatars.get(row.user_id)) };
}
async function chatGuard(res, fn) {
  try { return await fn(); } catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Live chat butuh migration 009_key_tiers_profile_chat.sql.');
    throw e;
  }
}

router.get('/api/chat', auth, (req, res) => chatGuard(res, async () => {
  const after = Number.parseInt(req.query.after, 10);
  const me = req.account;
  // "online" = polled in the last 2 minutes; last_seen_at is written at most once a minute.
  await query("UPDATE users SET last_seen_at=now() WHERE id=$1 AND (last_seen_at IS NULL OR last_seen_at < now()-interval '60 seconds')", [me.id]);
  const select = `SELECT m.id,m.user_id,m.body,m.created_at,u.email,(to_jsonb(u.*) ->> 'display_name') AS display_name
                    FROM chat_messages m JOIN users u ON u.id=m.user_id WHERE m.deleted_at IS NULL`;
  const rows = Number.isFinite(after) && after > 0
    ? await query(`${select} AND m.id > $1 ORDER BY m.id ASC LIMIT 100`, [after])
    : (await query(`${select} ORDER BY m.id DESC LIMIT ${CHAT_PAGE}`)).reverse();
  const [extra] = await query(`SELECT (SELECT count(*)::int FROM users WHERE last_seen_at > now()-interval '2 minutes') AS online,
      COALESCE((SELECT json_agg(id) FROM chat_messages WHERE deleted_at > now()-interval '5 minutes'), '[]'::json) AS deleted`);
  const avatars = await avatarVersions([...new Set(rows.map(r => r.user_id))]);
  res.json({ success: true, messages: rows.map(r => chatRow(r, me, avatars)), deleted: (extra.deleted || []).map(Number), online: extra.online, me: { name: me.accountName, owner: me.isOwner } });
}));

router.post('/api/chat', sameOrigin, auth, (req, res) => chatGuard(res, async () => {
  // Plain text only: control characters dropped (newlines kept), 1–500 characters.
  const body = typeof req.body?.body === 'string' ? req.body.body.replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '').replace(/\n{3,}/g, '\n\n').trim() : '';
  if (!body || body.length > 500) return fail(res, 400, 'INVALID_MESSAGE', 'Pesan harus 1–500 karakter.');
  const [rate] = await query(`SELECT count(*) FILTER (WHERE created_at > now()-interval '1.5 seconds')::int AS burst,
      count(*) FILTER (WHERE created_at > now()-interval '1 minute')::int AS minute
    FROM chat_messages WHERE user_id=$1 AND created_at > now()-interval '1 minute'`, [req.account.id]);
  if (rate.burst > 0 || rate.minute >= 15) return fail(res, 429, 'CHAT_RATE_LIMIT', 'Pelan-pelan — maksimal 15 pesan per menit.');
  const [row] = await query('INSERT INTO chat_messages(user_id,body) VALUES($1,$2) RETURNING id,user_id,body,created_at', [req.account.id, body]);
  res.status(201).json({ success: true, message: chatRow({ ...row, email: req.account.email, display_name: req.account.displayName }, req.account, await avatarVersions([req.account.id])) });
}));

// The owner can remove any message; everyone can remove their own.
router.delete('/api/chat/:id', sameOrigin, auth, (req, res) => chatGuard(res, async () => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isFinite(id) || id < 1) return fail(res, 404, 'NOT_FOUND', 'Pesan tidak ditemukan.');
  const r = await query('UPDATE chat_messages SET deleted_at=now(),deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL AND ($3::boolean OR user_id=$2) RETURNING id,user_id', [id, req.account.id, req.account.isOwner]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Pesan tidak ditemukan.');
  if (req.account.isOwner && r[0].user_id !== req.account.id) await audit.writeAudit({ actorUserId: req.account.id, action: 'chat_message_delete', targetType: 'user', targetId: r[0].user_id, metadata: { messageId: id }, ipAddress: ip(req) });
  res.json({ success: true });
}));

// ---------------------------------------------------------------- owner: all API keys
// Keys are stored only as a SHA-256 digest, so nobody (owner included) can read a key back.
// The owner sees every key's owner, name, display prefix, status and dates, can search by
// user, key name or prefix, or paste a full key to find whose it is (matched by digest; the
// search is a POST so a pasted key never ends up in a URL or request log), and can revoke or
// delete any key.
router.post('/owner/keys/search', sameOrigin, auth, owner, async (req, res) => {
  const q = typeof req.body?.q === 'string' ? req.body.q.trim().slice(0, 200) : '';
  const status = ['active', 'revoked', 'disabled'].includes(req.body?.status) ? req.body.status : '';
  const kind = ['public', 'private', 'owner', 'personal'].includes(req.body?.kind) ? req.body.kind : '';
  const ownerKey = await keys.ensureOwnerKey(req.account);
  const limit = Math.min(200, Math.max(1, Number(req.body?.limit) || 100));
  const offset = Math.max(0, Number(req.body?.offset) || 0);
  const like = `%${q.replace(/[\\%_]/g, m => '\\' + m)}%`;
  const rows = await query(
    `SELECT k.id,k.name,k.key_prefix,k.status,k.created_at,k.last_used_at,k.revoked_at,
            COALESCE((to_jsonb(k.*) ->> 'custom')::boolean,false) AS custom,
            (to_jsonb(k.*) ->> 'tier') AS tier,(to_jsonb(k.*) ->> 'expires_at')::timestamptz AS expires_at,
            ((to_jsonb(k.*) ->> 'issued_by') IS NOT NULL) AS issued,
            (to_jsonb(k.*) ->> 'visibility') AS visibility,
            (q.digest IS NOT NULL AND k.key_hash=q.digest) AS exact_match,
            u.id AS user_id,u.email AS user_email,u.name AS user_name,u.tier AS user_tier,u.status AS user_status
       FROM api_keys k
       JOIN users u ON u.id=k.user_id
       CROSS JOIN (SELECT NULLIF($1,'') AS digest) q
      WHERE ($2='' OR k.key_hash=q.digest OR u.email ILIKE $3 OR u.name ILIKE $3 OR k.name ILIKE $3 OR k.key_prefix ILIKE $3)
        AND ($4='' OR k.status=$4)
        AND ($7='' OR COALESCE(to_jsonb(k.*) ->> 'visibility','personal')=$7)
      ORDER BY (k.key_hash=q.digest) DESC NULLS LAST, (to_jsonb(k.*) ->> 'visibility')='owner' DESC NULLS LAST, k.status='active' DESC, k.created_at DESC
      LIMIT $5 OFFSET $6`,
    [q ? digest(q) : '', q, like, status, limit, offset, kind]
  );
  const access = await keys.listAccess(rows.filter(r => r.visibility === 'private').map(r => r.id));
  const [totals] = await query("SELECT count(*)::int AS total,count(*) FILTER (WHERE status='active')::int AS active FROM api_keys");
  res.json({ success: true, keys: rows.map(r => ({ ...r, access: r.visibility === 'private' ? access.get(r.id) || [] : undefined })), totals, ownerKey, limit, offset });
});

// Accounts named by numeric ID, internal ID or email (array, or one per line / comma).
async function resolveUsers(list) {
  const items = (Array.isArray(list) ? list : String(list || '').split(/[\n,;]+/)).map(v => String(v).trim()).filter(Boolean).slice(0, 50);
  const found = [], missing = [];
  for (const who of items) { const u = await users.findByAnyId(who); if (u) found.push(u); else missing.push(who); }
  return { found, missing };
}

// Issue a key with its own tier and lifetime.
//   kind public  — anyone holding the key; private — only the listed accounts; owner — only the owner.
//   No kind (older clients): a personal key of the owner (assignee empty) or of a user (email or ID).
router.post('/owner/keys', sameOrigin, auth, owner, async (req, res) => {
  const b = req.body || {};
  if (b.kind !== undefined && b.kind !== '') return issueManagedKey(req, res);
  const who = typeof b.assignee === 'string' ? b.assignee.trim() : '';
  let target = req.account;
  if (who) {
    const found = await users.findByAnyId(who);
    if (!found) return fail(res, 404, 'USER_NOT_FOUND', 'User dengan email/ID itu tidak ditemukan.');
    target = found;
  }
  try {
    const hours = keys.durationHours(b.duration, b.days);
    const tier = String(b.tier || '').toUpperCase();
    const made = await keys.issueKey({ issuerId: req.account.id, userId: target.id, name: b.name, customValue: typeof b.custom_key === 'string' ? b.custom_key.trim() : null, tier, hours });
    await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_issue', targetType: 'api_key', targetId: made.record.id, metadata: { userId: target.id, email: target.email, tier, expiresAt: made.record.expires_at, prefix: made.record.key_prefix }, ipAddress: ip(req) });
    res.status(201).json({ success: true, key: made.key, record: { ...made.record, user_email: target.email } });
  } catch (e) {
    if (keyError(res, e)) return;
    throw e;
  }
});

const KEY_ERRORS = { INVALID_TIER: 400, INVALID_DURATION: 400, INVALID_CUSTOM_KEY: 400, INVALID_VISIBILITY: 400, CUSTOM_KEY_TAKEN: 409, OWNER_KEY_EXISTS: 409, MIGRATION_REQUIRED: 503 };
function keyError(res, e) {
  if (KEY_ERRORS[e.code]) { fail(res, KEY_ERRORS[e.code], e.code, e.message); return true; }
  return false;
}

async function issueManagedKey(req, res) {
  const b = req.body || {};
  const kind = String(b.kind).toLowerCase();
  if (!keys.KEY_VISIBILITY.includes(kind)) return fail(res, 400, 'INVALID_VISIBILITY', 'Jenis key harus Public, Private atau Owner.');
  let accessUsers = [];
  if (kind === 'private') {
    const { found, missing } = await resolveUsers(b.access);
    if (missing.length) return fail(res, 404, 'USER_NOT_FOUND', `User tidak ditemukan: ${missing.join(', ')}`, { missing });
    if (!found.length) return fail(res, 400, 'ACCESS_REQUIRED', 'Key private butuh minimal 1 user/email yang diberi akses.');
    accessUsers = found;
  }
  try {
    const hours = keys.durationHours(b.duration, b.days);
    const tier = kind === 'owner' ? null : String(b.tier || '').toUpperCase();
    const made = await keys.issueKey({
      issuerId: req.account.id, userId: req.account.id, name: b.name, tier, hours, visibility: kind,
      customValue: typeof b.custom_key === 'string' ? b.custom_key.trim() : null, accessUserIds: accessUsers.map(u => u.id)
    });
    await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_issue', targetType: 'api_key', targetId: made.record.id, metadata: { kind, tier, expiresAt: made.record.expires_at, prefix: made.record.key_prefix, access: accessUsers.map(u => u.email) }, ipAddress: ip(req) });
    res.status(201).json({ success: true, key: made.key, record: { ...made.record, user_email: req.account.email, access: accessUsers.map(u => ({ id: u.id, email: u.email })) } });
  } catch (e) {
    if (keyError(res, e)) return;
    throw e;
  }
}

async function managedKey(req, res) {
  const key = await ownerKeyRow(req.params.keyId);
  if (!key) { fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan.'); return null; }
  return key;
}

// Edit: rename, renew (extend), make permanent, or change the tier.
router.patch('/owner/keys/:keyId', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const b = req.body || {};
  const change = {};
  const current = await managedKey(req, res);
  if (!current) return;
  try {
    if (typeof b.name === 'string' && b.name.trim()) change.name = b.name.trim().slice(0, 80);
    if (b.tier !== undefined && b.tier !== '' && current.visibility === 'owner') return fail(res, 400, 'INVALID_TIER', 'Owner key selalu memakai akses OWNER; tier-nya tidak bisa diubah.');
    if (String(b.tier || '').toUpperCase() === 'ACCOUNT' && current.visibility) return fail(res, 400, 'INVALID_TIER', 'Key public/private harus punya tier sendiri.');
    if (b.extend !== undefined) {
      const hours = keys.durationHours(b.extend, b.days);
      if (hours === null) change.permanent = true; else change.hours = hours;
    }
    if (b.tier !== undefined && b.tier !== '') change.tier = String(b.tier).toUpperCase();
    if (!Object.keys(change).length) return fail(res, 400, 'NOTHING_TO_CHANGE', 'Ubah nama, masa aktif atau tier.');
    const key = await keys.updateIssuedKey(req.params.keyId, change);
    if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan atau sudah dicabut (key yang dicabut tidak bisa diubah).');
    await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_update', targetType: 'api_key', targetId: key.id, metadata: { ...change, expiresAt: key.expires_at, tier: key.tier }, ipAddress: ip(req) });
    res.json({ success: true, key });
  } catch (e) {
    if (e.code === 'MIGRATION_REQUIRED') return fail(res, 503, e.code, e.message);
    if (['INVALID_TIER', 'INVALID_DURATION'].includes(e.code)) return fail(res, 400, e.code, e.message);
    throw e;
  }
});

async function ownerKeyRow(id) {
  return (await query("SELECT k.id,k.user_id,k.name,k.key_prefix,k.status,(to_jsonb(k.*) ->> 'visibility') AS visibility,u.email FROM api_keys k JOIN users u ON u.id=k.user_id WHERE k.id=$1", [id]))[0];
}

// Enable / disable: a disabled key is refused (API_KEY_DISABLED) until it is enabled again.
async function setKeyEnabled(req, res, enabled) {
  const key = await managedKey(req, res);
  if (!key) return;
  try {
    const r = await keys.setKeyStatus(key.id, enabled ? 'active' : 'disabled');
    if (!r) return fail(res, 409, 'KEY_REVOKED', 'Key yang sudah dicabut tidak bisa diaktifkan lagi.');
  } catch (e) { if (keyError(res, e)) return; throw e; }
  await audit.writeAudit({ actorUserId: req.account.id, action: enabled ? 'owner_api_key_enable' : 'owner_api_key_disable', targetType: 'api_key', targetId: key.id, metadata: { prefix: key.key_prefix, name: key.name, kind: key.visibility }, ipAddress: ip(req) });
  res.json({ success: true, status: enabled ? 'active' : 'disabled' });
}
router.post('/owner/keys/:keyId/enable', sameOrigin, auth, owner, validId('keyId'), (req, res) => setKeyEnabled(req, res, true));
router.post('/owner/keys/:keyId/disable', sameOrigin, auth, owner, validId('keyId'), (req, res) => setKeyEnabled(req, res, false));

// Reset / regenerate: a new value (generated or custom); the old value stops working at once.
router.post('/owner/keys/:keyId/regenerate', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const key = await managedKey(req, res);
  if (!key) return;
  try {
    const made = await keys.regenerateKey(key.id, typeof req.body?.custom_key === 'string' ? req.body.custom_key.trim() : null);
    if (!made) return fail(res, 409, 'KEY_REVOKED', 'Key yang sudah dicabut tidak bisa di-reset. Buat key baru.');
    await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_regenerate', targetType: 'api_key', targetId: key.id, metadata: { kind: key.visibility, oldPrefix: key.key_prefix, newPrefix: made.record.key_prefix }, ipAddress: ip(req) });
    res.json({ success: true, key: made.key, record: made.record, message: 'Key lama sudah tidak berlaku. Simpan key baru ini — hanya ditampilkan sekali.' });
  } catch (e) {
    if (keyError(res, e)) return;
    throw e;
  }
});

// Private keys: who may use them. Add, remove one, or reset (replace the whole list).
async function privateKey(req, res) {
  const key = await managedKey(req, res);
  if (!key) return null;
  if (key.visibility !== 'private') { fail(res, 400, 'NOT_PRIVATE', 'Daftar akses hanya untuk key private.'); return null; }
  return key;
}
async function accessReply(res, key) {
  const list = (await keys.listAccess([key.id])).get(key.id) || [];
  res.json({ success: true, access: list });
}
router.get('/owner/keys/:keyId/access', auth, owner, validId('keyId'), async (req, res) => {
  const key = await privateKey(req, res);
  if (key) await accessReply(res, key);
});
async function changeAccess(req, res, mode) {
  const key = await privateKey(req, res);
  if (!key) return;
  const { found, missing } = await resolveUsers(req.body?.users ?? req.body?.user);
  if (missing.length) return fail(res, 404, 'USER_NOT_FOUND', `User tidak ditemukan: ${missing.join(', ')}`, { missing });
  if (!found.length) return fail(res, 400, 'ACCESS_REQUIRED', 'Isi minimal 1 user/email.');
  try {
    if (mode === 'reset') await keys.setAccess(key.id, found.map(u => u.id), req.account.id);
    else await keys.addAccess(key.id, found.map(u => u.id), req.account.id);
  } catch (e) { if (keyError(res, e)) return; throw e; }
  await audit.writeAudit({ actorUserId: req.account.id, action: mode === 'reset' ? 'owner_api_key_access_reset' : 'owner_api_key_access_add', targetType: 'api_key', targetId: key.id, metadata: { users: found.map(u => u.email) }, ipAddress: ip(req) });
  await accessReply(res, key);
}
router.post('/owner/keys/:keyId/access', sameOrigin, auth, owner, validId('keyId'), (req, res) => changeAccess(req, res, 'add'));
router.put('/owner/keys/:keyId/access', sameOrigin, auth, owner, validId('keyId'), (req, res) => changeAccess(req, res, 'reset'));
router.delete('/owner/keys/:keyId/access/:userId', sameOrigin, auth, owner, validId('keyId', 'userId'), async (req, res) => {
  const key = await privateKey(req, res);
  if (!key) return;
  if (!(await keys.removeAccess(key.id, req.params.userId))) return fail(res, 404, 'NOT_FOUND', 'User itu tidak ada di daftar akses.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_access_remove', targetType: 'api_key', targetId: key.id, metadata: { userId: req.params.userId }, ipAddress: ip(req) });
  await accessReply(res, key);
});

router.post('/owner/keys/:keyId/revoke', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const key = await ownerKeyRow(req.params.keyId);
  if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan.');
  if (key.visibility === 'owner') return fail(res, 400, 'OWNER_KEY_KEEP', 'Owner key tidak dicabut: pakai Nonaktifkan atau Reset.');
  const r = await query("UPDATE api_keys SET status='revoked',revoked_at=now() WHERE id=$1 AND status='active' RETURNING id", [key.id]);
  if (!r.length) return fail(res, 409, 'KEY_ALREADY_REVOKED', 'API key ini sudah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_revoke', targetType: 'api_key', targetId: key.id, metadata: { userId: key.user_id, email: key.email, prefix: key.key_prefix, name: key.name }, ipAddress: ip(req) });
  res.json({ success: true });
});

router.delete('/owner/keys/:keyId', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const key = await ownerKeyRow(req.params.keyId);
  if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan.');
  // Usage history stays (api_usage.api_key_id is ON DELETE SET NULL); the key stops working at once.
  await query('DELETE FROM api_keys WHERE id=$1', [key.id]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_delete', targetType: 'api_key', targetId: key.id, metadata: { userId: key.user_id, email: key.email, prefix: key.key_prefix, name: key.name, status: key.status }, ipAddress: ip(req) });
  res.json({ success: true });
});

// ---------------------------------------------------------------- owner: endpoints
// The registry stores metadata/access flags only. An endpoint executes only when a plugin
// handler for its path is deployed in plugin/ (handler_loaded); metadata never runs code.
function withHandler(req, row) {
  return { ...row, handler_loaded: (req.app.locals.loadedPluginPaths || new Set()).has(row.path) };
}

router.get('/owner/api/endpoints', auth, owner, async (req, res) => {
  const rows = await query('SELECT * FROM endpoints ORDER BY name');
  res.json({ success: true, endpoints: rows.map(r => withHandler(req, r)) });
});

router.post('/owner/api/endpoints', sameOrigin, auth, owner, async (req, res) => {
  const b = req.body || {};
  if (b.code !== undefined) return createPluginEndpoint(req, res);
  const method = String(b.method || 'GET').toUpperCase();
  if (typeof b.name !== 'string' || !b.name.trim() || typeof b.path !== 'string' || !/^\/[a-zA-Z0-9/_-]{1,200}$/.test(b.path) || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return fail(res, 400, 'INVALID_ENDPOINT', 'Data endpoint tidak valid.');
  }
  if (b.minimum_tier !== undefined && !tiers.TIERS[b.minimum_tier]) return fail(res, 400, 'INVALID_TIER', 'Tier minimum tidak valid.');
  const r = await query(
    'INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,$4,$5,$6,$7,NULL) ON CONFLICT(path) DO NOTHING RETURNING *',
    [b.name.trim().slice(0, 100), b.path, String(b.description || '').slice(0, 500), method, b.minimum_tier || 'FREE', b.locked === true, b.status === 'disabled' ? 'disabled' : 'active']
  );
  if (!r.length) return fail(res, 409, 'ENDPOINT_EXISTS', 'Path endpoint sudah terdaftar.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_create', targetType: 'endpoint', targetId: r[0].id, metadata: { path: b.path }, ipAddress: ip(req) });
  const endpoint = withHandler(req, r[0]);
  res.status(201).json({ success: true, endpoint, warning: endpoint.handler_loaded ? null : 'Metadata tersimpan, tetapi belum ada plugin handler untuk path ini. Endpoint tidak bisa dipanggil sampai plugin di-deploy.' });
});

// New endpoint with its script: 1 name, 2 /api/kategori/nama, 3 .js script, 4 description, 5 tier.
// The registry row is written first (so the tier is in place before the deploy registers the
// route), then the script is committed to plugin/ on GitHub; a failed commit removes the row.
async function createPluginEndpoint(req, res) {
  const b = req.body || {};
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : '';
  const target = pluginService.parsePath(b.path);
  if (!name || !target) return fail(res, 400, 'INVALID_ENDPOINT', 'Nama wajib diisi dan path harus berbentuk /api/kategori/nama (huruf kecil, angka, tanda -).');
  const tier = b.minimum_tier === undefined ? 'FREE' : b.minimum_tier;
  if (!tiers.TIERS[tier]) return fail(res, 400, 'INVALID_TIER', 'Tier minimum tidak valid.');
  const desc = String(b.description || '').trim().slice(0, 500) || name;   // the plugin loader skips plugins without desc
  try {
    pluginService.validateCode(b.code);
  } catch (e) {
    if (e instanceof pluginService.PluginError) return fail(res, e.status, e.code, e.message);
    throw e;
  }
  if (!pluginService.isConfigured()) return fail(res, 503, 'GITHUB_NOT_CONFIGURED', 'Upload plugin belum aktif: set GITHUB_TOKEN (dan GITHUB_REPO jika repo berbeda) di Environment Variables Vercel, lalu redeploy.');

  const r = await query(
    "INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,'GET',$4,false,'active',$5) ON CONFLICT(path) DO NOTHING RETURNING *",
    [name, b.path, desc, tier, target.plugin]
  );
  if (!r.length) return fail(res, 409, 'ENDPOINT_EXISTS', 'Path endpoint sudah terdaftar.');
  let commit;
  try {
    commit = await pluginService.commitPlugin({
      file: target.file,
      content: pluginService.buildPluginFile({ name, desc, category: target.category, path: b.path, code: b.code }),
      message: `Add endpoint ${b.path} from the owner panel`
    });
  } catch (e) {
    await query('DELETE FROM endpoints WHERE id=$1', [r[0].id]);
    if (e instanceof pluginService.PluginError) return fail(res, e.status, e.code, e.message);
    throw e;
  }
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_create', targetType: 'endpoint', targetId: r[0].id, metadata: { path: b.path, tier, file: commit.file, commit: commit.sha }, ipAddress: ip(req) });
  res.status(201).json({
    success: true,
    endpoint: withHandler(req, r[0]),
    commit,
    message: `Script di-commit ke ${commit.file}. Vercel akan deploy ulang (biasanya 20–60 detik); setelah itu endpoint aktif.`
  });
}

router.patch('/owner/api/endpoints/:id', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const b = req.body || {};
  const bad = (b.name !== undefined && (typeof b.name !== 'string' || !b.name.trim()))
    || (b.description !== undefined && typeof b.description !== 'string')
    || (b.minimum_tier !== undefined && !tiers.TIERS[b.minimum_tier])
    || (b.locked !== undefined && typeof b.locked !== 'boolean')
    || (b.status !== undefined && !['active', 'disabled'].includes(b.status));
  if (bad) return fail(res, 400, 'INVALID_ENDPOINT', 'Data endpoint tidak valid.');
  const r = await query(
    'UPDATE endpoints SET name=COALESCE($2,name),description=COALESCE($3,description),minimum_tier=COALESCE($4,minimum_tier),locked=COALESCE($5,locked),status=COALESCE($6,status),updated_at=now() WHERE id=$1 RETURNING *',
    [req.params.id, b.name?.trim().slice(0, 100) ?? null, b.description?.slice(0, 500) ?? null, b.minimum_tier ?? null, b.locked ?? null, b.status ?? null]
  );
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  const changes = Object.fromEntries(['name', 'description', 'minimum_tier', 'locked', 'status'].filter(k => b[k] !== undefined).map(k => [k, b[k]]));
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_update', targetType: 'endpoint', targetId: req.params.id, metadata: changes, ipAddress: ip(req) });
  res.json({ success: true, endpoint: withHandler(req, r[0]) });
});

async function setEndpointLock(req, res, locked) {
  const r = await query('UPDATE endpoints SET locked=$2,updated_at=now() WHERE id=$1 RETURNING id,path,locked', [req.params.id, locked]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  await audit.writeAudit({ actorUserId: req.account.id, action: locked ? 'endpoint_lock' : 'endpoint_unlock', targetType: 'endpoint', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true, endpoint: r[0] });
}
router.post('/owner/api/endpoints/:id/lock', sameOrigin, auth, owner, validId('id'), (req, res) => setEndpointLock(req, res, true));
router.post('/owner/api/endpoints/:id/unlock', sameOrigin, auth, owner, validId('id'), (req, res) => setEndpointLock(req, res, false));

router.delete('/owner/api/endpoints/:id', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const row = (await query('SELECT id,path FROM endpoints WHERE id=$1', [req.params.id]))[0];
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Endpoint tidak ditemukan.');
  // Deleting a live handler's metadata would make it 503 until the next cold start re-registers it.
  if (withHandler(req, row).handler_loaded) return fail(res, 409, 'HANDLER_LOADED', 'Endpoint ini punya plugin aktif. Nonaktifkan atau kunci, jangan hapus metadata-nya.');
  await query('DELETE FROM endpoints WHERE id=$1', [req.params.id]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_delete', targetType: 'endpoint', targetId: req.params.id, metadata: { path: row.path }, ipAddress: ip(req) });
  res.json({ success: true });
});

// ---------------------------------------------------------------- owner: payments
router.get('/owner/payments', auth, owner, async (req, res) => {
  await orderService.expirePendingOrdersSafe();
  const status = String(req.query.status || '').toLowerCase();
  const payments = await query(
    `SELECT p.id,p.order_id,p.provider,p.payment_method,p.transaction_id,p.provider_reference,p.amount,p.proof_url,p.status,p.verified_at,p.created_at,p.updated_at,
            to_jsonb(p.*) ->> 'owner_notified' AS owner_notified,
            EXISTS(SELECT 1 FROM payment_proofs pp WHERE pp.payment_id=p.id) AS has_proof,
            o.order_code,o.tier,o.status AS order_status,COALESCE((to_jsonb(o.*) ->> 'duration_days')::int,30) AS duration_days,
            u.id AS user_id,u.email,u.name
       FROM payments p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=p.user_id
      WHERE ($1='' OR p.status=$1) ORDER BY p.created_at DESC LIMIT 250`,
    [status]
  );
  res.json({ success: true, payments });
});

// The uploaded proof image, owner only. Served as an inert image: no sniffing, no scripts.
router.get('/owner/payments/:id/proof', auth, owner, validId('id'), async (req, res) => {
  const row = (await query("SELECT mime,encode(data,'base64') AS b64 FROM payment_proofs WHERE payment_id=$1", [req.params.id]))[0];
  if (!row) return fail(res, 404, 'PROOF_NOT_FOUND', 'Pembayaran ini tidak punya gambar bukti.');
  res.set('Content-Type', row.mime);
  res.set('Cache-Control', 'private, no-store');
  res.set('Content-Security-Policy', "default-src 'none'; sandbox");
  res.set('Content-Disposition', 'inline; filename="bukti-pembayaran"');
  res.send(Buffer.from(row.b64, 'base64'));
});

// Owner settlement is idempotent: only a pending payment on a pending order changes, inside
// one statement (row locks via FOR UPDATE); a second approve/reject gets 409. Gateway (Pakasir)
// payments may also be approved by hand, e.g. after checking the Pakasir dashboard, because
// automatic verification is off until PAKASIR_V2_VERIFY_URL is configured.
async function settleManual(req, res, approve) {
  const row = await query(
    `WITH candidate AS (SELECT p.id,p.order_id,p.user_id,p.amount,p.provider,o.tier FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1 AND p.provider IN ('manual','pakasir') AND p.status='pending' AND o.status='pending' AND p.amount=o.amount FOR UPDATE),
     upd_p AS (UPDATE payments p SET status=$2,verified_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,updated_at=now() FROM candidate c WHERE p.id=c.id RETURNING p.id,p.order_id,p.user_id),
     upd_o AS (UPDATE orders o SET status=$2,paid_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,updated_at=now() FROM upd_p p WHERE o.id=p.order_id RETURNING o.user_id,o.tier,o.id,o.duration_days),
     paid AS (SELECT * FROM upd_o WHERE $2='paid'),
     upd_u AS (${orderService.applyPaidOrderSql('paid')})
     INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address)
       SELECT $3,$4,'payment',$1,jsonb_build_object('decision',$2,'provider',(SELECT provider FROM candidate),'tier',(SELECT tier FROM upd_u),'tier_expires_at',(SELECT tier_expires_at FROM upd_u)),$5::inet FROM upd_o RETURNING id`,
    [req.params.id, approve ? 'paid' : 'rejected', req.account.id, approve ? 'payment_approve' : 'payment_reject', ip(req)]
  );
  if (!row.length) return fail(res, 409, 'PAYMENT_NOT_PENDING', 'Pembayaran tidak pending atau sudah diproses.');
  res.json({ success: true, status: approve ? 'paid' : 'rejected' });
}
router.post('/owner/payments/:id/approve', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, true));
router.post('/owner/payments/:id/reject', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, false));

// ---------------------------------------------------------------- owner: server, audit, backup
router.get('/owner/server', auth, owner, async (req, res) => {
  const r = await query('SELECT to_jsonb(server_settings.*) AS s FROM server_settings WHERE id=1');
  const row = r[0]?.s || {};
  res.json({ success: true, settings: {
    maintenance_enabled: Boolean(row.maintenance_enabled), maintenance_message: row.maintenance_message || '', updated_at: row.updated_at || null,
    payment_dana_number: row.payment_dana_number || '', payment_dana_name: row.payment_dana_name || '',
    payment_gopay_number: row.payment_gopay_number || '', payment_gopay_name: row.payment_gopay_name || ''
  }, notifications: notifier.status() });
});

router.patch('/owner/server', sameOrigin, auth, owner, async (req, res) => {
  const enabled = req.body?.maintenance_enabled === true;
  const message = String(req.body?.maintenance_message || '').trim().slice(0, 500) || 'Website sedang dalam maintenance. Silakan tunggu sampai maintenance selesai.';
  const r = await query(
    `INSERT INTO server_settings(id,maintenance_enabled,maintenance_message,updated_at,updated_by) VALUES(1,$1,$2,now(),$3)
     ON CONFLICT(id) DO UPDATE SET maintenance_enabled=EXCLUDED.maintenance_enabled,maintenance_message=EXCLUDED.maintenance_message,updated_at=now(),updated_by=EXCLUDED.updated_by RETURNING *`,
    [enabled, message, req.account.id]
  );
  req.app.locals.maintenance?.invalidate();
  await audit.writeAudit({ actorUserId: req.account.id, action: 'maintenance_change', targetType: 'server_settings', metadata: { enabled }, ipAddress: ip(req) });
  res.json({ success: true, settings: r[0] });
});

// Destination accounts buyers see for manual DANA / GoPay transfers. Empty = method hidden.
router.patch('/owner/server/payments', sameOrigin, auth, owner, async (req, res) => {
  const number = v => String(v || '').replace(/[^\d+]/g, '').slice(0, 20);
  const name = v => String(v || '').trim().slice(0, 60);
  const values = [number(req.body?.payment_dana_number), name(req.body?.payment_dana_name), number(req.body?.payment_gopay_number), name(req.body?.payment_gopay_name)];
  for (const n of [values[0], values[2]]) if (n && !/^\+?\d{8,16}$/.test(n)) return fail(res, 400, 'INVALID_NUMBER', 'Nomor harus 8–16 digit.');
  const r = await query(
    `INSERT INTO server_settings(id,payment_dana_number,payment_dana_name,payment_gopay_number,payment_gopay_name,updated_at,updated_by)
     VALUES(1,NULLIF($1,''),NULLIF($2,''),NULLIF($3,''),NULLIF($4,''),now(),$5)
     ON CONFLICT(id) DO UPDATE SET payment_dana_number=EXCLUDED.payment_dana_number,payment_dana_name=EXCLUDED.payment_dana_name,
       payment_gopay_number=EXCLUDED.payment_gopay_number,payment_gopay_name=EXCLUDED.payment_gopay_name,updated_at=now(),updated_by=EXCLUDED.updated_by
     RETURNING payment_dana_number,payment_dana_name,payment_gopay_number,payment_gopay_name`,
    [...values, req.account.id]
  );
  await audit.writeAudit({ actorUserId: req.account.id, action: 'payment_settings_change', targetType: 'server_settings', ipAddress: ip(req) });
  res.json({ success: true, settings: r[0] });
});

// Everything happening on the site: account events (audit log), API calls and page visits.
router.get('/owner/activity', auth, owner, async (req, res) => {
  const kind = ['account', 'api', 'page'].includes(req.query.kind) ? req.query.kind : '';
  const q = String(req.query.q || '').slice(0, 100);
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const rows = await activity.recent({ kind, q, limit });
  const [online] = await query("SELECT count(*)::int AS n FROM users WHERE (to_jsonb(users.*) ->> 'last_seen_at')::timestamptz > now()-interval '5 minutes'").catch(() => [{ n: null }]);
  res.json({ success: true, activity: rows, onlineUsers: online?.n ?? null });
});

router.get('/owner/audit', auth, owner, async (req, res) => {
  const action = String(req.query.action || '').slice(0, 60);
  res.json({ success: true, logs: await query("SELECT a.*,u.email AS actor_email FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id WHERE ($1='' OR a.action=$1) ORDER BY a.created_at DESC LIMIT 300", [action]) });
});

router.get('/owner/backup', auth, owner, async (req, res) => {
  const names = ['users', 'api_keys', 'endpoints', 'orders', 'payments', 'audit_logs', 'server_settings'];
  const backup = { generatedAt: new Date().toISOString(), version: 1, data: {} };
  for (const table of names) {
    backup.data[table] = await query(table === 'api_keys' ? 'SELECT id,user_id,name,key_hash,key_prefix,status,last_used_at,created_at,revoked_at FROM api_keys' : `SELECT * FROM ${table}`);
  }
  await audit.writeAudit({ actorUserId: req.account.id, action: 'backup_create', targetType: 'backup', ipAddress: ip(req) });
  res.setHeader('Content-Disposition', `attachment; filename="yannz-api-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Cache-Control', 'no-store');
  res.json(backup);
});

// ---------------------------------------------------------------- Pakasir webhook
// The webhook body is never trusted on its own: amount/order are checked against the database
// and the payment must be confirmed by a server-side provider lookup (fail-closed until
// PAKASIR_V2_VERIFY_URL is configured). Settlement is idempotent, so replays cannot upgrade twice.
router.post('/webhooks/pakasir', async (req, res) => {
  const b = req.body || {};
  const code = String(b.order_id || '');
  const amount = Number(b.amount);
  if (!code || !Number.isFinite(amount) || !process.env.PAKASIR_PROJECT || String(b.project || '') !== process.env.PAKASIR_PROJECT || String(b.status || '').toLowerCase() !== 'completed') {
    return fail(res, 400, 'INVALID_PAYMENT', 'Payload transaksi tidak valid.');
  }
  const order = (await query('SELECT * FROM orders WHERE order_code=$1', [code]))[0];
  if (!order || Number(order.amount) !== amount) return fail(res, 400, 'INVALID_PAYMENT', 'Order atau nominal tidak cocok.');
  if (order.status === 'paid') return res.json({ success: true, processed: false, duplicate: true });
  if (order.status !== 'pending') return fail(res, 409, 'ORDER_NOT_PENDING', 'Order tidak lagi pending.');
  let verified = false;
  try {
    verified = await pakasir.verifyTransaction(code, amount);
  } catch (e) {
    console.error('Pakasir verification failed:', { status: e?.response?.status || null, code: e?.code || null });
  }
  if (!verified) return fail(res, 202, 'PAYMENT_NOT_VERIFIED', 'Transaksi belum terverifikasi oleh provider.');
  const tx = await query(
    `WITH upd_p AS (UPDATE payments SET status='paid',verified_at=now(),updated_at=now() WHERE id=(SELECT id FROM payments WHERE order_id=$1 AND provider='pakasir' AND status='pending' AND amount=$2 ORDER BY created_at DESC LIMIT 1) RETURNING id,order_id,user_id),
     upd_o AS (UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1 AND status='pending' AND amount=$2 AND EXISTS(SELECT 1 FROM upd_p) RETURNING user_id,tier,id,duration_days),
     upd_u AS (${orderService.applyPaidOrderSql('upd_o')})
     INSERT INTO audit_logs(action,target_type,target_id,metadata) SELECT 'pakasir_webhook_paid','order',$1,jsonb_build_object('amount',$2::int) FROM upd_u RETURNING id`,
    [order.id, amount]
  );
  return res.json({ success: true, processed: tx.length > 0, duplicate: tx.length === 0 });
});

// Route handlers are async; forward rejections to the error handler below.
for (const layer of router.stack) {
  if (layer.route) for (const routeLayer of layer.route.stack) {
    const original = routeLayer.handle;
    routeLayer.handle = (req, res, next) => Promise.resolve(original(req, res, next)).catch(next);
  }
}

router.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.code === '22P02') return fail(res, 404, 'NOT_FOUND', 'Data tidak ditemukan.');
  if (err?.isDatabaseError) {
    const c = classifyDatabaseError(err);
    console.error('Platform route failed:', { path: req.path, error: c.error, code: c.code });
    // dbCode is the SQLSTATE (e.g. 23514), never the SQL text or parameters: it lets the
    // owner diagnose schema drift from a screenshot without access to server logs.
    return fail(res, 503, c.error === 'DATABASE_SCHEMA_OUTDATED' ? c.error : 'DATABASE_UNAVAILABLE', 'Layanan data sementara tidak tersedia.', { dbCode: /^[0-9A-Z]{5}$/.test(c.code) ? c.code : null });
  }
  console.error('Platform route failed:', { path: req.path, name: err?.name || null, code: err?.code || null });
  return fail(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan server.');
});

module.exports = router;
