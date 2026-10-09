require('dotenv').config({ quiet: true });
const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const { healthCheck, checkSchema } = require('./lib/db');
const { classifyGoogleVerifyError, classifyDatabaseError, missingAuthConfig } = require('./lib/authErrors');
const userService = require('./services/userService');
const { query } = require('./lib/db');
const platformRouter = require('./routes/platform');
const apiKeyService = require('./services/apiKeyService');
const usageService = require('./services/usageService');
const turnstile = require('./services/turnstileService');
const activity = require('./services/activityService');
const maintenance = require('./services/maintenanceService');
const { canAccess, getTier } = require('./services/tierService');
const auditService = require('./services/auditService');

const settings = require('./settings');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://apiz2z.vercel.app/auth/google/callback';
const AUTH_SECRET = process.env.AUTH_SECRET || '';

// Names only: never log configuration values.
{
  const missing = [...missingAuthConfig(), ...(process.env.DATABASE_URL ? [] : ['DATABASE_URL'])];
  if (missing.length) console.error('Server configuration incomplete; missing environment variables:', missing.join(', '));
  if (AUTH_SECRET && AUTH_SECRET.length < 32) console.error('AUTH_SECRET is shorter than 32 characters; use a long random value.');
}

function requireAuthConfig() {
  if (!GOOGLE_CLIENT_ID || !AUTH_SECRET) {
    throw new Error('Google OAuth belum diatur. Isi GOOGLE_CLIENT_ID dan AUTH_SECRET di environment variables.');
  }
}

function base64url(value) {
  return Buffer.from(value).toString('base64url');
}
function fromBase64url(value) {
  return Buffer.from(value, 'base64url');
}
function encryptSession(payload) {
  requireAuthConfig();
  const key = crypto.createHash('sha256').update(AUTH_SECRET).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(payload));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map(base64url).join('.');
}
function decryptSession(token) {
  if (!token || !AUTH_SECRET) return null;
  try {
    const key = crypto.createHash('sha256').update(AUTH_SECRET).digest();
    const [iv, tag, encrypted] = token.split('.').map(fromBase64url);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const data = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const session = JSON.parse(data.toString('utf8'));
    if (!session.exp || session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}
function setCookie(res, name, value, maxAge) {
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
function clearCookie(res, name) {
  res.setHeader('Set-Cookie', `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`);
}
function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(header.split(';').filter(Boolean).map(part => {
    const i = part.indexOf('=');
    const raw=part.slice(i+1);let value=raw;try{value=decodeURIComponent(raw);}catch{}
    return [part.slice(0, i).trim(), value];
  }));
}
function currentUser(req) {
  return decryptSession(parseCookies(req).yannz_session);
}
async function authRequired(req, res, next) {
  const session = currentUser(req);
  if (!session) return res.redirect('/');
  try {
    const user = await userService.getUserForSession(session);
    if (!user) {
      clearCookie(res, 'yannz_session');
      return res.redirect('/?auth=account_missing');
    }
    if (user.status !== 'active') {
      clearCookie(res, 'yannz_session');
      return res.redirect('/?auth=restricted');
    }
    req.account = user;
    return next();
  } catch (err) {
    console.error('Authentication database check failed:', err.code || 'DATABASE_ERROR');
    return res.status(503).send('Layanan akun lagi nggak tersedia. Coba lagi bentar ya.');
  }
}
// Several domains can serve the site at once (CORS_ORIGINS lists them). The Google redirect flow
// returns to the domain the visitor is on when that domain is allowed, so the session cookie is
// set where they are; any other host falls back to GOOGLE_CALLBACK_URL. Each domain's callback
// (https://<domain>/auth/google/callback) must be an Authorized redirect URI in Google Cloud.
function googleCallbackUrl(req) {
  const origin = req ? `${req.protocol}://${req.get('host')}` : '';
  return origin && allowedOrigins.has(origin) ? `${origin}/auth/google/callback` : GOOGLE_CALLBACK_URL;
}
function createOAuthClient(req) {
  requireAuthConfig();
  return new OAuth2Client(GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET || undefined, googleCallbackUrl(req));
}
function randomState() { return crypto.randomBytes(32).toString('base64url'); }
function safeEqual(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);}


app.set('trust proxy', 1);
app.disable('x-powered-by');
app.set("json spaces", 2);
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-Frame-Options', 'DENY');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
  // Script sources stay unrestricted (CDN scripts, Google Identity Services); these
  // directives only block framing, <base> hijacking and plugin content.
  res.set('Content-Security-Policy', "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  next();
});
// Bodies are small everywhere except a manual payment, which carries the proof image
// (<= 2 MB, base64 in JSON; Vercel's request limit is 4.5 MB).
const uploadPaths = new Set();   // theresav file endpoints accept a raw uploaded file (POST body)
uploadPaths.add('/cdn/upload');   // CDN upload page (routes/platform.js)
const smallJson = express.json({ limit: '100kb' });
const proofJson = express.json({ limit: '3mb' });
const pluginJson = express.json({ limit: '768kb' });   // owner panel .js upload (max 200 KB of code), profile picture (max 512 KB image)
const rawUpload = express.raw({ type: () => true, limit: '8mb' });
app.use((req, res, next) => (req.method === 'POST' && uploadPaths.has(req.path) ? rawUpload : /^\/api\/orders\/[^/]+\/manual$/.test(req.path) ? proofJson : req.path === '/owner/api/endpoints' || req.path === '/api/profile/avatar' ? pluginJson : smallJson)(req, res, next));
app.use(express.urlencoded({ extended: false, limit:'100kb' }));
const allowedOrigins = new Set([`https://${process.env.VERCEL_URL || 'apiz2z.vercel.app'}`, 'https://apiz2z.vercel.app', ...(process.env.CORS_ORIGINS || '').split(',').map(v => v.trim().replace(/\/+$/, '')).filter(Boolean)]);
// Any origin is allowed only for local development; deployed instances (Vercel) only trust
// their own origins. A disallowed origin simply gets no CORS headers (the browser blocks it).
const allowAnyOrigin = !process.env.VERCEL && process.env.NODE_ENV !== 'production';
app.use(cors({ origin(origin, callback) { callback(null, !origin || allowedOrigins.has(origin) || allowAnyOrigin); }, credentials: true }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_PER_MINUTE) || 150,
  message: {
    creator: settings.creatorName || "YannAjah",
    status: false,
    message: "Kebanyakan request dari IP kamu. Coba lagi nanti ya."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  // Page assets (styles, scripts, the translation dictionary, icons) don't count: one page view
  // loads many of them, and a refused dictionary left pages half in Indonesian.
  skip: req => req.method === 'GET' && (req.path.startsWith('/assets/') || req.path.startsWith('/views/') || /^\/(favicon\.(ico|png)|apple-touch-icon\.png)$/.test(req.path))
});
app.use(limiter);
const authLimiter=rateLimit({windowMs:15*60*1000,max:Number(process.env.AUTH_RATE_LIMIT_PER_15MIN)||20,standardHeaders:true,legacyHeaders:false,message:{success:false,error:'AUTH_RATE_LIMIT',message:'Kebanyakan percobaan login. Coba lagi nanti ya.'}});
app.use(['/auth/google','/auth/google/callback','/auth/google/credential','/auth/login','/auth/register','/auth/email/verify','/auth/email/resend','/auth/password/forgot','/auth/password/reset'],authLimiter);

