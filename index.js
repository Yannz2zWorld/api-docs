require('dotenv').config();
const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { google } = require('googleapis');
const { healthCheck, checkSchema } = require('./lib/db');
const { classifyGoogleVerifyError, classifyDatabaseError, missingAuthConfig } = require('./lib/authErrors');
const userService = require('./services/userService');
const { query } = require('./lib/db');
const platformRouter = require('./routes/platform');
const apiKeyService = require('./services/apiKeyService');
const usageService = require('./services/usageService');
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
    throw new Error('Google OAuth belum dikonfigurasi. Isi GOOGLE_CLIENT_ID dan AUTH_SECRET di environment variables.');
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
    return res.status(503).send('Layanan akun sementara tidak tersedia. Silakan coba lagi.');
  }
}
function createOAuthClient() {
  requireAuthConfig();
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET || undefined, GOOGLE_CALLBACK_URL);
}
function randomState() { return crypto.randomBytes(32).toString('base64url'); }
function safeEqual(a,b){const x=Buffer.from(String(a||''));const y=Buffer.from(String(b||''));return x.length===y.length&&x.length>0&&crypto.timingSafeEqual(x,y);}


app.set('trust proxy', 1);
app.set("json spaces", 2);
app.use((req,res,next)=>{res.set('X-Content-Type-Options','nosniff');res.set('Referrer-Policy','strict-origin-when-cross-origin');res.set('X-Frame-Options','DENY');next();});
app.use(express.json({limit:'100kb'}));
app.use(express.urlencoded({ extended: false, limit:'100kb' }));
const allowedOrigins = new Set([`https://${process.env.VERCEL_URL || 'apiz2z.vercel.app'}`, 'https://apiz2z.vercel.app', ...(process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean)]);
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
    message: "Terlalu banyak permintaan dari IP Anda, silakan coba lagi nanti."
  },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false }
});
app.use(limiter);
const authLimiter=rateLimit({windowMs:15*60*1000,max:Number(process.env.AUTH_RATE_LIMIT_PER_15MIN)||20,standardHeaders:true,legacyHeaders:false,message:{success:false,error:'AUTH_RATE_LIMIT',message:'Terlalu banyak percobaan autentikasi. Coba lagi nanti.'}});
app.use(['/auth/google','/auth/google/callback','/auth/google/credential'],authLimiter);

// Shared stylesheet for the account pages (explicit route so the Vercel bundle includes it).
app.get('/assets/scene3d.js', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.type('application/javascript').sendFile(path.join(__dirname, 'views', 'scene3d.js'));
});
app.get('/assets/theme.css', (req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(__dirname, 'views', 'theme.css'));
});
app.use('/views', express.static(path.join(__dirname, 'views')));
app.locals.getSession = currentUser;
app.use(platformRouter);

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

global.apikey = []; // New API access is user-owned Bearer/x-api-key only.

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

app.get('/api/set', (req, res) => {
  const publicSettings = { ...settings };
  delete publicSettings.apiKeys;
  res.json(publicSettings);
});

