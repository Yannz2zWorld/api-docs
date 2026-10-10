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
const builder = require('../services/endpointBuilder');
const theresav = require('../lib/theresav');
const apiproxy = require('../lib/apiproxy');
const cdn = require('../services/cdnService');
const backups = require('../services/backupService');
const endpointStatus = require('../services/endpointStatusService');
const endpointChecks = require('../services/endpointCheckService');
const errorLog = require('../services/errorLogService');

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
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) return fail(res, 403, 'CSRF_BLOCKED', 'Permintaan dari origin lain ditolak.');
  if (req.get('sec-fetch-site') === 'cross-site') return fail(res, 403, 'CSRF_BLOCKED', 'Permintaan dari origin lain ditolak.');
  next();
}

async function loadAccount(req) {
  const session = req.app.locals.getSession(req);
  if (!session) return { error: [401, 'AUTH_REQUIRED', 'Login dulu ya.'] };
  const user = await users.getUserForSession(session);
  if (!user) return { error: [401, 'AUTH_REQUIRED', 'Akun nggak ketemu. Login lagi ya.'] };
  if (user.status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun kamu lagi nggak aktif.'] };
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
  if (!req.account?.isOwner) return fail(res, 403, 'OWNER_REQUIRED', 'Cuma developer yang bisa akses ini.');
  next();
}

function validId(...names) {
  return (req, res, next) => {
    for (const n of names) if (!UUID_RE.test(String(req.params[n] || ''))) return fail(res, 404, 'NOT_FOUND', 'Datanya nggak ketemu.');
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
router.get('/upload', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'upload.html')));
router.get('/custom-ui', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'custom-ui.html')));

// ---------------------------------------------------------------- CDN upload (website feature)
// Used by the /upload page; a site feature for signed-in accounts, not an API endpoint (no API key,
// no daily API quota). Each account may start at most CDN_UPLOADS_PER_HOUR uploads per hour (per
// instance, best effort) and keep at most CDN_ACCOUNT_LIMIT_MB (default 2048) of active files.
//   Small files (<= 4 MB): POST /cdn/upload with the raw file as body (stored in Postgres).
//   Large files (<= 200 MB), never through Vercel (4.5 MB limit):
//     with Cloudflare R2: POST /cdn/upload/start -> browser PUTs to R2 -> POST /cdn/upload/finish;
//     otherwise catbox.moe: the browser uploads there -> POST /cdn/upload/register with the link.
const CDN_UPLOADS_PER_HOUR = 30;
const cdnUploads = new Map();   // account id -> timestamps of recent uploads
function uploadSlot(req, res) {
  const now = Date.now();
  const recent = (cdnUploads.get(req.account.id) || []).filter(t => now - t < 3600 * 1000);
  if (recent.length >= CDN_UPLOADS_PER_HOUR && !req.account.isOwner) {
    res.set('Retry-After', String(Math.ceil((recent[0] + 3600 * 1000 - now) / 1000)));
    fail(res, 429, 'UPLOAD_LIMIT', `Maksimal ${CDN_UPLOADS_PER_HOUR} upload per jam. Coba lagi nanti ya.`);
    return null;
  }
  return () => {
    recent.push(now);
    cdnUploads.set(req.account.id, recent);
    if (cdnUploads.size > 5000) cdnUploads.clear();
  };
}
const ttlOf = v => Math.max(0, Math.min(24 * 365, Number(v) || 0));
const mb = n => Math.round(n / 1048576);
function cdnFail(res, e) {
  if (e.code === 'FILE_TOO_LARGE') return fail(res, 413, 'FILE_TOO_LARGE', `File maksimal ${mb(cdn.largeEnabled() || cdn.catboxEnabled() ? cdn.MAX_LARGE_BYTES : cdn.MAX_BYTES)} MB.`);
  if (e.code === 'NO_FILE') return fail(res, 400, 'NO_FILE', 'File-nya kosong.');
  if (e.code === 'ACCOUNT_STORAGE_FULL') return fail(res, 413, 'ACCOUNT_STORAGE_FULL', `Penyimpanan akun kamu penuh (maks ${mb(e.limit)} MB file aktif). Tunggu file sementara kedaluwarsa dulu atau hubungi developer.`);
  if (e.code === 'R2_NOT_CONFIGURED') return fail(res, 503, 'LARGE_UPLOAD_UNAVAILABLE', `Upload file besar belum aktif. Maksimal ${mb(cdn.MAX_BYTES)} MB.`);
  if (e.code === 'NOT_FOUND') return fail(res, 404, 'NOT_FOUND', 'Upload-nya nggak ketemu.');
  if (e.code === 'INVALID_URL') return fail(res, 400, 'INVALID_URL', 'Link file-nya nggak valid.');
  if (e.code === 'CATBOX_DISABLED') return fail(res, 503, 'LARGE_UPLOAD_UNAVAILABLE', `Upload file besar lagi dimatikan. Maksimal ${mb(cdn.MAX_BYTES)} MB.`);
  if (['UPLOAD_MISSING', 'UPLOAD_SIZE_MISMATCH', 'UPLOAD_TYPE_MISMATCH'].includes(e.code)) return fail(res, 400, e.code, 'Upload-nya nggak lengkap atau nggak sesuai. Coba upload ulang ya.');
  if (migrationMissing(e) || e.code === 'DATABASE_NOT_CONFIGURED' || e.isDatabaseError) return fail(res, 503, 'CDN_UNAVAILABLE', 'Penyimpanan belum siap. Jalankan dulu migrasi 012, 013 dan 014 di Neon.');
  console.error('CDN upload failed:', { code: e?.code || null });
  return fail(res, 502, 'CDN_FAILED', 'Upload gagal. Coba lagi ya.');
}
const resultJson = (req, f) => ({ status: true, result: { url: cdn.absoluteUrl(req, f.id), id: f.id, name: f.name, mime: f.mime, size: f.size, preview: f.inline, expiresAt: f.expiresAt } });

router.get('/cdn/upload/config', auth, async (req, res) => {
  // Large files go to R2 when it is configured, otherwise to catbox.moe (straight from the browser).
  const mode = cdn.largeEnabled() ? 'r2' : cdn.catboxEnabled() ? 'catbox' : null;
  const large = Boolean(mode);
  let used = null;
  try { used = await cdn.accountUsage(req.account.id); } catch {}
  res.json({ success: true, large, mode, maxBytes: large ? cdn.MAX_LARGE_BYTES : cdn.MAX_BYTES, smallMaxBytes: cdn.MAX_BYTES, accountLimitBytes: req.account.isOwner ? 0 : cdn.accountLimitBytes(), usedBytes: used, perHour: CDN_UPLOADS_PER_HOUR });
});

router.post('/cdn/upload', sameOrigin, auth, async (req, res) => {
  const buf = Buffer.isBuffer(req.body) && req.body.length ? req.body : null;
  if (!buf) return fail(res, 400, 'NO_FILE', 'Pilih dulu file yang mau di-upload.');
  const take = uploadSlot(req, res);
  if (!take) return;
  try {
    if (!req.account.isOwner && cdn.accountLimitBytes() > 0 && (await cdn.accountUsage(req.account.id)) + buf.length > cdn.accountLimitBytes()) throw Object.assign(new Error('full'), { code: 'ACCOUNT_STORAGE_FULL', limit: cdn.accountLimitBytes() });
    const saved = await cdn.store({ buffer: buf, name: typeof req.query.name === 'string' ? req.query.name : null, type: req.get('content-type'), ownerId: req.account.id, ttlHours: ttlOf(req.query.ttlHours) });
    take();
    return res.json(resultJson(req, saved));
  } catch (e) { return cdnFail(res, e); }
});

router.post('/cdn/upload/start', sameOrigin, auth, async (req, res) => {
  const b = req.body || {};
  const take = uploadSlot(req, res);
  if (!take) return;
  try {
    const started = await cdn.startLarge({ name: typeof b.name === 'string' ? b.name : null, type: typeof b.type === 'string' ? b.type : null, size: b.size, ownerId: req.account.id, isOwner: req.account.isOwner, ttlHours: ttlOf(b.ttlHours) });
    take();
    return res.json({ success: true, id: started.id, upload: started.upload });
  } catch (e) { return cdnFail(res, e); }
});

// The browser uploaded the file to catbox.moe itself; record it so the shared link is ours.
router.post('/cdn/upload/register', sameOrigin, auth, async (req, res) => {
  const b = req.body || {};
  const take = uploadSlot(req, res);
  if (!take) return;
  try {
    const f = await cdn.registerCatbox({ url: b.url, name: typeof b.name === 'string' ? b.name : null, type: typeof b.type === 'string' ? b.type : null, ownerId: req.account.id, isOwner: req.account.isOwner, ttlHours: ttlOf(b.ttlHours) });
    take();
    return res.json(resultJson(req, f));
  } catch (e) { return cdnFail(res, e); }
});

router.post('/cdn/upload/finish', sameOrigin, auth, async (req, res) => {
  try {
    const f = await cdn.finishLarge({ id: String(req.body?.id || ''), ownerId: req.account.id });
    return res.json(resultJson(req, f));
  } catch (e) { return cdnFail(res, e); }
});