// Shared stylesheet for the account pages (explicit route so the Vercel bundle includes it).
app.get('/assets/scene3d.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'scene3d.js'));
});
// Hero model: the Crimson Requiem scythe baked from /3d (Draco + WebP, see tools/scythe/bake_web.py).
app.get('/assets/scythe.glb', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('model/gltf-binary').sendFile(path.join(__dirname, 'views', 'assets', 'scythe.glb'));
});
// The full website song (see services/siteMusicService.js); sendFile answers Range requests, so the
// browser can seek and stream it.
app.get('/assets/site-music.mp3', (req, res) => {
  res.set('Cache-Control', 'public, max-age=604800');
  res.type('audio/mpeg').sendFile(path.join(__dirname, 'views', 'assets', 'site-music.mp3'));
});
app.get('/assets/music.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'music.js'));
});
// Website translation (views/i18n.js) and its English dictionary.
// no-cache = the browser checks for a newer version on every page (a quick 304 when unchanged),
// so new or changed texts are translated right after a deploy.
app.get('/assets/i18n.js', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'i18n.js'));
});
app.get('/assets/i18n-en.json', (req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.type('application/json').sendFile(path.join(__dirname, 'views', 'i18n-en.json'));
});
app.get('/assets/select.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'select.js'));
});
app.get('/assets/chat.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'chat.js'));
});
app.get('/assets/aura-intro.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'aura-intro.js'));
});
app.get('/assets/scythe-mark.webp', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('image/webp').sendFile(path.join(__dirname, 'views', 'assets', 'scythe-mark.webp'));
});
app.get('/assets/slash-intro.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'slash-intro.js'));
});
app.get('/assets/qris-manual.jpg', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'views', 'assets', 'qris-manual.jpg'));
});
app.get('/assets/theme.css', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'views', 'theme.css'));
});
app.use('/views', express.static(path.join(__dirname, 'views')));

