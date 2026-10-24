'use strict';
// Konfigurasi backend/dashboard. Nilai non-rahasia dari settingsbot.js (dashboard.*),
// secret HANYA dari environment. Di production, secret yang wajib harus ada atau server tidak mau start.

const { loadDotEnv } = require('../library/config-loader');

function buildServerConfig(env = process.env) {
  loadDotEnv();
  const settings = require('../settingsbot.js').dashboard;
  const production = env.NODE_ENV === 'production';
  const publicUrl = (env.DASHBOARD_PUBLIC_URL || `http://${settings.host}:${settings.port}`).replace(/\/+$/, '');
  const cfg = {
    production,
    host: settings.host,
    port: Number(env.DASHBOARD_PORT || settings.port),
    publicUrl,
    origin: new URL(publicUrl).origin,
    secureCookies: publicUrl.startsWith('https://'),
    trustProxy: settings.trustProxy,
    databaseUrl: env.DATABASE_URL || '',
    databaseSchema: env.DATABASE_SCHEMA || null,
    sessionSecret: env.SESSION_SECRET || '',
    google: {
      clientId: env.GOOGLE_CLIENT_ID || '',
      clientSecret: env.GOOGLE_CLIENT_SECRET || '',
      callbackUrl: env.GOOGLE_CALLBACK_URL || `${publicUrl}/auth/google/callback`
    },
    adminSessionHours: settings.adminSessionHours,
    botSessionDays: settings.botSessionDays,
    bcryptCost: settings.bcryptCost,
    backupKey: env.BACKUP_ENCRYPTION_KEY || ''
  };
  const problems = [];
  if (!cfg.databaseUrl) problems.push('DATABASE_URL wajib diisi');
  if (cfg.sessionSecret.length < 32) {
    if (production) problems.push('SESSION_SECRET minimal 32 karakter acak');
    else cfg.sessionSecret = cfg.sessionSecret || require('crypto').randomBytes(32).toString('hex');   // dev: acak per proses
  }
  if (production && !cfg.secureCookies) problems.push('DASHBOARD_PUBLIC_URL wajib https di production');
  if (cfg.databaseSchema && !/^[a-z_][a-z0-9_]{0,62}$/.test(cfg.databaseSchema)) problems.push('DATABASE_SCHEMA tidak valid');
  if (problems.length) {
    const e = new Error('Konfigurasi server tidak valid:\n - ' + problems.join('\n - '));
    e.code = 'SERVER_CONFIG_INVALID';
    throw e;
  }
  cfg.googleEnabled = Boolean(cfg.google.clientId && cfg.google.clientSecret);
  return cfg;
}

module.exports = { buildServerConfig };
