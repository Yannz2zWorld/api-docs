const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { google } = require('googleapis');
require('dotenv').config();

const settings = require('./settings');

const app = express();
const PORT = process.env.PORT || 3000;

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'https://apiz2z.vercel.app/auth/google/callback';
const AUTH_SECRET = process.env.AUTH_SECRET || '';

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
    return [part.slice(0, i).trim(), decodeURIComponent(part.slice(i + 1))];
  }));
}
function currentUser(req) {
  return decryptSession(parseCookies(req).yannz_session);
}
function authRequired(req, res, next) {
  if (!currentUser(req)) return res.redirect('/');
  next();
}
function createOAuthClient() {
  requireAuthConfig();
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET || undefined, GOOGLE_CALLBACK_URL);
}
function randomState() {
  return crypto.randomBytes(32).toString('base64url');
}


app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());

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

app.use('/views', express.static(path.join(__dirname, 'views')));

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

global.apikey = settings.apiKeys || [];
global.totalreq = 0;

app.use((req, res, next) => {
  global.totalreq += 1;

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
          app.get(cleanPath, run);

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

const sortedEndpoints = Object.keys(rawEndpoints)
  .sort((a, b) => a.localeCompare(b))
  .reduce((sorted, category) => {
    sorted[category] = rawEndpoints[category].sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, {});

app.get('/api/endpoints', (req, res) => {
  res.json({
    total: totalRoutes,
    totalRequests: global.totalreq,
    endpoints: sortedEndpoints
  });
});


app.get('/auth/config', (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ configured: false });
  res.json({ configured: true, clientId: GOOGLE_CLIENT_ID });
});

app.post('/auth/google/credential', async (req, res) => {
  try {
    requireAuthConfig();
    const credential = String(req.body?.credential || '');
    if (!credential) return res.status(400).json({ error: 'Google credential tidak ditemukan.' });

    const verifier = new google.auth.OAuth2();
    const ticket = await verifier.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID
    });
    const profile = ticket.getPayload();

    if (!profile?.sub || !profile.email || profile.email_verified !== true) {
      return res.status(403).json({ error: 'Akun Google harus memiliki email yang terverifikasi.' });
    }

    const session = {
      sub: profile.sub,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture || '',
      provider: 'google',
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };

    setCookie(res, 'yannz_session', encryptSession(session), 7 * 24 * 60 * 60);
    return res.json({ success: true });
  } catch (err) {
    console.error('Google credential verification error:', err.response?.data || err.message);
    return res.status(401).json({ error: 'Google login gagal. Credential tidak valid atau sudah kedaluwarsa.' });
  }
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
    console.error('Google OAuth init error:', err.message);
    res.status(500).send('Google OAuth belum dikonfigurasi di server.');
  }
});

app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    const cookies = parseCookies(req);
    clearCookie(res, 'oauth_state');

    if (error) return res.redirect('/?oauth=denied');
    if (!code || !state || !cookies.oauth_state || state !== cookies.oauth_state) {
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

    const session = {
      sub: profile.id,
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      picture: profile.picture || '',
      provider: 'google',
      iat: Date.now(),
      exp: Date.now() + (7 * 24 * 60 * 60 * 1000)
    };

    setCookie(res, 'yannz_session', encryptSession(session), 7 * 24 * 60 * 60);
    res.redirect('/home');
  } catch (err) {
    console.error('Google OAuth callback error:', err.response?.data || err.message);
    res.redirect('/?oauth=error');
  }
});

app.get('/auth/me', (req, res) => {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ authenticated: false });
  res.json({
    authenticated: true,
    user: {
      id: user.sub,
      name: user.name,
      email: user.email,
      picture: user.picture,
      provider: user.provider
    }
  });
});

app.post('/auth/logout', (req, res) => {
  clearCookie(res, 'yannz_session');
  res.json({ success: true });
});

app.get('/', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
  } catch (err) {
    res.status(500).send("Gagal memuat halaman utama: " + err.message);
  }
});

app.get('/home', authRequired, (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
  } catch (err) {
    res.status(500).send("Gagal memuat dashboard: " + err.message);
  }
});

app.get('/api/playground', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'playground.html'));
  } catch (err) {
    res.status(500).send("Gagal memuat halaman playground: " + err.message);
  }
});

app.get('/api', (req, res) => {
  try {
    res.sendFile(path.join(__dirname, 'views', 'api.html'));
  } catch (err) {
    res.status(500).send("Gagal memuat halaman API docs: " + err.message);
  }
});

app.get('/api/stats', (req, res) => {
  res.json({
    status: true,
    totalRequests: global.totalreq,
    totalEndpoints: totalRoutes,
    activeKeys: global.apikey.length,
    uptime: process.uptime()
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(chalk.bgHex('#ffb86c').black(` 🚀 SERVER IS RUNNING ON PORT ${PORT} `));
  console.log(chalk.bgHex('#50fa7b').black(` 📦 TOTAL ROUTES LOADED: ${totalRoutes} `));
});

module.exports = app;