// ------------------------------------------------------------------------ CDN (file)
// Publik dan tanpa autentikasi: server lain harus bisa fetch URL ini. Didefinisikan sebelum
// middleware maintenance supaya tetap bisa diakses saat website maintenance. Unggah file lewat
// halaman /upload (POST /cdn/upload di routes/platform.js).
const cdnService = require('./services/cdnService');
app.get('/cdn/:id', async (req, res) => {
  const id = String(req.params.id || '');
  if (!cdnService.isValidId(id)) return res.status(404).json({ status: false, error: 'NOT_FOUND' });
  try {
    const f = await cdnService.fetchFile(id);
    if (!f) return res.status(404).json({ status: false, error: 'NOT_FOUND' });
    if ('redirect' in f) {   // large file stored in Cloudflare R2: send the browser to the bucket's public URL
      if (!f.redirect) return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE' });
      res.set('Cache-Control', 'public, max-age=300');
      return res.redirect(302, f.redirect);
    }
    // Uploaded files are served from this domain: safe types open in the browser, everything else
    // downloads, and the sandbox CSP keeps any uploaded content from running script here.
    const fname = encodeURIComponent(f.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    res.set('Cache-Control', 'public, max-age=86400, immutable');
    res.set('Content-Type', f.mime);
    res.set('Content-Length', String(f.size));
    res.set('Content-Disposition', `${f.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${fname}`);
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Content-Security-Policy', f.mime === 'application/pdf' ? "default-src 'none'; frame-ancestors 'none'" : "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox");
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.end(f.buffer);
  } catch (e) {
    return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE' });
  }
});

app.locals.getSession = currentUser;
app.locals.maintenance = maintenance;

// ---------------------------------------------------------------- Maintenance Info Website
// While on, every page and endpoint answers 503 with the maintenance notice, except for the
// owner (OWNER_EMAIL) and what the owner needs to sign in. Sign-in itself is checked again in
// each handler (password routes by the email given, Google after the token is verified), so
// calling an endpoint directly cannot get around it.
const MAINTENANCE_OPEN = new Set(['/health', '/health/database', '/api/logo-proxy', '/api/set', '/auth/config', '/auth/me', '/auth/logout', '/owner-login', '/developer-login', '/auth/google', '/auth/google/callback', '/auth/google/credential', '/favicon.ico']);
const MAINTENANCE_SIGN_IN = new Set(['/auth/login', '/auth/register', '/auth/email/verify', '/auth/email/resend', '/auth/password/forgot', '/auth/password/reset']);
const SITE_PAGES = new Set(['/', '/home', '/keys', '/billing', '/pricing', '/profile', '/upload', '/owner', '/api', '/api/playground', '/3d', '/scythe', '/usage']);
let maintenancePage = null;
function sendMaintenance(req, res, message) {
  res.set('Retry-After', '300');
  res.set('Cache-Control', 'no-store');
  const page = req.method === 'GET' && (SITE_PAGES.has(req.path) || (!/^\/(api|owner|auth|webhooks)\//.test(req.path) && req.accepts(['json', 'html']) === 'html'));
  if (!page) return res.status(503).json({ success: false, error: 'MAINTENANCE', message, maintenance: true });
  if (!maintenancePage) maintenancePage = fs.readFileSync(path.join(__dirname, 'views', 'maintenance.html'), 'utf8');
  const safe = String(message).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  return res.status(503).type('html').send(maintenancePage.replace('{{MESSAGE}}', safe));
}
app.locals.sendMaintenance = sendMaintenance;
app.use(async (req, res, next) => {
  if (req.path.startsWith('/assets/') || req.path.startsWith('/views/') || req.path.startsWith('/webhooks/') || (req.method === 'GET' && req.path.startsWith('/cdn/')) || MAINTENANCE_OPEN.has(req.path)) return next();
  let m;
  try { m = await maintenance.state(); } catch { return next(); }
  if (!m.enabled) return next();
  // Email/password forms: only the owner's own address gets through.
  if (MAINTENANCE_SIGN_IN.has(req.path)) {
    const email = typeof req.body?.email === 'string' ? req.body.email : '';
    if (req.method === 'POST' && userService.isOwnerEmail(email)) return next();
    return sendMaintenance(req, res, m.message);
  }
  // Plugin endpoints called with an API key: the gateway answers MAINTENANCE for every key that
  // is not the owner's.
  if (loadedPluginPaths.has(req.path) && (req.get('authorization') || req.get('x-api-key'))) return next();
  try {
    const session = currentUser(req);
    const user = session ? await userService.getUserForSession(session) : null;
    if (user?.isOwner && user.status === 'active') return next();
  } catch (e) {
    console.error('Maintenance owner check failed:', { code: e?.code || null });
  }
  return sendMaintenance(req, res, m.message);
});
// The owner is shown as "Developer": /developer and /developer-login are aliases of /owner and /owner-login.
app.get(['/owner-login', '/developer-login'], (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/developer', (req, res) => res.redirect('/owner'));
// Page visits of signed-in users for the owner's activity log (best effort, throttled).
const TRACKED_PAGES = new Set(['/home', '/keys', '/billing', '/pricing', '/profile', '/upload', '/owner', '/api', '/api/playground', '/3d', '/scythe']);
app.use((req, res, next) => {
  if (req.method === 'GET' && TRACKED_PAGES.has(req.path)) {
    const s = currentUser(req);
    if (s?.userId) activity.logPage({ userId: s.userId, path: req.path, ip: (req.ip || '').replace(/^::ffff:/, '') }).catch(() => {});
  }
  next();
});
app.locals.issueSession = (...args) => issueSession(...args);
app.use(platformRouter);
app.use(require('./routes/auth')({ issueSession }));

global.getBuffer = async (url, options = {}) => {
  try {
    const res = await axios({
      method: 'get',
      url,
      headers: {
        'DNT': 1,
        'Upgrade-Insecure-Request': 1,
        'User-Agent': 'Mozilla/5.0'
      },
      ...options,
      responseType: 'arraybuffer'
    });
    return res.data;
  } catch (err) {
    return err;
  }
};

global.fetchJson = async (url, options = {}) => {
  try {
    const res = await axios({
      method: 'GET',
      url,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      },
      ...options
    });
    return res.data;
  } catch (err) {
    return err;
  }
};


app.use((req, res, next) => {
  // Process-local counters are telemetry only; persisted usage lives in Neon.

  const originalJson = res.json;
  res.json = function (data) {
    if (
      data &&
      typeof data === 'object' &&
      req.path !== '/api/endpoints' &&
      req.path !== '/api/set'
    ) {
      return originalJson.call(this, {
        creator: settings.creatorName || "YannAjah",
        ...data
      });
    }
    return originalJson.call(this, data);
  };

  next();
});

app.get('/api/tiers', (req, res) => {
  const { TIERS, purchasable } = require('./services/tierService');
  const finite = v => (Number.isFinite(v) ? v : null);
  res.json({ success: true, tiers: Object.entries(TIERS).map(([name, t]) => ({
    name, price: t.price, dailyLimit: finite(t.limit), apiKeys: finite(t.keys), purchasable: purchasable.includes(name)
  })) });
});

// Website background music (views/music.js): song info, and /api/site-music/audio, which redirects to
// the bundled song or, with SITE_MUSIC_URL set to a TikTok link, to its current audio link.
const siteMusic = require('./services/siteMusicService');
app.get('/api/site-music', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (!siteMusic.enabled()) return res.json({ status: true, enabled: false });
  const m = await siteMusic.resolve();
  if (!m) return res.status(502).json({ status: false, enabled: true, error: 'MUSIC_UNAVAILABLE', message: 'Lagunya lagi nggak bisa dimuat.' });
  return res.json({ status: true, enabled: true, title: m.title, author: m.author, src: m.local ? m.audio : '/api/site-music/audio' });
});
app.get('/api/site-music/audio', async (req, res) => {
  const m = siteMusic.enabled() ? await siteMusic.resolve() : null;
  if (!m) return res.status(502).json({ status: false, error: 'MUSIC_UNAVAILABLE' });
  res.set('Cache-Control', 'private, max-age=600');
  return res.redirect(302, m.audio);
});

app.get('/api/set', (req, res) => {
  const publicSettings = { ...settings };
  delete publicSettings.apiKeys;
  res.json(publicSettings);
});

// Site icon (views/assets/favicon.png). /api/logo-proxy is kept for old links and serves the same file.
app.get(['/api/logo-proxy', '/assets/favicon.png'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('image/png').sendFile(path.join(__dirname, 'views', 'assets', 'favicon.png'));
});
app.get('/assets/apple-touch-icon.png', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('image/png').sendFile(path.join(__dirname, 'views', 'assets', 'apple-touch-icon.png'));
});
app.get('/favicon.ico', (req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  res.type('image/x-icon').sendFile(path.join(__dirname, 'views', 'assets', 'favicon.ico'));
});

const loadedPluginPaths = new Set();
app.locals.loadedPluginPaths = loadedPluginPaths;

function gatewayFail(res, status, error, message, extra = {}) {
  return res.status(status).json({ success: false, error, message, ...extra });
}

// Session (cookie) access to plugin endpoints is only accepted from the site's own
// pages: they send X-Yannz-Client, which a cross-site page cannot add without a CORS
// preflight we never approve. This stops cross-site links/forms from spending a
// logged-in user's quota (SameSite=Lax still sends the cookie on top-level GETs).
function sessionRequestAllowed(req) {
  if (!req.get('x-yannz-client')) return false;
  const site = req.get('sec-fetch-site');
  return !site || site === 'same-origin';
}

// The signed-in, active account behind this request's session cookie, if any.
async function callerAccount(req) {
  const session = currentUser(req);
  if (!session) return null;
  const user = await userService.getUserForSession(session);
  return user && user.status === 'active' ? user : null;
}

async function resolveIdentity(req) {
  const header = String(req.get('authorization') || '');
  const presented = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || String(req.get('x-api-key') || '').trim();
  if (presented) {
    const clientIp = (req.ip || '').replace(/^::ffff:/, '') || null;
    const key = await apiKeyService.findKey(presented, clientIp);
    if (key?.throttled) return { error: [429, 'TOO_MANY_INVALID_KEYS', 'Kebanyakan API key salah dari jaringan ini. Coba lagi 15 menit lagi ya.'] };
    if (!key) {
      await apiKeyService.recordInvalidKey(clientIp);
      return { error: [401, 'INVALID_API_KEY', 'API key-nya nggak valid.'] };
    }
    if (key.key_status === 'disabled') return { error: [403, 'API_KEY_DISABLED', 'API key ini lagi dinonaktifkan developer.'] };
    if (key.key_status !== 'active') return { error: [401, 'API_KEY_REVOKED', 'API key ini udah dicabut.'] };
    if (key.key_expires_at && new Date(key.key_expires_at) <= new Date()) return { error: [401, 'API_KEY_EXPIRED', 'Masa aktif API key ini udah habis. Minta developer buat perpanjang ya.', { expiredAt: new Date(key.key_expires_at).toISOString() }] };
    if (key.user_status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun kamu lagi nggak aktif.'] };
    const kind = key.key_visibility;
    if (kind) {
      // Owner-managed keys. Private and owner keys check who is calling as well as the key: the
      // caller's signed-in account (session cookie), so knowing the key alone is not enough.
      const caller = await callerAccount(req);
      if (kind === 'owner') {
        if (!caller?.isOwner) return { error: [403, 'OWNER_KEY_ONLY', 'Yahaha mau ngambil key gwa ya 😹😝'] };
        return { identity: { userId: caller.id, keyId: key.key_id, tier: 'OWNER' } };
      }
      if (kind === 'private') {
        if (!caller) return { error: [401, 'PRIVATE_KEY_LOGIN_REQUIRED', 'API key ini private: login dulu pakai akun yang dikasih akses sama developer.'] };
        if (!caller.isOwner && !(await apiKeyService.hasAccess(key.key_id, caller.id))) return { error: [403, 'PRIVATE_KEY_DENIED', 'API key ini private dan nggak dikasih buat akun kamu.'] };
      }
      // public / private: the key's own tier and daily quota (never the owner's account tier).
      return { identity: { userId: caller?.id || key.uid, keyId: key.key_id, tier: key.key_tier || 'FREE', keyScoped: true } };
    }
    // A key issued with its own tier is limited to that tier and has its own daily quota.
    if (key.key_tier) return { identity: { userId: key.uid, keyId: key.key_id, tier: key.key_tier, keyScoped: true } };
    return { identity: { userId: key.uid, keyId: key.key_id, tier: key.tier } };
  }
  const session = currentUser(req);
  if (!session) return { error: [401, 'AUTH_REQUIRED', 'Login dulu, atau kirim API key lewat header Authorization: Bearer <key>.'] };
  if (!sessionRequestAllowed(req)) return { error: [403, 'CSRF_BLOCKED', 'Akses pakai sesi login cuma bisa dari halaman Yannz API. Buat integrasi, pakai API key.'] };
  const user = await userService.getUserForSession(session);
  if (!user) return { error: [401, 'AUTH_REQUIRED', 'Sesi kamu udah nggak valid. Login lagi ya.'] };
  if (user.status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun kamu lagi nggak aktif.'] };
  return { identity: { userId: user.id, keyId: null, tier: user.tier } };
}

// Order matters: authentication and authorization failures are answered before any quota
// is reserved, and a reserved request is refunded when the handler does not succeed, so
// the daily quota counts successful fetches only.
function apiGateway(cleanPath, run) {
  return async (req, res) => {
    let identity;
    let endpoint;
    let quota;
    try {
      await registryReady;
      const resolved = await resolveIdentity(req);
      if (resolved.error) return gatewayFail(res, ...resolved.error);
      identity = resolved.identity;
      const owner = identity.tier === 'OWNER';

      // One round trip: endpoint access rules plus the global maintenance flag.
      endpoint = (await query('SELECT e.id,e.status,e.locked,e.minimum_tier,s.maintenance_enabled,s.maintenance_message FROM endpoints e LEFT JOIN server_settings s ON s.id=1 WHERE e.path=$1 LIMIT 1', [cleanPath]))[0];
      if (!endpoint) return gatewayFail(res, 503, 'ENDPOINT_REGISTRY_NOT_READY', 'Registry endpoint belum tersedia.');
      if (endpoint.status !== 'active') return gatewayFail(res, 404, 'ENDPOINT_UNAVAILABLE', 'Endpoint ini lagi dinonaktifkan.');
      if (endpoint.locked && !owner) return gatewayFail(res, 403, 'ENDPOINT_LOCKED', 'Endpoint ini lagi dikunci developer.');
      if (!owner && !canAccess(identity.tier, endpoint.minimum_tier, false)) {
        return gatewayFail(res, 403, 'TIER_RESTRICTED', `Endpoint ini butuh tier ${endpoint.minimum_tier} atau lebih tinggi.`, { requiredTier: endpoint.minimum_tier, currentTier: identity.tier });
      }
      if (endpoint.maintenance_enabled && !owner) return gatewayFail(res, 503, 'MAINTENANCE', endpoint.maintenance_message);

      quota = await (identity.keyScoped ? usageService.consumeKey : usageService.consume)({ userId: identity.userId, keyId: identity.keyId, endpointId: endpoint.id, tier: identity.tier });
      res.set('X-RateLimit-Limit', quota.limit == null ? 'unlimited' : String(quota.limit));
      res.set('X-RateLimit-Remaining', quota.remaining == null ? 'unlimited' : String(quota.remaining));
      res.set('X-RateLimit-Reset', quota.resetAt);
      if (!quota.allowed) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000))));
        return gatewayFail(res, 429, 'QUOTA_EXCEEDED', 'Jatah request harian kamu udah habis.', { used: quota.used, limit: quota.limit, remaining: 0, resetAt: quota.resetAt });
      }
      if (identity.keyId) await query('UPDATE api_keys SET last_used_at=now() WHERE id=$1', [identity.keyId]);
    } catch (error) {
      const c = classifyDatabaseError(error);
      console.error('API gateway error:', { error: c.error, code: c.code });
      return gatewayFail(res, 503, 'GATEWAY_UNAVAILABLE', 'API gateway lagi nggak tersedia.');
    }

    // Refund (failed calls) and the activity record are written before the response is
    // flushed: serverless runtimes may freeze after it ends.
    let settled = false;
    const started = Date.now();
    const end = res.end;
    res.end = function (...args) {
      if (settled) return end.apply(this, args);
      settled = true;
      const tasks = [activity.logApi({ userId: identity.userId, keyId: identity.keyId, path: cleanPath, status: res.statusCode, ms: Date.now() - started, ip: (req.ip || '').replace(/^::ffff:/, '') })];
      if (res.statusCode >= 400) {
        tasks.push((identity.keyScoped ? usageService.refundKey : usageService.refund)({ userId: identity.userId, keyId: identity.keyId, endpointId: endpoint.id, usageDate: quota.usageDate })
          .catch(e => console.error('Quota refund failed:', { code: e?.code || null })));
      }
      Promise.allSettled(tasks).finally(() => end.apply(this, args));
      return this;
    };
    req.apiAuth = { userId: identity.userId, keyId: identity.keyId, tier: identity.tier, quota };
    try {
      await run(req, res);
    } catch (error) {
      console.error('Plugin handler failed:', { path: cleanPath, name: error?.name || null, code: error?.code || null });
      if (!res.headersSent) return gatewayFail(res, 502, 'UPSTREAM_FAILED', 'Layanan sumbernya lagi bermasalah. Kuota nggak dipotong.');
    }
  };
}