// ---------------------------------------------------------------- last opened endpoints (dashboard)
// The endpoints this account called most recently (Sandbox, Playground or its API keys), newest
// first, from activity_log (migration 009). Endpoints since removed from the registry are skipped.
router.get('/api/me/recent-endpoints', auth, async (req, res) => {
  const limit = Math.max(1, Math.min(20, Number(req.query.limit) || 9));
  const sql = cols => `SELECT l.path, max(l.created_at) AS last_at, count(*)::int AS calls, ${cols}
      FROM activity_log l JOIN endpoints e ON e.path = l.path
     WHERE l.user_id = $1 AND l.kind = 'api' AND l.created_at > now() - interval '90 days' AND e.status = 'active'
     GROUP BY l.path, ${cols}
     ORDER BY max(l.created_at) DESC LIMIT ${limit}`;
  try {
    let rows;
    try { rows = await query(sql('e.name, e.minimum_tier, e.locked, e.status, e.badge'), [req.account.id]); }
    catch (e) { if (e.code !== '42703') throw e; rows = await query(sql('e.name, e.minimum_tier, e.locked, e.status'), [req.account.id]); }   // before migration 015
    const hidden = await errorLog.hiddenPaths().catch(() => new Set());
    return res.json({ success: true, endpoints: rows.filter(r => !hidden.has(r.path)).map(r => ({ path: r.path, name: r.name, minimumTier: r.minimum_tier, locked: r.locked, status: r.status, badge: r.badge || null, lastAt: r.last_at, calls: r.calls })) });
  } catch (e) {
    if (migrationMissing(e)) return res.json({ success: true, endpoints: [] });
    return fail(res, 503, 'RECENT_UNAVAILABLE', 'Riwayat endpoint lagi nggak bisa dimuat.');
  }
});

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
  if (img.error) return fail(res, 400, img.error, img.error === 'IMAGE_TOO_LARGE' ? 'Foto maksimal 512 KB.' : 'Fotonya harus gambar JPG, PNG atau WebP.');
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
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Foto profil butuh migration 010_user_avatars.sql dulu.');
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
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Foto profilnya nggak ada.');
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

// Custom UI saved on the account (migration 021): the look and colour follow the user to any device.
const UI_STYLES = new Set(['default', 'cream', 'pop', 'neon', 'glass', 'minimal', 'terminal', 'pastel', 'paper',
  'lemon', 'mint', 'sky', 'peach', 'lilac', 'bubblegum', 'coral', 'lime', 'ocean', 'sand', 'comic', 'newsprint', 'matcha',
  'blueprint', 'forest', 'wine', 'mocha', 'slate', 'noir', 'arcade']);
const UI_HEX = /^#[0-9a-f]{6}$/;
router.get('/api/profile/ui', auth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  let ui = null;
  try { ui = (await query('SELECT ui_prefs FROM users WHERE id=$1', [req.account.id]))[0]?.ui_prefs || null; }
  catch (e) { if (!migrationMissing(e)) throw e; }
  res.json({ success: true, user: String(req.account.publicId || req.account.id), ui });
});
router.put('/api/profile/ui', sameOrigin, auth, async (req, res) => {
  const b = req.body || {};
  const style = String(b.style || 'default');
  const accent = typeof b.accent === 'string' ? b.accent.trim().toLowerCase() : '';
  if (!UI_STYLES.has(style)) return fail(res, 400, 'INVALID_STYLE', 'Gaya tampilan ini nggak ada.');
  if (accent && !UI_HEX.test(accent)) return fail(res, 400, 'INVALID_COLOR', 'Warnanya harus kode HEX, misal #ffd60a.');
  // Scythe colours (views/scythe-color.js): handle, head and effects, each a HEX colour.
  let scythe = null;
  if (b.scythe != null) {
    const c = b.scythe;
    if (typeof c !== 'object' || !['handle', 'head', 'fx'].every(k => typeof c[k] === 'string' && UI_HEX.test(c[k].trim().toLowerCase()))) return fail(res, 400, 'INVALID_COLOR', 'Warna scythe harus kode HEX, misal #ff1a2c.');
    scythe = { handle: c.handle.trim().toLowerCase(), head: c.head.trim().toLowerCase(), fx: c.fx.trim().toLowerCase() };
  }
  const ui = { style, accent, rgb: b.rgb === true, ...(scythe ? { scythe } : {}) };
  try { await query('UPDATE users SET ui_prefs=$2::jsonb, updated_at=now() WHERE id=$1', [req.account.id, JSON.stringify(ui)]); }
  catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Simpan tampilan ke akun butuh migration 021_user_ui.sql dulu.');
    throw e;
  }
  res.json({ success: true, ui });
});

// Account name for the live chat / profile. Empty = back to the name derived from the email.
router.patch('/api/profile', sameOrigin, auth, async (req, res) => {
  const raw = typeof req.body?.displayName === 'string' ? req.body.displayName.trim().replace(/\s+/g, ' ') : null;
  if (raw === null) return fail(res, 400, 'INVALID_NAME', 'Isi dulu nama akunnya.');
  if (raw && (!NAME_RE.test(raw) || RESERVED_NAMES.test(raw))) return fail(res, 400, 'INVALID_NAME', 'Nama akun 2–24 karakter: huruf, angka, spasi, titik, _ atau -. Nama kayak "Owner"/"Admin" nggak boleh dipakai.');
  try {
    await query('UPDATE users SET display_name=$2,updated_at=now() WHERE id=$1', [req.account.id, raw || null]);
  } catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Fitur ini butuh migration 009_key_tiers_profile_chat.sql dulu.');
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
  if (!acc) return fail(res, 404, 'USER_NOT_FOUND', 'Akun nggak ketemu.');
  if (!acc.password_hash) {
    const weak = passwords.passwordProblem(next);
    if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
    const created = await users.setPassword(acc.id, await passwords.hashPassword(next));
    await audit.writeAudit({ actorUserId: acc.id, action: 'password_create', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
    const session = req.app.locals.getSession(req) || {};
    req.app.locals.issueSession(res, session.sub || acc.id, { id: acc.id, email: acc.email, name: acc.name, picture: acc.picture || '', sessionVersion: Number(created?.session_version || 0) }, session.provider || 'google');
    return res.json({ success: true, created: true, message: 'Sandi website udah dibuat. Sekarang kamu juga bisa login pakai email + sandi ini (login Google tetap bisa dipakai).' });
  }
  if (acc.locked_until && new Date(acc.locked_until) > new Date()) return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Kebanyakan salah masukin sandi. Coba lagi 15 menit lagi ya.');
  if (!current || current.length > 128 || !(await passwords.verifyPassword(current, acc.password_hash))) {
    await users.recordFailedLogin(acc.id);
    await audit.writeAudit({ actorUserId: acc.id, action: 'password_change_failed', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
    return fail(res, 400, 'WRONG_PASSWORD', 'Sandi yang sekarang salah.');
  }
  const weak = passwords.passwordProblem(next);
  if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
  if (current === next) return fail(res, 400, 'SAME_PASSWORD', 'Sandi baru harus beda dari sandi lama.');
  const updated = await users.setPassword(acc.id, await passwords.hashPassword(next));
  await audit.writeAudit({ actorUserId: acc.id, action: 'password_change', targetType: 'user', targetId: acc.id, ipAddress: ip(req) }).catch(() => {});
  // setPassword bumped the session version: re-issue this browser's cookie so it stays signed in.
  const session = req.app.locals.getSession(req) || {};
  req.app.locals.issueSession(res, session.sub || acc.id, { id: acc.id, email: acc.email, name: acc.name, picture: acc.picture || '', sessionVersion: Number(updated?.session_version || 0) }, session.provider || 'password');
  res.json({ success: true, message: 'Sandi berhasil diganti. Perangkat lain udah otomatis logout.' });
});
router.get('/billing', pageAuth, (req, res) => res.sendFile(path.join(VIEWS, 'billing.html')));
router.get('/owner', pageAuth, (req, res) => {
  if (!req.account.isOwner) return res.status(403).send('Cuma developer yang bisa akses ini.');
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
      return fail(res, 429, 'TOO_MANY_ATTEMPTS', 'Kebanyakan nyoba custom key. Coba lagi 1 jam lagi ya.');
    }
    if (customValue) await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_custom_attempt', targetType: 'api_key', ipAddress: ip(req) });
    const made = await keys.createKey(req.account, req.body?.name, String(req.get('Idempotency-Key') || '').slice(0, 100) || null, customValue);
    await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_create', targetType: 'api_key', targetId: made.record.id, ipAddress: ip(req) });
    res.status(201).json({ success: true, key: made.key, record: made.record, warning: 'Salin key-nya sekarang, key lengkapnya cuma ditampilkan sekali.' });
  } catch (e) {
    if (e.code === 'KEY_LIMIT' || e.code === 'KEYS_NOT_INCLUDED') return fail(res, 403, e.code, e.message);
    if (e.code === 'IDEMPOTENCY_REPLAY' || e.code === 'CUSTOM_KEY_TAKEN') return fail(res, 409, e.code, e.message);
    if (e.code === 'INVALID_CUSTOM_KEY') return fail(res, 400, e.code, e.message);
    throw e;
  }
});

async function revokeOwnKey(req, res) {
  const ok = await keys.revokeKey(req.account.id, req.params.id);
  if (!ok) return fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu atau udah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'api_key_revoke', targetType: 'api_key', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true });
}
router.delete('/api/keys/:id', sameOrigin, auth, validId('id'), revokeOwnKey);
router.post('/api/keys/:id/revoke', sameOrigin, auth, validId('id'), revokeOwnKey);