app.get('/api/logo-proxy', async (req, res) => {
  try {
    const logoUrl = settings.logoIconUrl || settings.favicon || "https://img2.pixhost.to/images/9050/745481347_yannganteng-1783009788991.jpg";
    const response = await axios({
      method: 'get',
      url: logoUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://clutch-api.run.app/'
      },
      responseType: 'arraybuffer'
    });
    
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(response.data);
  } catch (err) {
    return res.redirect("https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=128&h=128&fit=crop");
  }
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

async function resolveIdentity(req) {
  const header = String(req.get('authorization') || '');
  const presented = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() || String(req.get('x-api-key') || '').trim();
  if (presented) {
    const key = await apiKeyService.findKey(presented);
    if (!key) return { error: [401, 'INVALID_API_KEY', 'API key tidak valid.'] };
    if (key.key_status !== 'active') return { error: [401, 'API_KEY_REVOKED', 'API key ini sudah dicabut.'] };
    if (key.user_status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun tidak aktif.'] };
    return { identity: { userId: key.uid, keyId: key.key_id, tier: key.tier } };
  }
  const session = currentUser(req);
  if (!session) return { error: [401, 'AUTH_REQUIRED', 'Login atau kirim API key lewat header Authorization: Bearer <key>.'] };
  if (!sessionRequestAllowed(req)) return { error: [403, 'CSRF_BLOCKED', 'Akses dengan sesi login hanya dari halaman Yannz API. Gunakan API key untuk integrasi.'] };
  const user = await userService.getUserForSession(session);
  if (!user) return { error: [401, 'AUTH_REQUIRED', 'Sesi tidak valid. Silakan login lagi.'] };
  if (user.status !== 'active') return { error: [403, 'ACCOUNT_RESTRICTED', 'Akun tidak aktif.'] };
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

      endpoint = (await query('SELECT id,status,locked,minimum_tier FROM endpoints WHERE path=$1 LIMIT 1', [cleanPath]))[0];
      if (!endpoint) return gatewayFail(res, 503, 'ENDPOINT_REGISTRY_NOT_READY', 'Registry endpoint belum tersedia.');
      if (endpoint.status !== 'active') return gatewayFail(res, 404, 'ENDPOINT_UNAVAILABLE', 'Endpoint sedang dinonaktifkan.');
      if (endpoint.locked && !owner) return gatewayFail(res, 403, 'ENDPOINT_LOCKED', 'Endpoint ini sedang dikunci oleh owner.');
      if (!owner && !canAccess(identity.tier, endpoint.minimum_tier, false)) {
        return gatewayFail(res, 403, 'TIER_RESTRICTED', `Endpoint ini membutuhkan tier ${endpoint.minimum_tier} atau lebih tinggi.`, { requiredTier: endpoint.minimum_tier, currentTier: identity.tier });
      }
      const maintenance = (await query('SELECT maintenance_enabled,maintenance_message FROM server_settings WHERE id=1'))[0];
      if (maintenance?.maintenance_enabled && !owner) return gatewayFail(res, 503, 'MAINTENANCE', maintenance.maintenance_message);

      quota = await usageService.consume({ userId: identity.userId, keyId: identity.keyId, endpointId: endpoint.id, tier: identity.tier });
      res.set('X-RateLimit-Limit', quota.limit == null ? 'unlimited' : String(quota.limit));
      res.set('X-RateLimit-Remaining', quota.remaining == null ? 'unlimited' : String(quota.remaining));
      res.set('X-RateLimit-Reset', quota.resetAt);
      if (!quota.allowed) {
        res.set('Retry-After', String(Math.max(1, Math.ceil((Date.parse(quota.resetAt) - Date.now()) / 1000))));
        return gatewayFail(res, 429, 'QUOTA_EXCEEDED', 'Batas request harian kamu sudah habis.', { used: quota.used, limit: quota.limit, remaining: 0, resetAt: quota.resetAt });
      }
      if (identity.keyId) await query('UPDATE api_keys SET last_used_at=now() WHERE id=$1', [identity.keyId]);
    } catch (error) {
      const c = classifyDatabaseError(error);
      console.error('API gateway error:', { error: c.error, code: c.code });
      return gatewayFail(res, 503, 'GATEWAY_UNAVAILABLE', 'API gateway sementara tidak tersedia.');
    }

    // Refund before the response is flushed: serverless runtimes may freeze after it ends.
    let settled = false;
    const end = res.end;
    res.end = function (...args) {
      if (settled || res.statusCode < 400) { settled = true; return end.apply(this, args); }
      settled = true;
      usageService.refund({ userId: identity.userId, endpointId: endpoint.id, usageDate: quota.usageDate })
        .catch(e => console.error('Quota refund failed:', { code: e?.code || null }))
        .finally(() => end.apply(this, args));
      return this;
    };
    req.apiAuth = { userId: identity.userId, keyId: identity.keyId, tier: identity.tier, quota };
    try {
      await run(req, res);
    } catch (error) {
      console.error('Plugin handler failed:', { path: cleanPath, name: error?.name || null, code: error?.code || null });
      if (!res.headersSent) return gatewayFail(res, 502, 'UPSTREAM_FAILED', 'Layanan sumber sedang bermasalah. Kuota tidak dipotong.');
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
        const { name, desc, category, path: routePath, run } = route;

        if (name && desc && category && routePath && typeof run === 'function') {
          const cleanPath = routePath.split('?')[0];
          app.get(cleanPath, apiGateway(cleanPath, run));
          loadedPluginPaths.add(cleanPath);
          registrySyncTasks.push(query(`INSERT INTO endpoints(name,path,description,method,minimum_tier,locked,status,plugin) VALUES($1,$2,$3,$4,$5,false,'active',$6) ON CONFLICT(path) DO NOTHING`, [name,cleanPath,desc,'GET','FREE',file.replace(/\.js$/,'')]).catch(e=>{console.error('Endpoint registry sync failed:',e.code||'DATABASE_ERROR');return null;}));

          if (!rawEndpoints[category]) rawEndpoints[category] = [];
          rawEndpoints[category].push({ 
            name, 
            desc, 
            path: routePath,
            cleanPath: cleanPath
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
  try { const [rows,registry]=await Promise.all([query('SELECT COALESCE(sum(request_count),0)::int AS n FROM api_usage'),query('SELECT path,method,status,locked,minimum_tier,description FROM endpoints')]); const meta=Object.fromEntries(registry.map(x=>[x.path,x])); const catalog=Object.fromEntries(Object.entries(sortedEndpoints).map(([category,items])=>[category,items.map(item=>({...item,access:meta[item.cleanPath]||null}))])); return res.json({total:totalRoutes,totalRequests:rows[0].n,endpoints:catalog}); }
  catch { return res.status(503).json({success:false,error:'ENDPOINTS_UNAVAILABLE',message:'Katalog sementara tidak tersedia.'}); }
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
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ configured: false });
  res.json({ configured: true, clientId: GOOGLE_CLIENT_ID });
});

function issueSession(res, sub, account) {
  const session = {
    sub,
    userId: account.id,
    email: account.email,
    name: account.name,
    picture: account.picture,
    provider: 'google',
    sv: account.sessionVersion || 0,
    iat: Date.now(),
    exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
  };
  setCookie(res, 'yannz_session', encryptSession(session), 7 * 24 * 60 * 60);
}

// Each stage reports its own stable error code so a production failure can be traced
// from the response body or the Vercel log line without logging tokens or secrets.
app.post('/auth/google/credential', async (req, res) => {
  const fail = (status, error, message, log) => {
    if (log) console.error('Google credential/login failed:', log);
    return res.status(status).json({ success: false, error, message });
  };

  const origin = req.get('origin');
  if (origin && origin !== `${req.protocol}://${req.get('host')}`) {
    return fail(403, 'CSRF_BLOCKED', 'Origin tidak diizinkan.', { stage: 'origin' });
  }

  const missing = missingAuthConfig();
  if (missing.length) {
    return fail(503, 'AUTH_NOT_CONFIGURED', 'Google login belum dikonfigurasi di server.', { stage: 'config', missing });
  }

  const credential = typeof req.body?.credential === 'string' ? req.body.credential : '';
  if (!credential) return fail(400, 'MISSING_CREDENTIAL', 'Google credential tidak ditemukan.');

  let profile;
  try {
    const verifier = new google.auth.OAuth2();
    const ticket = await verifier.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID });
    profile = ticket.getPayload();
  } catch (err) {
    const c = classifyGoogleVerifyError(err);
    const message = c.status === 503
      ? 'Server tidak dapat menghubungi Google untuk verifikasi. Silakan coba lagi.'
      : 'Google login gagal. Credential tidak valid atau sudah kedaluwarsa.';
    return fail(c.status, c.error, message, { stage: 'verify', reason: c.reason, code: c.code });
  }

  if (!profile?.sub || !profile.email || profile.email_verified !== true) {
    return fail(403, 'EMAIL_NOT_VERIFIED', 'Akun Google harus memiliki email yang terverifikasi.', { stage: 'profile', reason: 'EMAIL_NOT_VERIFIED' });
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
    return fail(c.status, c.error, 'Layanan akun sementara tidak tersedia. Silakan coba lagi.', { stage: 'database', error: c.error, code: c.code });
  }
  if (account.status !== 'active') {
    return fail(403, 'ACCOUNT_RESTRICTED', 'Akun ini tidak aktif. Hubungi owner jika merasa ini keliru.');
  }

  try {
    issueSession(res, profile.sub, account);
  } catch (err) {
    return fail(500, 'SESSION_ERROR', 'Sesi login tidak dapat dibuat.', { stage: 'session', code: err?.code || null });
  }
  await auditService.writeAudit({ actorUserId: account.id, action: 'login', targetType: 'session', ipAddress: (req.ip || '').replace(/^::ffff:/, '') || null }).catch(() => {});
  return res.json({ success: true, redirect: '/home' });
});