let totalRoutes = 0;
let rawEndpoints = {};
const pluginFolder = path.join(__dirname, 'plugin');
const registrySyncTasks = [];

if (!fs.existsSync(pluginFolder)) {
  fs.mkdirSync(pluginFolder);
}

fs.readdirSync(pluginFolder).forEach(file => {
  const fullPath = path.join(pluginFolder, file);
  if (file.endsWith('.js')) {
    try {
      const routes = require(fullPath);
      const handlers = Array.isArray(routes) ? routes : [routes];

      handlers.forEach(route => {
        const { name, desc, category, path: routePath, run, params } = route;

        if (name && desc && category && routePath && typeof run === 'function') {
          const cleanPath = routePath.split('?')[0];
          app.get(cleanPath, apiGateway(cleanPath, run));
          if (route.upload) { uploadPaths.add(cleanPath); app.post(cleanPath, apiGateway(cleanPath, run)); }
          loadedPluginPaths.add(cleanPath);
          registrySyncTasks.push(query(`INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,$4,$5,false,'active',$6) ON CONFLICT(path) DO NOTHING`, [name,cleanPath,desc,'GET','FREE',file.replace(/\.js$/,'')]).catch(e=>{console.error('Endpoint registry sync failed:',e.code||'DATABASE_ERROR');return null;}));

          if (!rawEndpoints[category]) rawEndpoints[category] = [];
          rawEndpoints[category].push({
            name,
            desc,
            path: routePath,
            cleanPath: cleanPath,
            // Optional per-parameter info (required, placeholder) for the sandbox form.
            ...(Array.isArray(params) ? { params } : {})
          });

          totalRoutes++;
          console.log(chalk.hex('#ff79c6')(`✔ Loaded Plugin Route: `) + chalk.hex('#f1fa8c')(`${cleanPath} (${file})`));
        } else {
          console.warn(chalk.bgRed.white(` ⚠ Skipped invalid route in ${file}`));
        }
      });

    } catch (err) {
      console.error(chalk.bgRed.white(` ❌ Error in plugin ${file}: ${err.message}`));
    }
  }
});