// ---------------------------------------------------------------- orders & payments (user)
router.post('/api/orders', sameOrigin, auth, async (req, res) => {
  const tier = String(req.body?.tier || '').toUpperCase();
  if (!tiers.purchasable.includes(tier)) return fail(res, 400, 'INVALID_TIER', 'Paket yang dipilih nggak valid.');
  const rawDays = req.body?.duration_days ?? tiers.DURATION.default;
  const days = Number(rawDays);
  if (!Number.isInteger(days) || days < tiers.DURATION.min || days > tiers.DURATION.max) {
    return fail(res, 400, 'INVALID_DURATION', `Durasi harus ${tiers.DURATION.min}–${tiers.DURATION.max} hari.`);
  }
  const current = tiers.getTier(req.account.tier).rank;
  const wanted = tiers.getTier(tier).rank;
  if (wanted < current) return fail(res, 400, 'TIER_NOT_UPGRADE', `Tier kamu (${req.account.tier}) udah lebih tinggi dari ${tier}.`);
  // Same tier = extension; only possible when the current tier actually expires.
  if (wanted === current && !req.account.tierExpiresAt) return fail(res, 400, 'TIER_NOT_UPGRADE', `Tier ${tier} kamu nggak ada masa berlakunya, jadi nggak perlu diperpanjang.`);
  await orderService.expirePendingOrdersSafe();
  const pending = (await query("SELECT count(*)::int AS n FROM orders WHERE user_id=$1 AND status='pending'", [req.account.id]))[0].n;
  const idem = String(req.get('Idempotency-Key') || '').slice(0, 100) || null;
  if (pending >= MAX_PENDING_ORDERS) {
    // Only a replay of an order that already exists is exempt; a fresh Idempotency-Key is not.
    const replay = idem && (await query('SELECT 1 FROM orders WHERE user_id=$1 AND idempotency_key=$2', [req.account.id, idem])).length > 0;
    if (!replay) return fail(res, 429, 'TOO_MANY_PENDING_ORDERS', `Maksimal ${MAX_PENDING_ORDERS} order pending. Selesaikan dulu atau tunggu order lama kedaluwarsa.`);
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
  if (!rows.length) return fail(res, 409, 'IDEMPOTENCY_CONFLICT', 'Idempotency key ini udah dipakai buat paket lain.');
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
      QRIS_GATEWAY: { available: pakasir.isEnabled(), maintenance: !pakasir.isEnabled(), autoVerified: pakasir.isVerificationConfigured() },
      QRIS: { available: true, image: '/assets/qris-manual.jpg' },
      DANA: { available: Boolean(accounts.DANA), account: accounts.DANA },
      GOPAY: { available: Boolean(accounts.GOPAY), account: accounts.GOPAY }
    },
    // Kept for older clients.
    manualMethods: MANUAL_METHODS,
    gatewayMethods: pakasir.METHODS,
    gatewayConfigured: pakasir.isEnabled(),
    ownerContact: notifier.status(),
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
  if (!pakasir.isEnabled()) return fail(res, 503, 'PAYMENT_GATEWAY_MAINTENANCE', 'Payment gateway lagi maintenance. Bayar manual aja lewat QRIS, DANA atau GoPay, terus upload buktinya.');
  const order = await pendingOrderFor(req);
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order nggak ketemu atau udah kedaluwarsa.');
  let data;
  try {
    data = await pakasir.createTransaction(order.order_code, method, order.amount);
  } catch (e) {
    if (e.code === 'PAYMENT_NOT_CONFIGURED') return fail(res, 503, e.code, 'Pembayaran otomatis belum diatur. Pakai pembayaran manual dulu ya.');
    if (e.code === 'INVALID_PAYMENT_METHOD' || e.code === 'INVALID_PAYMENT_AMOUNT') return fail(res, 400, e.code, e.message);
    console.error('Pakasir create failed:', { status: e?.response?.status || null, code: e?.code || null });
    return fail(res, 502, 'PAYMENT_PROVIDER_ERROR', 'Gateway pembayaran lagi nggak bisa memproses transaksi.');
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
  res.status(201).json({ success: true, payment, gateway, note: 'Status tetap pending sampai pembayaran diverifikasi server.' });
});

// The gateway's QRIS payload rendered as a scannable image (never leaves our server).
router.get('/api/orders/:id/qr.svg', auth, validId('id'), async (req, res) => {
  const row = (await query(
    `SELECT p.qr_string FROM payments p JOIN orders o ON o.id=p.order_id
      WHERE o.id=$1 AND o.user_id=$2 AND p.provider='pakasir' AND p.qr_string IS NOT NULL
      ORDER BY p.created_at DESC LIMIT 1`,
    [req.params.id, req.account.id]
  ))[0];
  if (!row) return fail(res, 404, 'QR_NOT_FOUND', 'QRIS buat order ini belum dibuat.');
  const svg = await QRCode.toString(row.qr_string, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } });
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'private, no-store');
  res.send(svg);
});

