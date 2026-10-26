'use strict';
// Konfigurasi web database (backend + dashboard). Berdiri sendiri (tidak membaca file bot):
// nilai dari environment / .env dengan default aman. Secret HANYA dari environment.
// Di production, secret yang wajib harus ada atau server tidak mau start.

const { loadDotEnv } = require('./lib/env');

const intOf = (v, d, lo, hi) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const boolOf = (v, d) => (v === undefined || v === '' ? d : /^(1|true|yes|on)$/i.test(String(v)));

function buildServerConfig(env = process.env) {
  if (env === process.env) loadDotEnv();
  const settings = {
    host: env.DASHBOARD_HOST || '127.0.0.1',
    port: intOf(env.DASHBOARD_PORT, 8787, 1, 65535),
    trustProxy: boolOf(env.DASHBOARD_TRUST_PROXY, false),
    botSessionDays: intOf(env.BOT_SESSION_DAYS, 30, 1, 365),
    adminSessionHours: intOf(env.ADMIN_SESSION_HOURS, 12, 1, 168),
    bcryptCost: intOf(env.BCRYPT_COST, 12, 10, 15)
  };
  const production = env.NODE_ENV === 'production';
  const publicUrl = (env.DASHBOARD_PUBLIC_URL || `http://${settings.host}:${settings.port}`).replace(/\/+$/, '');
  const cfg = {
    production,
    host: settings.host,
    port: settings.port,
    publicUrl,
    origin: new URL(publicUrl).origin,
    secureCookies: publicUrl.startsWith('https://'),
    trustProxy: settings.trustProxy,
    databaseUrl: env.DATABASE_URL || '',
    databaseSchema: env.DATABASE_SCHEMA || null,
    sessionSecret: env.SESSION_SECRET || '',
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
  return cfg;
}

module.exports = { buildServerConfig };