const registryReady = Promise.allSettled(registrySyncTasks);

const sortedEndpoints = Object.keys(rawEndpoints)
  .sort((a, b) => a.localeCompare(b))
  .reduce((sorted, category) => {
    sorted[category] = rawEndpoints[category].sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, {});

app.get('/api/endpoints', async (req, res) => {
  try { const [rows,registry]=await Promise.all([query('SELECT COALESCE(sum(request_count),0)::int AS n FROM api_usage'),query('SELECT path,method,status,locked,minimum_tier,description,badge FROM endpoints').catch(e=>{if(e.code!=='42703')throw e;return query('SELECT path,method,status,locked,minimum_tier,description FROM endpoints');})]); const meta=Object.fromEntries(registry.map(x=>[x.path,x])); const catalog=Object.fromEntries(Object.entries(sortedEndpoints).map(([category,items])=>[category,items.map(item=>({...item,access:meta[item.cleanPath]||null}))])); return res.json({total:totalRoutes,totalRequests:rows[0].n,endpoints:catalog}); }
  catch { return res.status(503).json({success:false,error:'ENDPOINTS_UNAVAILABLE',message:'Katalog lagi nggak tersedia.'}); }
});


app.get('/health', (req,res)=>res.json({status:'ok'}));

app.get('/health/database', async (req, res) => {
  try {
    const ok = await healthCheck();
    if (!ok) return res.status(503).json({ database: 'disconnected' });
    const schema = await checkSchema();
    if (!schema.ok) return res.status(503).json({ database: 'connected', schema: 'migration_required', missing: schema.missing });
    return res.json({ database: 'connected', schema: 'ok' });
  } catch (err) {
    const c = classifyDatabaseError(err);
    console.error('Database health check failed:', { error: c.error, code: c.code });
    return res.status(503).json({ database: 'disconnected', error: c.error });
  }
});

app.get('/auth/config', (req, res) => {
  const turnstileSiteKey = turnstile.isEnabled() ? turnstile.siteKey() : null;
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ configured: false, turnstileSiteKey });
  res.json({ configured: true, clientId: GOOGLE_CLIENT_ID, turnstileSiteKey });
});

