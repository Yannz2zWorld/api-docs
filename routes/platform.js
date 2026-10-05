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

const router = express.Router();
const VIEWS = path.join(__dirname, '..', 'views');
const MANUAL_METHODS = ['DANA', 'GOPAY', 'QRIS', 'BANK_TRANSFER'];
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
    user: { id: req.account.id, name: req.account.name, email: req.account.email, picture: req.account.picture, tier: req.account.tier, isOwner: req.account.isOwner },
    usage: usagePayload(req.account.tier, used),
    apiKeys: { used: ks.filter(k => k.status === 'active').length, limit: finite(t.keys) }
  });
});

// ---------------------------------------------------------------- API keys
router.get('/api/keys', auth, async (req, res) => {
  res.json({ success: true, keys: await keys.listKeys(req.account.id), limit: finite(tiers.getTier(req.account.tier).keys), tier: req.account.tier });
});

router.post('/api/keys', sameOrigin, auth, async (req, res) => {
  try {
    const made = await keys.createKey(req.account, req.body?.name, String(req.get('Idempotency-Key') || '').slice(0, 100) || null);
    await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_create', targetType: 'api_key', targetId: made.record.id, ipAddress: ip(req) });
    res.status(201).json({ success: true, key: made.key, record: made.record, warning: 'Salin key sekarang. Plaintext hanya ditampilkan satu kali.' });
  } catch (e) {
    if (e.code === 'KEY_LIMIT' || e.code === 'KEYS_NOT_INCLUDED') return fail(res, 403, e.code, e.message);
    if (e.code === 'IDEMPOTENCY_REPLAY') return fail(res, 409, e.code, e.message);
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
  if (tiers.getTier(tier).rank <= tiers.getTier(req.account.tier).rank) return fail(res, 400, 'TIER_NOT_UPGRADE', `Tier kamu (${req.account.tier}) sudah setara atau lebih tinggi dari ${tier}.`);
  await orderService.expirePendingOrders();
  const pending = (await query("SELECT count(*)::int AS n FROM orders WHERE user_id=$1 AND status='pending'", [req.account.id]))[0].n;
  const idem = String(req.get('Idempotency-Key') || '').slice(0, 100) || null;
  if (pending >= MAX_PENDING_ORDERS) {
    // Only a replay of an order that already exists is exempt; a fresh Idempotency-Key is not.
    const replay = idem && (await query('SELECT 1 FROM orders WHERE user_id=$1 AND idempotency_key=$2', [req.account.id, idem])).length > 0;
    if (!replay) return fail(res, 429, 'TOO_MANY_PENDING_ORDERS', `Maksimal ${MAX_PENDING_ORDERS} order pending. Selesaikan atau tunggu order lama kedaluwarsa.`);
  }
  // Amount always comes from the server-side tier table; any client-sent amount is ignored.
  const amount = tiers.TIERS[tier].price;
  const code = `YAN-${tier}-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
  const rows = await query(
    `INSERT INTO orders(user_id,order_code,tier,amount,status,expires_at,idempotency_key)
     VALUES($1,$2,$3,$4,'pending',now()+interval '2 hours',$5)
     ON CONFLICT(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET updated_at=orders.updated_at WHERE orders.tier=EXCLUDED.tier
     RETURNING id,order_code,tier,amount,status,created_at,expires_at`,
    [req.account.id, code, tier, amount, idem]
  );
  if (!rows.length) return fail(res, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key sudah dipakai untuk paket yang berbeda.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'order_create', targetType: 'order', targetId: rows[0].id, metadata: { tier, amount }, ipAddress: ip(req) });
  res.status(201).json({ success: true, order: rows[0] });
});

router.get('/api/orders', auth, async (req, res) => {
  await orderService.expirePendingOrders();
  const orders = await query(
    `SELECT o.id,o.order_code,o.tier,o.amount,o.status,o.created_at,o.expires_at,o.paid_at,
            p.id AS payment_id,p.provider,p.payment_method,p.status AS payment_status,p.proof_url,
            p.payment_url,p.qr_string,p.va_number,p.gateway_expires_at
       FROM orders o
       LEFT JOIN LATERAL (SELECT * FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) p ON true
      WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 100`,
    [req.account.id]
  );
  res.json({ success: true, orders, manualMethods: MANUAL_METHODS, gatewayMethods: pakasir.METHODS, gatewayConfigured: pakasir.isConfigured(), contact: settings.whatsappLink, manualInstructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || null });
});

async function pendingOrderFor(req) {
  await orderService.expirePendingOrders();
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
  const tx = data?.transaction || data?.data || data || {};
  const txnId = String(tx.txn_id || tx.transaction_id || order.order_code);
  const ref = String(tx.txn_id || tx.payment_number || tx.transaction_id || tx.reference || order.order_code);
  const gateway = { txn_id: tx.txn_id || null, payment_link: tx.payment_link || null, qr_string: tx.qr_string || null, va_number: tx.va_number || tx.payment_number || null, expired_at: tx.expired_at || null, total_payment: tx.total_payment || order.amount };
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

router.post('/api/orders/:id/manual', sameOrigin, auth, validId('id'), async (req, res) => {
  const method = String(req.body?.method || '').toUpperCase();
  if (!MANUAL_METHODS.includes(method)) return fail(res, 400, 'INVALID_PAYMENT_METHOD', 'Metode manual tidak valid.');
  const proof = String(req.body?.proof_url || '').trim();
  let proofUrl;
  try { proofUrl = new URL(proof); } catch {}
  if (!proofUrl || proofUrl.protocol !== 'https:' || proof.length > 2048) return fail(res, 400, 'INVALID_PROOF_URL', 'Bukti pembayaran harus berupa URL HTTPS yang valid.');
  const order = await pendingOrderFor(req);
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order tidak ditemukan atau kedaluwarsa.');
  let payment;
  try {
    // payments_one_pending_manual_uidx (migration 005) makes "one pending proof per order" atomic.
    payment = (await query(
      `INSERT INTO payments(order_id,user_id,provider,payment_method,amount,proof_url,status)
       SELECT $1,$2,'manual',$3,$4,$5,'pending'
        WHERE NOT EXISTS (SELECT 1 FROM payments WHERE order_id=$1 AND provider='manual' AND status='pending')
       RETURNING id,status,proof_url,created_at`,
      [order.id, req.account.id, method, order.amount, proofUrl.href]
    ))[0];
  } catch (e) {
    if (e.code !== '23505') throw e;
  }
  if (!payment) return fail(res, 409, 'PAYMENT_ALREADY_SUBMITTED', 'Bukti pembayaran untuk order ini sudah dikirim dan sedang menunggu approval owner.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'manual_payment_create', targetType: 'payment', targetId: payment.id, metadata: { method, amount: order.amount }, ipAddress: ip(req) });
  const notice = await notifier.notifyManualPayment({ order: order.order_code, tier: order.tier, amount: order.amount, method });
  res.status(201).json({
    success: true,
    payment,
    status: 'PAYMENT_PENDING',
    instructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || 'Bukti diterima. Status menunggu approval owner.',
    contact: settings.whatsappLink,
    notification: notice.sent ? 'sent' : 'not_configured'
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
            COALESCE(d.request_count,0)::int AS used_today,
            (SELECT count(*)::int FROM api_keys k WHERE k.user_id=u.id AND k.status='active') AS active_keys
       FROM users u
       LEFT JOIN daily_quota_counters d ON d.user_id=u.id AND d.usage_date=(now() AT TIME ZONE 'UTC')::date
      WHERE (u.email ILIKE $1 OR u.name ILIKE $1)
        AND ($2='' OR u.tier=$2) AND ($3='' OR u.status=$3)
      ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
    [`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`, tier, status, limit, offset]
  );
  res.json({ success: true, users: rows.map(u => { const m = users.mapUser(u); return { ...u, tier: m.tier, isOwner: m.isOwner }; }), limit, offset });
});

router.get('/owner/users/:id', auth, owner, validId('id'), async (req, res) => {
  const u = (await query('SELECT id,google_id,email,name,picture,tier,status,created_at,updated_at,banned_at,ban_reason,email_verified,(password_hash IS NOT NULL) AS has_password FROM users WHERE id=$1', [req.params.id]))[0];
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User tidak ditemukan.');
  const mapped = users.mapUser(u);
  const [daily, apiKeys, orders] = await Promise.all([
    query("SELECT usage_date::text AS date,request_count AS used FROM daily_quota_counters WHERE user_id=$1 ORDER BY usage_date DESC LIMIT 14", [u.id]),
    keys.listKeys(u.id),
    query(`SELECT o.id,o.order_code,o.tier,o.amount,o.status,o.created_at,o.paid_at,p.provider,p.status AS payment_status
             FROM orders o LEFT JOIN LATERAL (SELECT provider,status FROM payments WHERE order_id=o.id ORDER BY created_at DESC LIMIT 1) p ON true
            WHERE o.user_id=$1 ORDER BY o.created_at DESC LIMIT 50`, [u.id])
  ]);
  const todayKey = new Date().toISOString().slice(0, 10);
  const usedToday = daily.find(d => d.date === todayKey)?.used || 0;
  const { google_id, ...profile } = u;
  profile.loginMethods = [google_id ? 'google' : null, u.has_password ? 'password' : null].filter(Boolean);
  res.json({ success: true, user: { ...profile, storedTier: u.tier, tier: mapped.tier, isOwner: mapped.isOwner }, usage: { ...usagePayload(mapped.tier, usedToday), history: daily }, apiKeys, apiKeyLimit: finite(tiers.getTier(mapped.tier).keys), orders });
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
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  const r = await query('UPDATE users SET tier=$2,updated_at=now() WHERE id=$1 RETURNING id,tier', [req.params.id, tier]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_tier_change', targetType: 'user', targetId: req.params.id, metadata: { tier }, ipAddress: ip(req) });
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

router.post('/owner/users/:id/keys/:keyId/revoke', sameOrigin, auth, owner, validId('id', 'keyId'), async (req, res) => {
  const ok = await keys.revokeKey(req.params.id, req.params.keyId);
  if (!ok) return fail(res, 404, 'KEY_NOT_FOUND', 'API key tidak ditemukan atau sudah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_revoke', targetType: 'api_key', targetId: req.params.keyId, metadata: { userId: req.params.id }, ipAddress: ip(req) });
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
  await orderService.expirePendingOrders();
  const status = String(req.query.status || '').toLowerCase();
  const payments = await query(
    `SELECT p.id,p.order_id,p.provider,p.payment_method,p.transaction_id,p.provider_reference,p.amount,p.proof_url,p.status,p.verified_at,p.created_at,p.updated_at,
            o.order_code,o.tier,o.status AS order_status,u.id AS user_id,u.email,u.name
       FROM payments p JOIN orders o ON o.id=p.order_id JOIN users u ON u.id=p.user_id
      WHERE ($1='' OR p.status=$1) ORDER BY p.created_at DESC LIMIT 250`,
    [status]
  );
  res.json({ success: true, payments });
});

// Manual settlement is idempotent: only a pending manual payment on a pending order changes,
// inside one statement (row locks via FOR UPDATE); a second approve/reject gets 409.
async function settleManual(req, res, approve) {
  const row = await query(
    `WITH candidate AS (SELECT p.id,p.order_id,p.user_id,p.amount,o.tier FROM payments p JOIN orders o ON o.id=p.order_id WHERE p.id=$1 AND p.provider='manual' AND p.status='pending' AND o.status='pending' AND p.amount=o.amount FOR UPDATE),
     upd_p AS (UPDATE payments p SET status=$2,verified_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,updated_at=now() FROM candidate c WHERE p.id=c.id RETURNING p.id,p.order_id,p.user_id),
     upd_o AS (UPDATE orders o SET status=$2,paid_at=CASE WHEN $2='paid' THEN now() ELSE NULL END,updated_at=now() FROM upd_p p WHERE o.id=p.order_id RETURNING o.user_id,o.tier,o.id),
     upd_u AS (UPDATE users u SET tier=CASE WHEN $2='paid' AND (CASE u.tier WHEN 'OWNER' THEN 4 WHEN 'DEWA' THEN 3 WHEN 'SEPUH' THEN 2 WHEN 'SULTAN' THEN 1 ELSE 0 END)<(CASE upd_o.tier WHEN 'DEWA' THEN 3 WHEN 'SEPUH' THEN 2 ELSE 1 END) THEN upd_o.tier ELSE u.tier END,updated_at=now() FROM upd_o WHERE u.id=upd_o.user_id RETURNING u.id)
     INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) SELECT $3,$4,'payment',$1,jsonb_build_object('decision',$2),$5::inet FROM upd_u RETURNING id`,
    [req.params.id, approve ? 'paid' : 'rejected', req.account.id, approve ? 'payment_approve' : 'payment_reject', ip(req)]
  );
  if (!row.length) return fail(res, 409, 'PAYMENT_NOT_PENDING', 'Pembayaran tidak pending atau sudah diproses.');
  res.json({ success: true, status: approve ? 'paid' : 'rejected' });
}
router.post('/owner/payments/:id/approve', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, true));
router.post('/owner/payments/:id/reject', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, false));

// ---------------------------------------------------------------- owner: server, audit, backup
router.get('/owner/server', auth, owner, async (req, res) => {
  const r = await query('SELECT maintenance_enabled,maintenance_message,updated_at FROM server_settings WHERE id=1');
  res.json({ success: true, settings: r[0] || { maintenance_enabled: false, maintenance_message: '' } });
});

router.patch('/owner/server', sameOrigin, auth, owner, async (req, res) => {
  const enabled = req.body?.maintenance_enabled === true;
  const message = String(req.body?.maintenance_message || 'Yannz API sedang dalam maintenance.').slice(0, 500);
  const r = await query(
    `INSERT INTO server_settings(id,maintenance_enabled,maintenance_message,updated_at,updated_by) VALUES(1,$1,$2,now(),$3)
     ON CONFLICT(id) DO UPDATE SET maintenance_enabled=EXCLUDED.maintenance_enabled,maintenance_message=EXCLUDED.maintenance_message,updated_at=now(),updated_by=EXCLUDED.updated_by RETURNING *`,
    [enabled, message, req.account.id]
  );
  await audit.writeAudit({ actorUserId: req.account.id, action: 'maintenance_change', targetType: 'server_settings', metadata: { enabled }, ipAddress: ip(req) });
  res.json({ success: true, settings: r[0] });
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
     upd_o AS (UPDATE orders SET status='paid',paid_at=now(),updated_at=now() WHERE id=$1 AND status='pending' AND amount=$2 AND EXISTS(SELECT 1 FROM upd_p) RETURNING user_id,tier,id),
     upd_u AS (UPDATE users u SET tier=CASE WHEN (CASE u.tier WHEN 'OWNER' THEN 4 WHEN 'DEWA' THEN 3 WHEN 'SEPUH' THEN 2 WHEN 'SULTAN' THEN 1 ELSE 0 END)<(CASE upd_o.tier WHEN 'DEWA' THEN 3 WHEN 'SEPUH' THEN 2 ELSE 1 END) THEN upd_o.tier ELSE u.tier END,updated_at=now() FROM upd_o WHERE u.id=upd_o.user_id RETURNING u.id)
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
    return fail(res, 503, c.error === 'DATABASE_SCHEMA_OUTDATED' ? c.error : 'DATABASE_UNAVAILABLE', 'Layanan data sementara tidak tersedia.');
  }
  console.error('Platform route failed:', { path: req.path, name: err?.name || null, code: err?.code || null });
  return fail(res, 500, 'INTERNAL_ERROR', 'Terjadi kesalahan server.');
});

module.exports = router;
