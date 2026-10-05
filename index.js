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
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV !== 'production') return callback(null, true); return callback(new Error('Origin tidak diizinkan.')); }, credentials: true }));

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 150,
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
const authLimiter=rateLimit({windowMs:15*60*1000,max:20,standardHeaders:true,legacyHeaders:false,message:{success:false,error:'AUTH_RATE_LIMIT',message:'Terlalu banyak percobaan autentikasi. Coba lagi nanti.'}});
app.use(['/auth/google','/auth/google/callback','/auth/google/credential'],authLimiter);

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
          app.get(cleanPath, async (req, res) => {
            try {
              await registryReady;
              const header = String(req.get('authorization') || '');
              const bearer = /^Bearer\s+(.+)$/i.exec(header)?.[1] || req.get('x-api-key') || '';
              let identity = bearer ? await apiKeyService.findKey(bearer) : null;
              if (bearer && (!identity || identity.key_status !== 'active')) return res.status(401).json({ success:false,error:'INVALID_API_KEY',message:'API key tidak valid atau telah dicabut.' });
              if (!identity) {
                const session = currentUser(req);
                if (session?.userId) {
                  const freeUser = await userService.getUserById(session.userId);
                  if (freeUser && freeUser.status === 'active') {
                    identity = { uid:freeUser.id, key_id:null, key_status:'session', user_status:freeUser.status, tier:freeUser.isOwner?'OWNER':freeUser.tier };
                  }
                }
              }
              if (!identity) return res.status(401).json({ success:false,error:'INVALID_API_KEY',message:'API key tidak valid atau silakan login untuk endpoint FREE.' });
              if (identity.user_status !== 'active') return res.status(403).json({ success:false,error:'ACCOUNT_RESTRICTED',message:'Akun tidak aktif.' });
              const endpointRows = await query('SELECT * FROM endpoints WHERE path=$1 LIMIT 1', [cleanPath]);
              const endpoint = endpointRows[0];
              if (!endpoint) return res.status(503).json({success:false,error:'ENDPOINT_REGISTRY_NOT_READY',message:'Registry endpoint belum tersedia.'});
              if (endpoint.status !== 'active') return res.status(404).json({ success:false,error:'ENDPOINT_UNAVAILABLE',message:'Endpoint tidak tersedia.' });
              if (!identity.key_id && identity.tier !== 'OWNER' && (endpoint.minimum_tier !== 'FREE' || endpoint.locked)) return res.status(403).json({ success:false,error:'API_KEY_REQUIRED',message:'Endpoint ini membutuhkan API key dan tier berbayar.' });
              if (identity.tier !== 'OWNER' && endpoint.locked) return res.status(403).json({ success:false,error:'ENDPOINT_LOCKED',message:'Endpoint ini sedang dikunci oleh owner.' });
              if (identity.tier !== 'OWNER' && !canAccess(identity.tier, endpoint.minimum_tier, endpoint.locked)) return res.status(403).json({ success:false,error:'TIER_REQUIRED',message:`Endpoint ini membutuhkan tier ${endpoint.minimum_tier} atau lebih tinggi.` });
              const maintenance = await query('SELECT maintenance_enabled,maintenance_message FROM server_settings WHERE id=1');
              if (maintenance[0]?.maintenance_enabled && identity.tier !== 'OWNER') return res.status(503).json({success:false,error:'MAINTENANCE',message:maintenance[0].maintenance_message});
              const quota = await usageService.consume({userId:identity.uid,keyId:identity.key_id,endpointId:endpoint.id,tier:identity.tier});
              if (!quota.allowed) return res.status(429).json({success:false,error:'DAILY_LIMIT_REACHED',message:'Batas request harian kamu sudah habis.',...quota});
              if (identity.key_id) await query('UPDATE api_keys SET last_used_at=now() WHERE id=$1',[identity.key_id]);
              req.apiAuth = {userId:identity.uid,keyId:identity.key_id,tier:identity.tier,quota};
              res.set('X-RateLimit-Limit', quota.limit == null ? 'unlimited' : String(quota.limit));
              res.set('X-RateLimit-Remaining', quota.remaining == null ? 'unlimited' : String(quota.remaining));
              if (quota.resetAt) res.set('X-RateLimit-Reset', quota.resetAt);
              return run(req, res);
            } catch (error) { console.error('API gateway error:', error.code || 'GATEWAY_ERROR'); return res.status(503).json({success:false,error:'GATEWAY_UNAVAILABLE',message:'API gateway sementara tidak tersedia.'}); }
          });
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
  if(session?.userId) await require('./services/auditService').writeAudit({actorUserId:session.userId,action:'logout',targetType:'session'}).catch(()=>{});
  clearCookie(res, 'yannz_session'); res.json({ success: true });
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

app.use((err,req,res,next)=>{ console.error('Request failed:',err?.code||'REQUEST_ERROR'); if(res.headersSent)return next(err); return res.status(err?.status===413?413:500).json({success:false,error:err?.status===413?'PAYLOAD_TOO_LARGE':'INTERNAL_ERROR',message:err?.status===413?'Ukuran request terlalu besar.':'Terjadi kesalahan server.'}); });

app.listen(PORT, "0.0.0.0", () => {
  console.log(chalk.bgHex('#ffb86c').black(` 🚀 SERVER IS RUNNING ON PORT ${PORT} `));
  console.log(chalk.bgHex('#50fa7b').black(` 📦 TOTAL ROUTES LOADED: ${totalRoutes} `));
});

module.exports = app;