function issueSession(res, sub, account, provider = 'google') {
  const session = {
    sub,
    userId: account.id,
    email: account.email,
    name: account.name,
    picture: account.picture,
    provider,
    sv: account.sessionVersion || 0,
    iat: Date.now(),
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  };
  setCookie(res, 'yannz_session', encryptSession(session), 7 * 24 * 60 * 60);
}

// Each stage reports its own stable error code so a production failure can be traced
// from the response body or the Vercel log line without logging tokens or secrets.
app.post('/auth/google/credential', turnstile.guard(), async (req, res) => {
  const fail = (status, error, message, log) => {
    if (log) console.error('Google credential/login failed:', log);
    return res.status(status).json({ success: false, error, message });
  };

  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return fail(403, 'CSRF_BLOCKED', 'Origin ini nggak diizinkan.', { stage: 'origin' });
  }

  const missing = missingAuthConfig();
  if (missing.length) {
    return fail(503, 'AUTH_NOT_CONFIGURED', 'Login Google belum diatur di server.', { stage: 'config', missing });
  }

  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) return fail(400, 'MISSING_CREDENTIAL', 'Credential Google nggak ketemu.');

  let profile;
  try {
    const verifier = new OAuth2Client();
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    profile = ticket.getPayload();
  } catch (err) {
    const c = classifyGoogleVerifyError(err);
    const message = c.status === 503
      ? 'Server nggak bisa nyambung ke Google buat verifikasi. Coba lagi ya.'
      : 'Login Google gagal. Credential-nya nggak valid atau udah kedaluwarsa.';
    return fail(c.status, c.error, message, { stage: 'verify', reason: c.reason, code: c.code });
  }

  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    return fail(403, 'EMAIL_NOT_VERIFIED', 'Akun Google kamu harus punya email yang udah terverifikasi.', { stage: 'profile', reason: 'EMAIL_NOT_VERIFIED' });
  }
  {
    const m = await maintenance.state();
    if (m.enabled && !userService.isOwnerEmail(profile.email)) return fail(503, 'MAINTENANCE', m.message);
  }

  let account;
  try {
    account = await userService.upsertGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    });
  } catch (err) {
    const c = classifyDatabaseError(err);
    return fail(c.status, c.error, 'Layanan akun lagi nggak tersedia. Coba lagi bentar ya.', { stage: 'database', error: c.error, code: c.code });
  }
  if (account.status !== 'active') {
    return fail(403, 'ACCOUNT_RESTRICTED', 'Akun ini lagi nggak aktif. Hubungi developer kalau menurut kamu ini salah.');
  }
  try {
    const sv = await userService.secureGoogleLink(account.id);
    if (sv !== null) account.sessionVersion = sv;
  } catch (err) {
    const c = classifyDatabaseError(err);
    return fail(c.status, c.error, 'Layanan akun lagi nggak tersedia. Coba lagi bentar ya.', { stage: 'database', error: c.error, code: c.code });
  }

  try {
    issueSession(res, profile.sub, account);
  } catch (err) {
    return fail(500, 'SESSION_ERROR', 'Sesi login gagal dibuat.', { stage: 'session', code: err?.code || null });
  }
  await auditService.writeAudit({ actorUserId: account.id, action: 'login', targetType: 'session', ipAddress: (req.ip || '').replace(/^::ffff:/, '') || null }).catch(() => {});
  return res.json({ success: true, redirect: '/home' });
});