app.get('/auth/google', (req, res) => {
  try {
    const state = randomState();
    const client = createOAuthClient();
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
    res.status(500).send('Google OAuth belum dikonfigurasi di server.');
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const cookies = parseCookies(req);
    clearCookie(res, 'oauth_state');

    if (error) return res.redirect('/?oauth=denied');
    if (!code || !state || !cookies.oauth_state || !safeEqual(state,cookies.oauth_state)) {
      return res.status(400).send('OAuth state tidak valid. Silakan coba login lagi.');
    }

    const client = createOAuthClient();

    const { tokens } = await client.getToken(String(code));
    if (!tokens?.access_token) {
      throw new Error('Google tidak mengembalikan access_token.');
    }
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ auth: client, version: 'v2' });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.email || profile.verified_email !== true) {
      return res.status(403).send('Akun Google harus memiliki email yang terverifikasi.');
    }

    const account = await userService.upsertGoogleUser({
      googleId: profile.id,
      email: profile.email,
      name: profile.name,
      picture: profile.picture
    });
    if (account.status !== 'active') {
      return res.redirect('/?auth=restricted');
    }
    issueSession(res, profile.id, account);
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
      return res.status(403).json({ authenticated: false, error: 'Akun ini sedang dibatasi.' });
    }
    const used = await usageService.usageToday(user.id);
    const keyRows = await apiKeyService.listKeys(user.id);
    const limits = getTier(user.tier);
    return res.json({ authenticated: true, user: {
      id:user.id, googleId:user.googleId, name:user.name, email:user.email, picture:user.picture,
      provider:session.provider||'google', tier:user.tier, status:user.status, isOwner:user.isOwner
    }, usage:{used,limit:Number.isFinite(limits.limit)?limits.limit:null,remaining:Number.isFinite(limits.limit)?Math.max(0,limits.limit-used):null},
    apiKeys:{used:keyRows.filter(k=>k.status==='active').length,limit:Number.isFinite(limits.keys)?limits.keys:null} });
  } catch (err) {
    console.error('Auth profile database lookup failed:', err.code || 'DATABASE_ERROR');
    return res.status(503).json({ authenticated: false, error: 'Profil sementara tidak dapat dimuat.' });
  }
});