router.post('/api/orders/:id/manual', sameOrigin, auth, validId('id'), async (req, res) => {
  const method = String(req.body?.method || '').toUpperCase();
  if (!MANUAL_METHODS.includes(method)) return fail(res, 400, 'INVALID_PAYMENT_METHOD', 'Metode manual nggak valid. Pilih QRIS, DANA atau GOPAY.');
  if (method !== 'QRIS' && !(await paymentSettings())[method]) return fail(res, 400, 'PAYMENT_METHOD_UNAVAILABLE', `Nomor ${method} belum diatur developer. Pilih metode lain ya.`);
  // Proof: an uploaded image (billing page) or, for API clients, an HTTPS link.
  let image = null;
  let proofUrl = null;
  if (req.body?.proof_image !== undefined) {
    image = parseProofImage(req.body.proof_image);
    if (image.error === 'PROOF_TOO_LARGE') return fail(res, 413, image.error, 'Gambar bukti maksimal 2 MB.');
    if (image.error) return fail(res, 400, image.error, 'Buktinya harus gambar JPG, PNG atau WebP.');
  } else {
    const proof = String(req.body?.proof_url || '').trim();
    let url;
    try { url = new URL(proof); } catch {}
    if (!url || url.protocol !== 'https:' || proof.length > 2048) return fail(res, 400, 'INVALID_PROOF_URL', 'Upload gambar bukti pembayarannya (atau kirim URL HTTPS buktinya).');
    proofUrl = url.href;
  }
  const order = await pendingOrderFor(req);
  if (!order) return fail(res, 404, 'ORDER_NOT_FOUND', 'Order nggak ketemu atau udah kedaluwarsa.');
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
  if (!payment) return fail(res, 409, 'PAYMENT_ALREADY_SUBMITTED', 'Bukti pembayaran buat order ini udah dikirim dan lagi nunggu approval developer.');
  const days = Number(order.duration_days || 30);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'manual_payment_create', targetType: 'payment', targetId: payment.id, metadata: { method, amount: order.amount, days, upload: Boolean(image) }, ipAddress: ip(req) });
  // The proof is in the developer panel; the buyer can also confirm by chat (nothing is sent automatically).
  const links = notifier.contactLinks({ orderCode: order.order_code, tier: order.tier, days, amount: order.amount, method, email: req.account.email });
  res.status(201).json({
    success: true,
    payment,
    status: 'PAYMENT_PENDING',
    instructions: process.env.MANUAL_PAYMENT_INSTRUCTIONS || 'Bukti udah diterima. Tinggal nunggu approval developer.',
    contact: settings.whatsappLink,
    notification: 'panel',
    links
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
    config: Object.fromEntries(['DATABASE_URL', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL', 'AUTH_SECRET', 'OWNER_EMAIL', 'CORS_ORIGINS', 'PAKASIR_PROJECT', 'PAKASIR_API_KEY', 'PAYMENT_GATEWAY', 'PAKASIR_V2_VERIFY_URL', 'MANUAL_PAYMENT_INSTRUCTIONS', 'OWNER_WA', 'EMAIL_FROM', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY', 'GITHUB_TOKEN', 'BACKUP_EMAIL', 'CRON_SECRET', 'PUBLIC_BASE_URL', 'THERESAV_API_KEY', 'CLUTCH_API_KEY', 'TERMAI_API_KEY', 'R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2_PUBLIC_URL'].map(n => [n, configured(n)])),
    authConfigured: missingAuthConfig().length === 0,
    payments: { pakasirConfigured: pakasir.isConfigured(), gateway: pakasir.isEnabled() ? 'on' : 'maintenance', automaticSettlement: pakasir.isVerificationConfigured() ? 'configured_not_verified' : 'disabled_fail_closed' },
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
      WHERE (u.email ILIKE $1 OR u.name ILIKE $1 OR u.id::text=$6 OR (to_jsonb(u.*) ->> 'public_id')=$6 OR ($6='10000000' AND lower(u.email)=lower($7)))
        AND ($2='' OR u.tier=$2) AND ($3='' OR u.status=$3)
      ORDER BY u.created_at DESC LIMIT $4 OFFSET $5`,
    [`%${q.replace(/[\\%_]/g, m => '\\' + m)}%`, tier, status, limit, offset, q.trim(), process.env.OWNER_EMAIL || '']
  );
  res.json({ success: true, users: rows.map(u => { const m = users.mapUser(u); return { ...u, publicId: m.publicId, storedTier: u.tier, tier: m.tier, tierExpiresAt: m.tierExpiresAt, isOwner: m.isOwner }; }), limit, offset });
});

router.get('/owner/users/:id', auth, owner, validId('id'), async (req, res) => {
  const u = (await query("SELECT id,google_id,email,name,picture,tier,status,created_at,updated_at,banned_at,ban_reason,email_verified,(password_hash IS NOT NULL) AS has_password,(to_jsonb(users.*) ->> 'tier_expires_at')::timestamptz AS tier_expires_at,(to_jsonb(users.*) ->> 'public_id') AS public_id FROM users WHERE id=$1", [req.params.id]))[0];
  if (!u) return fail(res, 404, 'NOT_FOUND', 'User nggak ketemu.');
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
  if (!target) return { error: [404, 'NOT_FOUND', 'User nggak ketemu.'] };
  if (target.id === req.account.id || users.isOwnerEmail(target.email)) return { error: [400, 'SELF_ACTION_BLOCKED', 'Ini nggak bisa dilakukan ke akun developer.'] };
  return { target };
}

router.post('/owner/users/:id/ban', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const t = await protectedTarget(req);
  if (t.error) return fail(res, ...t.error);
  const reason = String(req.body?.reason || 'Dibatasi developer').slice(0, 500);
  const r = await query("UPDATE users SET status='banned',banned_at=now(),ban_reason=$2,session_version=session_version+1,updated_at=now() WHERE id=$1 RETURNING id,status", [req.params.id, reason]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'user_ban', targetType: 'user', targetId: req.params.id, metadata: { reason }, ipAddress: ip(req) });
  res.json({ success: true, user: r[0] });
});

router.post('/owner/users/:id/approve', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const r = await query("UPDATE users SET status='active',updated_at=now() WHERE id=$1 AND status='pending' RETURNING id,status", [req.params.id]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'User pending nggak ketemu.');
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
  if (!['FREE', 'SULTAN', 'SEPUH', 'DEWA'].includes(tier)) return fail(res, 400, 'INVALID_TIER', 'Tier nggak valid. DEVELOPER (OWNER) cuma ditentukan lewat OWNER_EMAIL.');
  // Optional duration: empty = no expiry. FREE never expires.
  const days = req.body?.days === undefined || req.body?.days === null || req.body?.days === '' ? null : Number(req.body.days);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) return fail(res, 400, 'INVALID_DURATION', 'Durasi harus 1–3650 hari, atau kosongin aja (permanen).');
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
  if (!who) return fail(res, 400, 'USER_REQUIRED', 'Isi ID atau email user-nya.');
  const target = await users.findByAnyId(who);
  if (!target) return fail(res, 404, 'USER_NOT_FOUND', 'User dengan ID/email itu nggak ketemu.');
  if (target.id === req.account.id || users.isOwnerEmail(target.email)) return fail(res, 400, 'SELF_ACTION_BLOCKED', 'Sandi developer gantinya lewat halaman Profile.');
  const typed = typeof req.body?.password === 'string' ? req.body.password : '';
  const password = typed || generatedPassword();
  const weak = passwords.passwordProblem(password);
  if (weak) return fail(res, 400, 'WEAK_PASSWORD', weak);
  await users.setPassword(target.id, await passwords.hashPassword(password));
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_password_reset', targetType: 'user', targetId: target.id, metadata: { email: target.email, generated: !typed }, ipAddress: ip(req) });
  res.json({ success: true, user: { id: target.id, email: target.email }, password: typed ? null : password, message: 'Sandi udah direset. User-nya udah dikeluarin dari semua perangkat.' });
});

router.post('/owner/users/:id/keys/:keyId/revoke', sameOrigin, auth, owner, validId('id', 'keyId'), async (req, res) => {
  const ok = await keys.revokeKey(req.params.id, req.params.keyId);
  if (!ok) return fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu atau udah dicabut.');
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
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Live chat butuh migration 009_key_tiers_profile_chat.sql dulu.');
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
  if (!Number.isFinite(id) || id < 1) return fail(res, 404, 'NOT_FOUND', 'Pesannya nggak ketemu.');
  const r = await query('UPDATE chat_messages SET deleted_at=now(),deleted_by=$2 WHERE id=$1 AND deleted_at IS NULL AND ($3::boolean OR user_id=$2) RETURNING id,user_id', [id, req.account.id, req.account.isOwner]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Pesannya nggak ketemu.');
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
    if (!found) return fail(res, 404, 'USER_NOT_FOUND', 'User dengan email/ID itu nggak ketemu.');
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
  if (!keys.KEY_VISIBILITY.includes(kind)) return fail(res, 400, 'INVALID_VISIBILITY', 'Jenis key harus Public, Private atau Developer.');
  let accessUsers = [];
  if (kind === 'private') {
    const { found, missing } = await resolveUsers(b.access);
    if (missing.length) return fail(res, 404, 'USER_NOT_FOUND', `User nggak ketemu: ${missing.join(', ')}`, { missing });
    if (!found.length) return fail(res, 400, 'ACCESS_REQUIRED', 'Key private butuh minimal 1 user/email yang dikasih akses.');
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
  if (!key) { fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu.'); return null; }
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
    if (b.tier !== undefined && b.tier !== '' && current.visibility === 'owner') return fail(res, 400, 'INVALID_TIER', 'Developer key selalu pakai akses DEVELOPER, jadi tier-nya nggak bisa diubah.');
    if (String(b.tier || '').toUpperCase() === 'ACCOUNT' && current.visibility) return fail(res, 400, 'INVALID_TIER', 'Key public/private harus punya tier sendiri.');
    if (b.extend !== undefined) {
      const hours = keys.durationHours(b.extend, b.days);
      if (hours === null) change.permanent = true; else change.hours = hours;
    }
    if (b.tier !== undefined && b.tier !== '') change.tier = String(b.tier).toUpperCase();
    if (!Object.keys(change).length) return fail(res, 400, 'NOTHING_TO_CHANGE', 'Belum ada yang diubah: ganti nama, masa aktif atau tier dulu.');
    const key = await keys.updateIssuedKey(req.params.keyId, change);
    if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu atau udah dicabut (key yang udah dicabut nggak bisa diubah).');
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
    if (!r) return fail(res, 409, 'KEY_REVOKED', 'Key yang udah dicabut nggak bisa diaktifkan lagi.');
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
    if (!made) return fail(res, 409, 'KEY_REVOKED', 'Key yang udah dicabut nggak bisa di-reset. Bikin key baru aja.');
    await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_regenerate', targetType: 'api_key', targetId: key.id, metadata: { kind: key.visibility, oldPrefix: key.key_prefix, newPrefix: made.record.key_prefix }, ipAddress: ip(req) });
    res.json({ success: true, key: made.key, record: made.record, message: 'Key lama udah nggak berlaku. Simpan key baru ini — cuma ditampilkan sekali.' });
  } catch (e) {
    if (keyError(res, e)) return;
    throw e;
  }
});

// Private keys: who may use them. Add, remove one, or reset (replace the whole list).
async function privateKey(req, res) {
  const key = await managedKey(req, res);
  if (!key) return null;
  if (key.visibility !== 'private') { fail(res, 400, 'NOT_PRIVATE', 'Daftar akses cuma buat key private.'); return null; }
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
  if (missing.length) return fail(res, 404, 'USER_NOT_FOUND', `User nggak ketemu: ${missing.join(', ')}`, { missing });
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
  if (!(await keys.removeAccess(key.id, req.params.userId))) return fail(res, 404, 'NOT_FOUND', 'User itu nggak ada di daftar akses.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_access_remove', targetType: 'api_key', targetId: key.id, metadata: { userId: req.params.userId }, ipAddress: ip(req) });
  await accessReply(res, key);
});

router.post('/owner/keys/:keyId/revoke', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const key = await ownerKeyRow(req.params.keyId);
  if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu.');
  if (key.visibility === 'owner') return fail(res, 400, 'OWNER_KEY_KEEP', 'Developer key nggak bisa dicabut: pakai Nonaktifkan atau Reset aja.');
  const r = await query("UPDATE api_keys SET status='revoked',revoked_at=now() WHERE id=$1 AND status='active' RETURNING id", [key.id]);
  if (!r.length) return fail(res, 409, 'KEY_ALREADY_REVOKED', 'API key ini udah dicabut.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_revoke', targetType: 'api_key', targetId: key.id, metadata: { userId: key.user_id, email: key.email, prefix: key.key_prefix, name: key.name }, ipAddress: ip(req) });
  res.json({ success: true });
});

router.delete('/owner/keys/:keyId', sameOrigin, auth, owner, validId('keyId'), async (req, res) => {
  const key = await ownerKeyRow(req.params.keyId);
  if (!key) return fail(res, 404, 'KEY_NOT_FOUND', 'API key nggak ketemu.');
  // Usage history stays (api_usage.api_key_id is ON DELETE SET NULL); the key stops working at once.
  await query('DELETE FROM api_keys WHERE id=$1', [key.id]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'owner_api_key_delete', targetType: 'api_key', targetId: key.id, metadata: { userId: key.user_id, email: key.email, prefix: key.key_prefix, name: key.name, status: key.status }, ipAddress: ip(req) });
  res.json({ success: true });
});

// ---------------------------------------------------------------- owner: endpoints
// The registry stores metadata/access flags only. An endpoint executes only when a plugin
// handler for its path is deployed in plugin/ (handler_loaded); metadata never runs code.
function withHandler(req, row) {
  const groups = require('../config/endpointGroups');
  const own = groups.find(g => g.path === row.path);
  const backupFor = groups.filter(g => (g.backups || []).some(b => (typeof b === 'string' ? b : b.path) === row.path)).map(g => g.path);
  const files = req.app.locals.pluginFiles || new Map();
  const file = files.get(row.path) || null;
  const sameFile = file ? [...files.values()].filter(f => f === file).length : 0;
  return { ...row, handler_loaded: (req.app.locals.loadedPluginPaths || new Set()).has(row.path),
    file, file_endpoints: sameFile, code_editable: Boolean(file) && sameFile === 1 && !String(row.plugin || '').startsWith('deleted:'),
    deleted: String(row.plugin || '').startsWith('deleted:'),
    backups: own ? own.backups.map(b => (typeof b === 'string' ? b : b.path)) : [], backup_for: backupFor };
}

router.get('/owner/api/endpoints', auth, owner, async (req, res) => {
  // Endpoints whose code was deleted: once the new deploy no longer serves them, the row goes too.
  const loaded = req.app.locals.loadedPluginPaths || new Set();
  const gone = (await query("SELECT id,path FROM endpoints WHERE plugin LIKE 'deleted:%'")).filter(r => !loaded.has(r.path)).map(r => r.id);
  if (gone.length) await query('DELETE FROM endpoints WHERE id = ANY($1::uuid[])', [gone]);
  const rows = await query('SELECT * FROM endpoints ORDER BY name');
  res.json({ success: true, endpoints: rows.map(r => withHandler(req, r)) });
});

// ---------------------------------------------------------------- owner: add endpoint from any code
// "Sempurnakan & tes": pasted code → handler script (services/endpointBuilder.js) → one test run.
// Nothing is deployed here; the developer reviews the preview and then uses "Tambah & deploy".
const buildFail = (res, e) => {
  if (e instanceof builder.BuildError || e instanceof pluginService.PluginError) return fail(res, e.status, e.code, e.message, e.extra || {});
  throw e;
};
const knownPath = (req, p) => (req.app.locals.loadedPluginPaths || new Set()).has(p);
async function duplicateOf(req, p) {
  const row = (await query('SELECT id,name,path FROM endpoints WHERE path=$1', [p]))[0];
  return row || (knownPath(req, p) ? { path: p, name: p } : null);
}
async function freePath(req, p) {
  if (!(await duplicateOf(req, p))) return p;
  for (let i = 2; i < 20; i++) { const c = `${p}-v${i}`; if (!(await duplicateOf(req, c))) return c; }
  return p;
}
const buildLimiter = { running: 0 };

router.get('/owner/api/ai', auth, owner, (req, res) => res.json({ success: true, ai: builder.aiStatus() }));
router.post('/owner/api/ai/ping', sameOrigin, auth, owner, async (req, res) => {
  const r = await builder.pingAI();
  res.status(r.ok ? 200 : r.configured ? 502 : 503).json({ success: r.ok, ...r });
});

router.post('/owner/api/endpoints/convert', sameOrigin, auth, owner, async (req, res) => {
  if (buildLimiter.running >= 2) return fail(res, 429, 'BUILDER_BUSY', 'Lagi ada proses lain. Tunggu bentar ya.');
  buildLimiter.running++;
  try {
    const ai = ['auto', 'only', 'never'].includes(req.body?.ai) ? req.body.ai : 'auto';
    const out = await builder.convert(req.body?.code, { useAI: ai });
    const duplicate = await duplicateOf(req, out.meta.path);
    if (duplicate) out.meta.path = await freePath(req, out.meta.path);
    const test = await builder.tryScript(out.script, { path: out.meta.path, sample: out.meta.sample });
    await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_convert', targetType: 'endpoint', metadata: { source: out.source, path: out.meta.path, ok: test.ok }, ipAddress: ip(req) }).catch(() => {});
    res.json({ success: true, source: out.source, model: out.model || null, meta: out.meta, code: out.script, secrets: out.secrets, notes: out.notes || [], duplicate, test });
  } catch (e) { return buildFail(res, e); }
  finally { buildLimiter.running--; }
});

router.post('/owner/api/endpoints/try', sameOrigin, auth, owner, async (req, res) => {
  const b = req.body || {};
  if (!pluginService.parsePath(b.path)) return fail(res, 400, 'INVALID_ENDPOINT', 'Path harus kayak /api/kategori/nama.');
  try { pluginService.validateCode(b.code); } catch (e) { return buildFail(res, e); }
  try {
    const test = await builder.tryScript(b.code, { path: b.path, sample: b.sample && typeof b.sample === 'object' ? b.sample : {} });
    res.json({ success: true, test });
  } catch (e) { return buildFail(res, e); }
});

// Self-test the theresav-backed endpoints from the server (which can reach theresav even when a
// build environment cannot): each is called upstream with a safe sample input. Endpoints without a
// sample (they need a real link/photo) are reported "manual" so they are tested in the Sandbox.
// Owner-only; uses the owner's theresav quota, so it is an explicit action.
const selfTestLimiter = { running: false };
// Checks every loaded endpoint (proxied ones and local plugins) and stores the outcome for the
// ~/endpoints monitor (services/endpointCheckService.js).
async function runSelfTest(app, only = null) {
  const rows = await query("SELECT id,path,status FROM endpoints");
  const byPath = new Map(rows.map(r => [r.path, r]));
  const out = (await endpointChecks.checkAll(app, { only })).map(r => ({ ...r, id: byPath.get(r.path)?.id || null, endpointStatus: byPath.get(r.path)?.status || null }));
  out.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  const summary = out.reduce((m, r) => (m[r.result] = (m[r.result] || 0) + 1, m), {});
  return { out, summary };
}
const upstreamConfigured = () => !!process.env.THERESAV_API_KEY || Object.values(apiproxy.SERVERS).some(s => s.keyMode === 'none' || process.env[s.keyEnv]);

router.post('/owner/api/selftest', sameOrigin, auth, owner, async (req, res) => {
  if (!upstreamConfigured()) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', 'Isi dulu THERESAV_API_KEY (atau salah satu key server lain) di Vercel, terus redeploy sebelum ngetes.');
  if (selfTestLimiter.running) return fail(res, 409, 'SELFTEST_BUSY', 'Ada pengujian lain yang lagi jalan. Tunggu sampai selesai ya.');
  selfTestLimiter.running = true;
  try {
    const { out, summary } = await runSelfTest(req.app, Array.isArray(req.body?.paths) ? new Set(req.body.paths) : null);
    await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_selftest', targetType: 'endpoint', metadata: summary, ipAddress: ip(req) }).catch(() => {});
    res.json({ success: true, results: out, summary });
  } finally {
    selfTestLimiter.running = false;
  }
});

// Public: the latest real status of every endpoint, for the ~/endpoints monitor on the dashboard.
router.get('/api/endpoints/status', async (req, res) => {
  try {
    const data = await endpointStatus.list(req.app.locals.loadedPluginPaths);
    res.set('Cache-Control', 'no-store');   // right after a check the new codes must show
    return res.json({ success: true, ...data });
  } catch (e) {
    return fail(res, 503, 'STATUS_UNAVAILABLE', 'Status endpoint lagi nggak bisa dimuat.');
  }
});

// Automatic check, asked for by the dashboard monitor: checks the few endpoints whose last check is
// old (each endpoint at most once per 6 hours when OK, 30 minutes when failing, whoever asks).
// With {"force": true} (the Refresh button, signed-in only) everything is checked again except what
// was checked in the last 5 minutes.
router.post('/api/endpoints/autocheck', async (req, res) => {
  if (req.get('x-yannz-client') !== 'web') return fail(res, 403, 'WEB_ONLY', 'Cuma bisa dari website.');
  const force = req.body?.force === true;
  let session = null;
  try { session = req.app.locals.getSession(req); } catch {}
  if (force && !session) return fail(res, 401, 'AUTH_REQUIRED', 'Login dulu buat ngecek ulang.');
  try {
    const f = endpointChecks.FORCE_AFTER_MS;
    const checked = await endpointChecks.checkStale(req.app, 6, force ? { okAfterMs: f, failAfterMs: f } : undefined);
    return res.json({ success: true, checked });
  } catch (e) {
    console.error('Automatic endpoint check failed:', { code: e?.code || null });
    return fail(res, 503, 'CHECK_UNAVAILABLE', 'Cek endpoint lagi nggak bisa jalan.');
  }
});

// Daily automatic endpoint check (vercel.json "crons"), same CRON_SECRET bearer as the backup.
function cronAuthorized(req) {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return null;
  const given = Buffer.from(String(req.headers.authorization || ''));
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && crypto.timingSafeEqual(given, want);
}
router.get('/cron/endpoint-check', async (req, res) => {
  const okAuth = cronAuthorized(req);
  if (okAuth === null) return fail(res, 503, 'CRON_NOT_CONFIGURED', 'Set CRON_SECRET di Vercel untuk cek endpoint otomatis harian.');
  if (!okAuth) return fail(res, 401, 'UNAUTHORIZED', 'Unauthorized.');
  if (!upstreamConfigured()) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', 'Belum ada key server API yang diisi.');
  if (selfTestLimiter.running) return fail(res, 409, 'SELFTEST_BUSY', 'Ada pengujian lain yang lagi jalan.');
  selfTestLimiter.running = true;
  try {
    const { summary } = await runSelfTest(req.app);
    await audit.writeAudit({ actorUserId: null, action: 'endpoint_selftest', targetType: 'endpoint', metadata: { ...summary, auto: true }, ipAddress: ip(req) }).catch(() => {});
    return res.json({ success: true, summary });
  } finally {
    selfTestLimiter.running = false;
  }
});

// Disable (or enable) several endpoints at once, by id — used by "nonaktifkan yang error".
router.post('/owner/api/endpoints/bulk-status', sameOrigin, auth, owner, async (req, res) => {
  const status = req.body?.status === 'active' ? 'active' : 'disabled';
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(x => UUID_RE.test(String(x))).slice(0, 200) : [];
  if (!ids.length) return fail(res, 400, 'NO_IDS', 'Belum ada endpoint yang dipilih.');
  const r = await query('UPDATE endpoints SET status=$2,updated_at=now() WHERE id = ANY($1::uuid[]) RETURNING id', [ids, status]);
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_bulk_status', targetType: 'endpoint', metadata: { status, count: r.length }, ipAddress: ip(req) });
  res.json({ success: true, changed: r.length, status });
});

router.post('/owner/api/endpoints', sameOrigin, auth, owner, async (req, res) => {
  const b = req.body || {};
  if (b.code !== undefined) return createPluginEndpoint(req, res);
  const method = String(b.method || 'GET').toUpperCase();
  if (typeof b.name !== 'string' || !b.name.trim() || typeof b.path !== 'string' || !/^\/[a-zA-Z0-9/_-]{1,200}$/.test(b.path) || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return fail(res, 400, 'INVALID_ENDPOINT', 'Data endpoint nggak valid.');
  }
  if (b.minimum_tier !== undefined && !tiers.TIERS[b.minimum_tier]) return fail(res, 400, 'INVALID_TIER', 'Tier minimum nggak valid.');
  const r = await query(
    'INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,$4,$5,$6,$7,NULL) ON CONFLICT(path) DO NOTHING RETURNING *',
    [b.name.trim().slice(0, 100), b.path, String(b.description || '').slice(0, 500), method, b.minimum_tier || 'FREE', b.locked === true, b.status === 'disabled' ? 'disabled' : 'active']
  );
  if (!r.length) return fail(res, 409, 'ENDPOINT_EXISTS', 'Path endpoint ini udah terdaftar.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_create', targetType: 'endpoint', targetId: r[0].id, metadata: { path: b.path }, ipAddress: ip(req) });
  const endpoint = withHandler(req, r[0]);
  res.status(201).json({ success: true, endpoint, warning: endpoint.handler_loaded ? null : 'Metadata udah tersimpan, tapi belum ada plugin handler buat path ini. Endpoint-nya belum bisa dipanggil sampai plugin di-deploy.' });
});

// New endpoint with its script: 1 name, 2 /api/kategori/nama, 3 .js script, 4 description, 5 tier.
// The registry row is written first (so the tier is in place before the deploy registers the
// route), then the script is committed to plugin/ on GitHub; a failed commit removes the row.
async function createPluginEndpoint(req, res) {
  const b = req.body || {};
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : '';
  const target = pluginService.parsePath(b.path);
  if (!name || !target) return fail(res, 400, 'INVALID_ENDPOINT', 'Nama wajib diisi dan path harus kayak /api/kategori/nama (huruf kecil, angka, tanda -).');
  const tier = b.minimum_tier === undefined ? 'FREE' : b.minimum_tier;
  if (!tiers.TIERS[tier]) return fail(res, 400, 'INVALID_TIER', 'Tier minimum nggak valid.');
  const desc = String(b.description || '').trim().slice(0, 500) || name;   // the plugin loader skips plugins without desc
  try {
    pluginService.validateCode(b.code);
  } catch (e) {
    if (e instanceof pluginService.PluginError) return fail(res, e.status, e.code, e.message);
    throw e;
  }
  if (!pluginService.isConfigured()) return fail(res, 503, 'GITHUB_NOT_CONFIGURED', 'Upload plugin belum aktif: set GITHUB_TOKEN (dan GITHUB_REPO kalau repo-nya beda) di Environment Variables Vercel, terus redeploy.');
  if (await duplicateOf(req, b.path)) return fail(res, 409, 'ENDPOINT_EXISTS', 'Path endpoint ini udah terdaftar.');
  // Only code that works is deployed: one run with the sample input first.
  const test = await builder.tryScript(b.code, { path: b.path, sample: b.sample && typeof b.sample === 'object' ? b.sample : {} }).catch(e => ({ ok: false, error: e.code || 'SCRIPT_ERROR', message: e.message }));
  if (!test.ok) return fail(res, 422, 'TEST_FAILED', `Endpoint-nya belum jalan, jadi nggak di-deploy: ${test.message}`, { test });
  const params = Array.isArray(b.params) ? b.params.filter(p => p && /^[a-zA-Z_][\w-]{0,30}$/.test(p.name)).slice(0, 8).map(p => ({ name: p.name, required: p.required !== false, placeholder: String(p.placeholder || '').slice(0, 80) })) : [];

  const r = await query(
    "INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,'GET',$4,false,'active',$5) ON CONFLICT(path) DO NOTHING RETURNING *",
    [name, b.path, desc, tier, target.plugin]
  );
  if (!r.length) return fail(res, 409, 'ENDPOINT_EXISTS', 'Path endpoint ini udah terdaftar.');
  let commit;
  try {
    commit = await pluginService.commitPlugin({
      file: target.file,
      content: pluginService.buildPluginFile({ name, desc, category: target.category, path: b.path, code: b.code, params }),
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
    message: `Script udah di-commit ke ${commit.file}. Vercel bakal deploy ulang (biasanya 20–60 detik), habis itu endpoint-nya aktif.`
  });
}

const ENDPOINT_BADGES = ['new', 'hot', 'recommend'];
router.patch('/owner/api/endpoints/:id', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const b = req.body || {};
  const bad = (b.name !== undefined && (typeof b.name !== 'string' || !b.name.trim()))
    || (b.description !== undefined && typeof b.description !== 'string')
    || (b.minimum_tier !== undefined && !tiers.TIERS[b.minimum_tier])
    || (b.locked !== undefined && typeof b.locked !== 'boolean')
    || (b.status !== undefined && !['active', 'disabled'].includes(b.status))
    || (b.badge !== undefined && b.badge !== null && b.badge !== '' && !ENDPOINT_BADGES.includes(b.badge));
  if (bad) return fail(res, 400, 'INVALID_ENDPOINT', 'Data endpoint nggak valid.');
  if (b.badge !== undefined) {   // label in the catalog: new / hot / recommend, or none
    try { await query('UPDATE endpoints SET badge=$2,updated_at=now() WHERE id=$1', [req.params.id, b.badge || null]); }
    catch (e) { if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Jalankan migrasi 015_endpoint_badges.sql dulu di Neon.'); throw e; }
  }
  const r = await query(
    'UPDATE endpoints SET name=COALESCE($2,name),description=COALESCE($3,description),minimum_tier=COALESCE($4,minimum_tier),locked=COALESCE($5,locked),status=COALESCE($6,status),updated_at=now() WHERE id=$1 RETURNING *',
    [req.params.id, b.name?.trim().slice(0, 100) ?? null, b.description?.slice(0, 500) ?? null, b.minimum_tier ?? null, b.locked ?? null, b.status ?? null]
  );
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Endpoint nggak ketemu.');
  const changes = Object.fromEntries(['name', 'description', 'minimum_tier', 'locked', 'status', 'badge'].filter(k => b[k] !== undefined).map(k => [k, b[k]]));
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_update', targetType: 'endpoint', targetId: req.params.id, metadata: changes, ipAddress: ip(req) });
  res.json({ success: true, endpoint: withHandler(req, r[0]) });
});

async function setEndpointLock(req, res, locked) {
  const r = await query('UPDATE endpoints SET locked=$2,updated_at=now() WHERE id=$1 RETURNING id,path,locked', [req.params.id, locked]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Endpoint nggak ketemu.');
  await audit.writeAudit({ actorUserId: req.account.id, action: locked ? 'endpoint_lock' : 'endpoint_unlock', targetType: 'endpoint', targetId: req.params.id, ipAddress: ip(req) });
  res.json({ success: true, endpoint: r[0] });
}
router.post('/owner/api/endpoints/:id/lock', sameOrigin, auth, owner, validId('id'), (req, res) => setEndpointLock(req, res, true));
router.post('/owner/api/endpoints/:id/unlock', sameOrigin, auth, owner, validId('id'), (req, res) => setEndpointLock(req, res, false));

// ---------------------------------------------------------------- owner: edit / delete an endpoint's code
// Only endpoints that have their own plugin file (one endpoint in the file); a file serving many
// endpoints (theresav, dongtube, …) is left alone: disable or lock those instead.
async function codeTarget(req, res) {
  const row = (await query('SELECT * FROM endpoints WHERE id=$1', [req.params.id]))[0];
  if (!row) { fail(res, 404, 'NOT_FOUND', 'Endpoint nggak ketemu.'); return null; }
  const e = withHandler(req, row);
  if (!e.file) { fail(res, 409, 'NO_CODE', 'Endpoint ini belum punya file kode.'); return null; }
  if (!e.code_editable) { fail(res, 409, 'MULTI_ENDPOINT_FILE', `File plugin/${e.file} isinya ${e.file_endpoints} endpoint, jadi nggak bisa diedit/dihapus dari sini. Pakai Disable atau Lock aja.`); return null; }
  return { row, e, file: `plugin/${e.file}` };
}

router.get('/owner/api/endpoints/:id/code', auth, owner, validId('id'), async (req, res) => {
  const t = await codeTarget(req, res); if (!t) return;
  try {
    const f = await pluginService.getFile(t.file);
    if (!f) return fail(res, 404, 'FILE_NOT_FOUND', `File ${t.file} nggak ada di repo.`);
    const split = pluginService.splitPluginFile(f.content);
    res.json({ success: true, file: t.file, sha: f.sha, mode: split ? 'script' : 'file', code: split ? split.script : f.content, meta: split?.meta || null });
  } catch (e) { return buildFail(res, e); }
});

router.put('/owner/api/endpoints/:id/code', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const t = await codeTarget(req, res); if (!t) return;
  const b = req.body || {};
  try { pluginService.validateCode(b.code); } catch (e) { return buildFail(res, e); }
  if (typeof b.sha !== 'string' || !/^[0-9a-f]{40}$/.test(b.sha)) return fail(res, 400, 'SHA_REQUIRED', 'Buka editornya lagi dulu (versi file-nya nggak ketahuan).');
  const test = await builder.tryScript(b.code, { path: t.row.path, sample: b.sample && typeof b.sample === 'object' ? b.sample : {} }).catch(e => ({ ok: false, error: e.code || 'SCRIPT_ERROR', message: e.message }));
  if (!test.ok) return fail(res, 422, 'TEST_FAILED', `Kode barunya belum jalan, jadi nggak disimpan: ${test.message}`, { test });
  try {
    let content = b.code;
    if (b.mode === 'script') {
      const current = await pluginService.getFile(t.file);
      const meta = (current && pluginService.splitPluginFile(current.content)?.meta) || { name: t.row.name, desc: t.row.description || t.row.name, category: pluginService.parsePath(t.row.path)?.category || 'Tools', path: t.row.path };
      content = pluginService.buildPluginFile({ ...meta, code: b.code });
    }
    const commit = await pluginService.updateFile({ file: t.file, content, sha: b.sha, message: `Update endpoint ${t.row.path} from the owner panel` });
    await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_code_update', targetType: 'endpoint', targetId: t.row.id, metadata: { path: t.row.path, file: t.file, commit: commit.sha }, ipAddress: ip(req) });
    res.json({ success: true, commit, test, message: `Kode baru udah di-commit ke ${t.file}. Vercel deploy ulang (biasanya 20–60 detik), habis itu versi barunya aktif.` });
  } catch (e) { return buildFail(res, e); }
});

router.delete('/owner/api/endpoints/:id', sameOrigin, auth, owner, validId('id'), async (req, res) => {
  const row = (await query('SELECT id,path,plugin FROM endpoints WHERE id=$1', [req.params.id]))[0];
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Endpoint nggak ketemu.');
  // An endpoint with its own code file: the file is deleted on GitHub and the endpoint is switched
  // off right away; its row goes once the new deploy no longer serves it.
  if (withHandler(req, row).handler_loaded) {
    const t = await codeTarget(req, res); if (!t) return;
    try {
      const f = await pluginService.getFile(t.file);
      const commit = f ? await pluginService.deleteFile({ file: t.file, sha: f.sha, message: `Delete endpoint ${row.path} from the owner panel` }) : null;
      await query("UPDATE endpoints SET status='disabled',plugin=$2,updated_at=now() WHERE id=$1", [row.id, `deleted:${t.e.file}`]);
      await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_delete', targetType: 'endpoint', targetId: row.id, metadata: { path: row.path, file: t.file, commit: commit?.sha || null }, ipAddress: ip(req) });
      return res.json({ success: true, commit, message: `Endpoint ${row.path} dimatiin dan file ${t.file} dihapus. Habis Vercel deploy ulang, endpoint-nya hilang dari daftar.` });
    } catch (e) { return buildFail(res, e); }
  }
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
  if (!row) return fail(res, 404, 'PROOF_NOT_FOUND', 'Pembayaran ini nggak ada gambar buktinya.');
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
  if (!row.length) return fail(res, 409, 'PAYMENT_NOT_PENDING', 'Pembayaran ini udah nggak pending atau udah diproses.');
  res.json({ success: true, status: approve ? 'paid' : 'rejected' });
}
router.post('/owner/payments/:id/approve', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, true));
router.post('/owner/payments/:id/reject', sameOrigin, auth, owner, validId('id'), (req, res) => settleManual(req, res, false));

// ---------------------------------------------------------------- owner: endpoint errors
// "Error" tab: every endpoint error from real requests and automatic checks, grouped, with the
// endpoints that were hidden automatically (services/errorLogService.js).
router.get('/owner/api/errors', auth, owner, async (req, res) => {
  const rows = await errorLog.list({ includeResolved: req.query.all !== '0' });
  const open = rows.filter(r => !r.resolved_at);
  const hiddenSet = await errorLog.hiddenPaths();
  res.json({ success: true, errors: rows.map(r => ({ ...r, ...errorLog.explain(r), hidden_now: r.auto_disabled || (hiddenSet.has(r.path) && !r.resolved_at) })),
    open: open.length, hidden: new Set([...rows.filter(r => r.auto_disabled).map(r => r.path), ...hiddenSet]).size,
    schemaReady: await errorLog.schemaReady(), problem: errorLog.lastProblem() });
});
router.post('/owner/api/errors/show', sameOrigin, auth, owner, async (req, res) => {
  const path = String(req.body?.path || '');
  if (!/^\/api\/[\w\-/]+$/.test(path)) return fail(res, 400, 'INVALID_PATH', 'Path endpoint nggak valid.');
  const row = await errorLog.showAgain(path);
  if (!row) return fail(res, 404, 'NOT_FOUND', 'Endpoint-nya nggak ketemu.');
  endpointStatus.reset();
  await audit.writeAudit({ actorUserId: req.account.id, action: 'endpoint_shown', targetType: 'endpoint', targetId: String(row.id), metadata: { path }, ipAddress: ip(req) });
  res.json({ success: true });
});
router.delete('/owner/api/errors/:id', sameOrigin, auth, owner, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) return fail(res, 400, 'INVALID_ID', 'ID nggak valid.');
  const r = await errorLog.remove(req.params.id);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'Error-nya nggak ketemu.');
  res.json({ success: true });
});
router.post('/owner/api/errors/clear-resolved', sameOrigin, auth, owner, async (req, res) => {
  const r = await errorLog.clearResolved();
  res.json({ success: true, removed: r.length });
});

// ---------------------------------------------------------------- owner: CDN files
// The CDN is the upload feature in the menu (/upload), not an API endpoint; the developer sees and
// manages the uploaded files here.
router.get('/owner/cdn', auth, owner, async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const sql = cols => `SELECT c.id, c.name, c.mime, c.size, c.created_at, c.expires_at, ${cols} u.email AS owner_email
      FROM cdn_files c LEFT JOIN users u ON u.id = c.owner_id
     WHERE ($1 = '' OR c.id ILIKE '%' || $1 || '%' OR c.name ILIKE '%' || $1 || '%' OR u.email ILIKE '%' || $1 || '%')
     ORDER BY c.created_at DESC LIMIT 200`;
  try {
    let rows;
    try { rows = await query(sql('c.storage, c.ready,'), [q]); }
    catch (e) { if (e.code !== '42703') throw e; rows = await query(sql(''), [q]); }
    const totals = (await query('SELECT count(*)::int AS files, COALESCE(sum(size),0)::bigint AS bytes FROM cdn_files'))[0];
    return res.json({ success: true, totals: { files: totals.files, bytes: Number(totals.bytes) }, files: rows.map(r => ({ ...r, url: cdn.absoluteUrl(req, r.id) })) });
  } catch (e) {
    if (migrationMissing(e)) return res.json({ success: true, totals: { files: 0, bytes: 0 }, files: [] });
    return fail(res, 503, 'CDN_UNAVAILABLE', 'Daftar file CDN lagi nggak bisa dimuat.');
  }
});
router.delete('/owner/cdn/:id', sameOrigin, auth, owner, async (req, res) => {
  if (!cdn.isValidId(req.params.id)) return fail(res, 400, 'INVALID_ID', 'ID file nggak valid.');
  const r = await query('DELETE FROM cdn_files WHERE id = $1 RETURNING id, name, size', [req.params.id]);
  if (!r.length) return fail(res, 404, 'NOT_FOUND', 'File-nya nggak ketemu.');
  await audit.writeAudit({ actorUserId: req.account.id, action: 'cdn_delete', targetType: 'cdn_file', targetId: r[0].id, metadata: { name: r[0].name, size: r[0].size }, ipAddress: ip(req) });
  return res.json({ success: true, deleted: r[0].id });
});

// ---------------------------------------------------------------- owner: server, audit, backup
router.get('/owner/server', auth, owner, async (req, res) => {
  const r = await query('SELECT to_jsonb(server_settings.*) AS s FROM server_settings WHERE id=1');
  const row = r[0]?.s || {};
  res.json({ success: true, settings: {
    maintenance_enabled: Boolean(row.maintenance_enabled), maintenance_message: row.maintenance_message || '', maintenance_since: row.maintenance_since || null, updated_at: row.updated_at || null,
    announce_message: row.announce_message || '', announce_message2: row.announce_message2 || '',
    announce_button_label: row.announce_button_label || '', announce_button_url: row.announce_button_url || '', announce_at: row.announce_at || null,
    payment_dana_number: row.payment_dana_number || '', payment_dana_name: row.payment_dana_name || '',
    payment_gopay_number: row.payment_gopay_number || '', payment_gopay_name: row.payment_gopay_name || ''
  }, notifications: notifier.status() });
});

router.patch('/owner/server', sameOrigin, auth, owner, async (req, res) => {
  const enabled = req.body?.maintenance_enabled === true;
  const message = String(req.body?.maintenance_message || '').trim().slice(0, 500) || 'Website lagi maintenance. Tunggu bentar sampai selesai ya.';
  const save = withSince => query(
    `INSERT INTO server_settings(id,maintenance_enabled,maintenance_message,updated_at,updated_by${withSince ? ',maintenance_since' : ''}) VALUES(1,$1,$2,now(),$3${withSince ? ',CASE WHEN $1 THEN now() END' : ''})
     ON CONFLICT(id) DO UPDATE SET maintenance_enabled=EXCLUDED.maintenance_enabled,maintenance_message=EXCLUDED.maintenance_message,updated_at=now(),updated_by=EXCLUDED.updated_by
     ${withSince ? ',maintenance_since=CASE WHEN NOT EXCLUDED.maintenance_enabled THEN NULL WHEN server_settings.maintenance_enabled AND server_settings.maintenance_since IS NOT NULL THEN server_settings.maintenance_since ELSE now() END' : ''} RETURNING *`,
    [enabled, message, req.account.id]
  );
  // The start time (shown on the maintenance announcement) is kept while maintenance stays on.
  let r;
  try { r = await save(true); } catch (e) { if (!migrationMissing(e)) throw e; r = await save(false); }
  req.app.locals.maintenance?.invalidate();
  await audit.writeAudit({ actorUserId: req.account.id, action: 'maintenance_change', targetType: 'server_settings', metadata: { enabled }, ipAddress: ip(req) });
  res.json({ success: true, settings: r[0] });
});

// "Pengumuman Dev": a notice on the sign-in page and Home. An empty message turns it off.
// The button opens a link the owner chooses (a page here or an http(s) address).
router.patch('/owner/announcement', sameOrigin, auth, owner, async (req, res) => {
  const text = (v, n) => String(v ?? '').replace(/\r\n?/g, '\n').trim().slice(0, n);
  const message = text(req.body?.message, 1000), message2 = text(req.body?.message2, 1000);
  const label = text(req.body?.button_label, 40).replace(/\n/g, ' '), url = text(req.body?.button_url, 500);
  if (url && !(/^\/(?!\/)\S*$/.test(url) || /^https?:\/\/[^\s/]+\S*$/i.test(url))) return fail(res, 400, 'INVALID_URL', 'URL tombol harus diawali https://, http://, atau / (halaman di website ini).');
  if (label && !url) return fail(res, 400, 'INVALID_URL', 'Isi URL tombolnya juga, atau kosongin teks tombolnya.');
  const on = Boolean(message);
  try {
    const r = await query(
      `UPDATE server_settings SET announce_message=$1,announce_message2=$2,announce_button_label=$3,announce_button_url=$4,announce_at=CASE WHEN $5 THEN now() END,updated_at=now(),updated_by=$6 WHERE id=1 RETURNING *`,
      [on ? message : null, on ? message2 || null : null, on ? label || null : null, on ? url || null : null, on, req.account.id]
    );
    req.app.locals.maintenance?.invalidate();
    await audit.writeAudit({ actorUserId: req.account.id, action: 'announcement_change', targetType: 'server_settings', metadata: { on }, ipAddress: ip(req) });
    const row = r[0] || {};
    return res.json({ success: true, announcement: on ? { message: row.announce_message, message2: row.announce_message2 || '', button_label: row.announce_button_label || '', button_url: row.announce_button_url || '', at: row.announce_at } : null });
  } catch (e) {
    if (migrationMissing(e)) return fail(res, 503, 'MIGRATION_REQUIRED', 'Pengumuman Dev butuh migration 022_announcements.sql dulu.');
    throw e;
  }
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

// Backups (services/backupService.js). Downloads go out gzip-encoded so the file the browser saves
// is plain .sql / .json while the response stays under Vercel's 4.5 MB limit.
const DOWNLOAD_LIMIT = 4.3 * 1024 * 1024;
async function sendBackupFile(req, res, file) {
  const body = await backups.gzip(file.raw, { level: 9 });
  if (body.length > DOWNLOAD_LIMIT) return fail(res, 413, 'BACKUP_TOO_BIG', `Backup-nya ${(body.length / 1048576).toFixed(1)} MB, kegedean buat diunduh langsung. Pakai tombol "Kirim ke Gmail" aja.`);
  res.setHeader('Content-Type', file.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  if (/\bgzip\b/.test(String(req.headers['accept-encoding'] || ''))) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    return res.end(body);
  }
  if (file.raw.length > DOWNLOAD_LIMIT) return fail(res, 413, 'BACKUP_TOO_BIG', 'Backup-nya kegedean buat diunduh langsung. Pakai tombol "Kirim ke Gmail" aja.');
  return res.end(file.raw);
}
const backupFail = (res, e) => (e.status ? fail(res, e.status, e.code, e.message)
  : e.code === 'EMAIL_SEND_FAILED' ? fail(res, 502, 'EMAIL_SEND_FAILED', `Backup-nya udah jadi, tapi email gagal dikirim: ${e.reason || 'server email nolak pesannya.'}`)
  : fail(res, 503, 'BACKUP_FAILED', 'Backup gagal dibuat. Coba lagi bentar.'));

router.get('/owner/backup/status', auth, owner, (req, res) => res.json({
  success: true,
  email: { configured: emailService.isConfigured(), to: backups.backupRecipient() ? backups.backupRecipient().replace(/^(.{2}).*(@.*)$/, '$1***$2') : null },
  github: { token: !!process.env.GITHUB_TOKEN, repo: process.env.GITHUB_REPO || 'Yannz2zWorld/api-docs', branch: process.env.GITHUB_BRANCH || 'main' },
  daily: { enabled: !!process.env.CRON_SECRET }
}));

router.get(['/owner/backup', '/owner/backup/json'], auth, owner, async (req, res) => {
  try {
    const file = await backups.jsonBackup();
    await audit.writeAudit({ actorUserId: req.account.id, action: 'backup_create', targetType: 'backup', metadata: { kind: 'json' }, ipAddress: ip(req) });
    return sendBackupFile(req, res, file);
  } catch (e) { return backupFail(res, e); }
});

router.get('/owner/backup/database', auth, owner, async (req, res) => {
  try {
    const file = await backups.databaseBackup();
    await audit.writeAudit({ actorUserId: req.account.id, action: 'backup_create', targetType: 'backup', metadata: { kind: 'database' }, ipAddress: ip(req) });
    return sendBackupFile(req, res, file);
  } catch (e) { return backupFail(res, e); }
});

router.get('/owner/backup/web', auth, owner, async (req, res) => {
  try {
    const url = await backups.webZipUrl();
    await audit.writeAudit({ actorUserId: req.account.id, action: 'backup_create', targetType: 'backup', metadata: { kind: 'web' }, ipAddress: ip(req) });
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
  } catch (e) {
    if (req.accepts(['html', 'json']) === 'html') return res.status(e.status || 503).type('text/plain; charset=utf-8').send(e.status ? e.message : 'Backup file web gagal dibuat.');
    return backupFail(res, e);
  }
});

router.post('/owner/backup/email', auth, owner, async (req, res) => {
  try {
    const result = await backups.sendToOwner({ reason: 'manual' });
    await audit.writeAudit({ actorUserId: req.account.id, action: 'backup_email', targetType: 'backup', metadata: { parts: result.parts.map(p => ({ label: p.label, attached: p.attached })) }, ipAddress: ip(req) });
    return res.json({ success: true, ...result });
  } catch (e) { return backupFail(res, e); }
});

// Daily automatic backup to the owner's Gmail (vercel.json "crons"). Vercel calls it with
// "Authorization: Bearer <CRON_SECRET>"; without CRON_SECRET set it does nothing.
router.get('/cron/backup', async (req, res) => {
  const secret = process.env.CRON_SECRET || '';
  if (!secret) return fail(res, 503, 'CRON_NOT_CONFIGURED', 'Set CRON_SECRET di Vercel buat backup otomatis harian.');
  const given = Buffer.from(String(req.headers.authorization || ''));
  const want = Buffer.from(`Bearer ${secret}`);
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return fail(res, 401, 'UNAUTHORIZED', 'Unauthorized.');
  try {
    const result = await backups.sendToOwner({ reason: 'cron' });
    await audit.writeAudit({ actorUserId: null, action: 'backup_email', targetType: 'backup', metadata: { auto: true, parts: result.parts.map(p => ({ label: p.label, attached: p.attached })) }, ipAddress: ip(req) });
    return res.json({ success: true, parts: result.parts });
  } catch (e) {
    console.error('Daily backup failed:', { code: e.code || null });
    return backupFail(res, e);
  }
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
    return fail(res, 400, 'INVALID_PAYMENT', 'Payload transaksi nggak valid.');
  }
  const order = (await query('SELECT * FROM orders WHERE order_code=$1', [code]))[0];
  if (!order || Number(order.amount) !== amount) return fail(res, 400, 'INVALID_PAYMENT', 'Order atau nominalnya nggak cocok.');
  if (order.status === 'paid') return res.json({ success: true, processed: false, duplicate: true });
  if (order.status !== 'pending') return fail(res, 409, 'ORDER_NOT_PENDING', 'Order ini udah nggak pending.');
  let verified = false;
  try {
    verified = await pakasir.verifyTransaction(code, amount);
  } catch (e) {
    console.error('Pakasir verification failed:', { status: e?.response?.status || null, code: e?.code || null });
  }
  if (!verified) return fail(res, 202, 'PAYMENT_NOT_VERIFIED', 'Transaksi belum diverifikasi provider.');
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
  if (err?.code === '22P02') return fail(res, 404, 'NOT_FOUND', 'Datanya nggak ketemu.');
  if (err?.isDatabaseError) {
    const c = classifyDatabaseError(err);
    console.error('Platform route failed:', { path: req.path, error: c.error, code: c.code });
    // dbCode is the SQLSTATE (e.g. 23514), never the SQL text or parameters: it lets the
    // owner diagnose schema drift from a screenshot without access to server logs.
    return fail(res, 503, c.error === 'DATABASE_SCHEMA_OUTDATED' ? c.error : 'DATABASE_UNAVAILABLE', 'Layanan data lagi nggak tersedia. Coba lagi bentar ya.', { dbCode: /^[0-9A-Z]{5}$/.test(c.code) ? c.code : null });
  }
  console.error('Platform route failed:', { path: req.path, name: err?.name || null, code: err?.code || null });
  return fail(res, 500, 'INTERNAL_ERROR', 'Ada masalah di server. Coba lagi bentar ya.');
});

module.exports = router;