app.get('/auth/google', turnstile.redirectGuard(), (req, res) => {
  try {
    const state = randomState();
    const client = createOAuthClient(req);
    setCookie(res, 'oauth_state', state, 600);
    const url = client.generateAuthUrl({
      access_type: 'online',
      scope: ['openid', 'email', 'profile'],
      include_granted_scopes: true,
      state,
      prompt: 'select_account'
    });
    res.redirect(url);
  } catch (err) {
    console.error('Google OAuth init error:', err.code || 'OAUTH_CONFIG_ERROR');
    res.status(500).send('Google OAuth belum diatur di server.');
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const cookies = parseCookies(req);
    clearCookie(res, 'oauth_state');

    if (error) return res.redirect('/?oauth=denied');
    if (!code || !state || !cookies.oauth_state || !safeEqual(state,cookies.oauth_state)) {
      return res.status(400).send('OAuth state nggak valid. Coba login lagi ya.');
    }

    const client = createOAuthClient(req);

    const { tokens } = await client.getToken(String(code));
    if (!tokens?.id_token) {
      throw new Error('Google nggak ngirim id_token.');
    }
    // The ID token came straight from Google's token endpoint; verifying it still checks
    // signature, audience, issuer and expiry, and yields the same profile as the GIS flow.
    const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: GOOGLE_CLIENT_ID });
    const profile = ticket.getPayload();

    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.status(403).send('Akun Google kamu harus punya email yang udah terverifikasi.');
    }
    if ((await maintenance.state()).enabled && !userService.isOwnerEmail(profile.email)) return res.redirect('/?auth=maintenance');

    const account = await userService.upsertGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    });
    if (account.status !== 'active') {
      return res.redirect('/?auth=restricted');
    }
    const sv = await userService.secureGoogleLink(account.id);
    if (sv !== null) account.sessionVersion = sv;
    issueSession(res, profile.sub, account);
    await auditService.writeAudit({actorUserId:account.id,action:'login',targetType:'session'}).catch(()=>{});
    res.redirect('/home');
  } catch (err) {
    const stage = err?.isDatabaseError ? classifyDatabaseError(err).error : 'OAUTH_EXCHANGE_FAILED';
    console.error('Google OAuth callback failed:', { stage, code: err?.code || null, status: err?.response?.status || null, oauthError: typeof err?.response?.data?.error === 'string' ? err.response.data.error : null });
    res.redirect('/?oauth=error');
  }
});