app.post('/auth/logout', async (req, res) => {
  const session=currentUser(req);
  const origin=req.get('origin');if(origin&&origin!==`${req.protocol}://${req.get('host')}`)return res.status(403).json({success:false,error:'CSRF_BLOCKED',message:'Origin tidak diizinkan.'});
  clearCookie(res, 'yannz_session');
  if (session?.userId) {
    // Invalidate every cookie issued to this account so a copied cookie stops working too.
    try { await userService.revokeSessions(session.userId); }
    catch (err) { console.error('Session revocation failed:', { code: err?.code || null }); return res.status(503).json({ success: false, error: 'DATABASE_UNAVAILABLE', message: 'Logout belum tersimpan di server. Coba lagi.' }); }
    await auditService.writeAudit({actorUserId:session.userId,action:'logout',targetType:'session'}).catch(()=>{});
  }
  res.json({ success: true });
});

app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  } catch (err) {
    res.status(500).send('Gagal memuat halaman utama.');
  }
});

app.get('/home', authRequired, (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } catch (err) {
    res.status(500).send('Gagal memuat dashboard.');
  }
});

app.get('/api/playground', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'playground.html'));
  } catch (err) {
    res.status(500).send('Gagal memuat playground.');
  }
});

app.get('/api', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'api.html'));
  } catch (err) {
    res.status(500).send('Gagal memuat dokumentasi API.');
  }
});

app.get('/api/stats', async (req, res) => {
  try { const session=currentUser(req); const account=session?await userService.getUserForSession(session):null; const today=account?await usageService.usageToday(account.id):0; const keys=account?await apiKeyService.listKeys(account.id):[]; const tier=account?.tier||'FREE'; const limit=getTier(tier).limit; const totals=await query("SELECT COALESCE(sum(request_count),0)::int AS n FROM api_usage WHERE usage_date=(now() AT TIME ZONE 'UTC')::date");
    const payload={status:true,totalRequests:totals[0].n,totalEndpoints:totalRoutes,userRequestsToday:today,remaining:Number.isFinite(limit)?Math.max(0,limit-today):null,tier,apiKeyCount:keys.filter(k=>k.status==='active').length,uptime:process.uptime()};
    if(account?.isOwner){const e=await query("SELECT count(*)::int AS n FROM endpoints WHERE status='active'");payload.endpointCount=e[0].n;}return res.json(payload);
  } catch { return res.status(503).json({success:false,error:'STATS_UNAVAILABLE',message:'Statistik sementara tidak tersedia.'}); }
});

app.use((err,req,res,next)=>{
  if(res.headersSent)return next(err);
  if(err?.type==='entity.parse.failed')return res.status(400).json({success:false,error:'INVALID_JSON',message:'Body request bukan JSON yang valid.'});
  if(err?.status===413)return res.status(413).json({success:false,error:'PAYLOAD_TOO_LARGE',message:'Ukuran request terlalu besar.'});
  console.error('Request failed:',{ name: err?.name || null, code: err?.code || 'REQUEST_ERROR' });
  return res.status(500).json({success:false,error:'INTERNAL_ERROR',message:'Terjadi kesalahan server.'});
});

// Vercel imports the exported app; only `node index.js` (npm start) opens a port.
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(chalk.bgHex('#ffb86c').black(` 🚀 SERVER IS RUNNING ON PORT ${PORT} `));
    console.log(chalk.bgHex('#50fa7b').black(` 📦 TOTAL ROUTES LOADED: ${totalRoutes} `));
  });
}

module.exports = app;