app.get('/auth/me', async (req, res) => {
  const session = currentUser(req);
  if (!session) return res.status(401).json({ authenticated: false });
  try {
    const user = await userService.getUserForSession(session);
    if (!user) {
      clearCookie(res, 'yannz_session');
      return res.status(401).json({ authenticated: false });
    }
    if (user.status !== 'active') {
      clearCookie(res, 'yannz_session');
      return res.status(403).json({ authenticated: false, error: 'Akun ini lagi dibatasi.' });
    }
    const used = await usageService.usageToday(user.id);
    const keyRows = await apiKeyService.listKeys(user.id);
    const limits = getTier(user.tier);
    return res.json({ authenticated: true, user: {
      id:user.id, googleId:user.googleId, name:user.name, email:user.email, picture:user.picture,
      provider:session.provider||'google', tier:user.tier, tierExpiresAt:user.tierExpiresAt, status:user.status, isOwner:user.isOwner
    }, usage:{used,limit:Number.isFinite(limits.limit)?limits.limit:null,remaining:Number.isFinite(limits.limit)?Math.max(0,limits.limit-used):null},
    apiKeys:{used:keyRows.filter(k=>k.status==='active').length,limit:Number.isFinite(limits.keys)?limits.keys:null} });
  } catch (err) {
    console.error('Auth profile database lookup failed:', err.code || 'DATABASE_ERROR');
    return res.status(503).json({ authenticated: false, error: 'Profil lagi nggak bisa dimuat.' });
  }
});

app.post('/auth/logout', async (req, res) => {
  const session=currentUser(req);
  const origin=req.get('origin');if(origin&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({success:false,error:'CSRF_BLOCKED',message:'Origin ini nggak diizinkan.'});
  clearCookie(res, 'yannz_session');
  if (session?.userId) {
    // Invalidate every cookie issued to this account so a copied cookie stops working too.
    try { await userService.revokeSessions(session.userId); }
    catch (err) { console.error('Session revocation failed:', { code: err?.code || null }); return res.status(503).json({ success: false, error: 'DATABASE_UNAVAILABLE', message: 'Logout belum kesimpan di server. Coba lagi ya.' }); }
    await auditService.writeAudit({actorUserId:session.userId,action:'logout',targetType:'session'}).catch(()=>{});
  }
  res.json({ success: true });
});

app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  } catch (err) {
    res.status(500).send('Halaman utama gagal dimuat.');
  }
});

app.get('/home', authRequired, (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } catch (err) {
    res.status(500).send('Dashboard gagal dimuat.');
  }
});

// Interactive 3D scene (standalone page, three.js from the CDN).
app.get(['/3d', '/scythe'], (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'views', 'scythe.html'));
});

app.get('/api/playground', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'playground.html'));
  } catch (err) {
    res.status(500).send('Playground gagal dimuat.');
  }
});

app.get('/api', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'api.html'));
  } catch (err) {
    res.status(500).send('Dokumentasi API gagal dimuat.');
  }
});

app.get('/api/stats', async (req, res) => {
  try { const session=currentUser(req); const account=session?await userService.getUserForSession(session):null; const today=account?await usageService.usageToday(account.id):0; const keys=account?await apiKeyService.listKeys(account.id):[]; const tier=account?.tier||'FREE'; const limit=getTier(tier).limit; const totals=await query("SELECT COALESCE(sum(request_count),0)::int AS n FROM api_usage WHERE usage_date=(now() AT TIME ZONE 'UTC')::date");
    const payload={status:true,totalRequests:totals[0].n,totalEndpoints:totalRoutes,userRequestsToday:today,remaining:Number.isFinite(limit)?Math.max(0,limit-today):null,tier,apiKeyCount:keys.filter(k=>k.status==='active').length,uptime:process.uptime()};
    if(account?.isOwner){const e=await query("SELECT count(*)::int AS n FROM endpoints WHERE status='active'");payload.endpointCount=e[0].n;}return res.json(payload);
  } catch { return res.status(503).json({success:false,error:'STATS_UNAVAILABLE',message:'Statistik lagi nggak tersedia.'}); }
});

app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  if(err?.type==='entity.parse.failed')return res.status(400).json({success:false,error:'INVALID_JSON',message:'Body request-nya bukan JSON yang valid.'});
  if(err?.status===413)return res.status(413).json({success:false,error:'PAYLOAD_TOO_LARGE',message:'Request-nya kegedean.'});
  console.error('Request failed:',{ name: err?.name || null, code: err?.code || 'REQUEST_ERROR' });
  return res.status(500).json({success:false,error:'INTERNAL_ERROR',message:'Ada masalah di server. Coba lagi bentar ya.'});
});

// Vercel imports the exported app; only `node index.js` (npm start) opens a port.
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(chalk.bgHex('#ffb86c').black(` 🚀 SERVER IS RUNNING ON PORT ${PORT} `));
    console.log(chalk.bgHex('#50fa7b').black(` 📦 TOTAL ROUTES LOADED: ${totalRoutes} `));
  });
}

module.exports = app;
