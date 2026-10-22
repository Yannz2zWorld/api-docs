'use strict';
// Memuat .env (kalau ada), lalu settingsbot.js, lalu memvalidasi isinya.
// Error validasi tidak pernah mencetak nilai secret — hanya nama field-nya.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SECRET_KEY = /(key|token|secret|password|passwd|pass|otp|pairing|credential|cookie|session)/i;

class ConfigError extends Error {
  constructor(problems) {
    super('Konfigurasi tidak valid:\n - ' + problems.join('\n - '));
    this.name = 'ConfigError';
    this.problems = problems;
  }
}

// Parser .env sederhana: KEY=VALUE, komentar #, nilai boleh pakai kutip. Tidak menimpa env yang sudah ada.
function loadDotEnv(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return 0;
  let n = 0;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[2];
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '');
    if (process.env[m[1]] === undefined) { process.env[m[1]] = value; n++; }
  }
  return n;
}

const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const isHttpUrl = v => { try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:'; } catch { return false; } };
const isLocalUrl = v => { try { const h = new URL(v).hostname; return h === 'localhost' || h === '127.0.0.1' || h === '::1'; } catch { return false; } };

function validate(cfg) {
  const p = [];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  need(isObj(cfg), 'settingsbot.js harus mengekspor object');
  if (!isObj(cfg)) throw new ConfigError(p);

  need(isObj(cfg.bot) && typeof cfg.bot.name === 'string' && cfg.bot.name.trim(), 'bot.name wajib diisi');
  need(cfg.bot?.projectName === 'YannAjahNew', "bot.projectName harus 'YannAjahNew'");
  need(/^\d{8,15}$/.test(String(cfg.owner?.number || '')), 'owner.number harus nomor 8-15 digit tanpa + / spasi (contoh 6281234567890)');
  need(Array.isArray(cfg.owner?.extra) && cfg.owner.extra.every(n => /^\d{8,15}$/.test(n)), 'owner.extra harus daftar nomor 8-15 digit');
  need(Array.isArray(cfg.prefix?.list) && cfg.prefix.list.length > 0 && cfg.prefix.list.every(x => typeof x === 'string' && x.length >= 1 && x.length <= 3), 'prefix.list harus berisi 1-3 karakter per prefix');
  need(['error', 'warn', 'info', 'debug'].includes(cfg.logger?.level), 'logger.level harus error|warn|info|debug');
  need(['ask', 'qr', 'pairing'].includes(cfg.pairing?.method), "pairing.method harus 'ask' | 'qr' | 'pairing'");
  const code = cfg.pairing?.customCode;
  need(!code || /^[A-Z0-9]{8}$/.test(code), 'pairing.customCode harus tepat 8 karakter huruf besar/angka (atau kosong)');
  need(!cfg.pairing?.phoneNumber || /^\d{8,15}$/.test(cfg.pairing.phoneNumber), 'pairing.phoneNumber harus nomor 8-15 digit');
  need(typeof cfg.pairing?.sessionDir === 'string' && cfg.pairing.sessionDir && !cfg.pairing.sessionDir.includes('..'), 'pairing.sessionDir tidak valid');

  const lic = cfg.license || {};
  need(isHttpUrl(lic.serverUrl), 'license.serverUrl harus URL http(s) yang valid (env LICENSE_SERVER_URL)');
  if (isHttpUrl(lic.serverUrl)) need(lic.serverUrl.startsWith('https://') || isLocalUrl(lic.serverUrl), 'license.serverUrl wajib HTTPS (http hanya boleh untuk localhost)');
  need(/^[a-zA-Z0-9._-]{3,48}$/.test(String(lic.instanceName || '')), 'license.instanceName 3-48 karakter (huruf, angka, . _ -)');
  need(Number.isInteger(lic.heartbeatMinutes) && lic.heartbeatMinutes >= 1 && lic.heartbeatMinutes <= 1440, 'license.heartbeatMinutes 1-1440');
  need(Number.isInteger(lic.offlineGraceMinutes) && lic.offlineGraceMinutes >= 0 && lic.offlineGraceMinutes <= 1440, 'license.offlineGraceMinutes 0-1440');

  need(/^[a-zA-Z0-9._-]+\.json$/.test(String(cfg.database?.file || '')), 'database.file harus nama file .json (V15: tempatDB)');

  const a = cfg.api?.apiz2z || {};
  need(isHttpUrl(a.baseUrl) && (String(a.baseUrl).startsWith('https://') || isLocalUrl(a.baseUrl)), 'api.apiz2z.baseUrl harus URL HTTPS (env APIZ2Z_BASE_URL)');
  need(typeof a.apiKey === 'string', 'api.apiz2z.apiKey harus string (isi lewat env APIZ2Z_API_KEY)');
  for (const k of ['timeoutMs', 'retries', 'perMinute', 'concurrency', 'maxResponseBytes', 'cacheTtlMs']) need(Number.isInteger(a[k]) && a[k] >= 0, `api.apiz2z.${k} harus bilangan bulat >= 0`);
  need(a.retries <= 5, 'api.apiz2z.retries maksimal 5');
  need(a.concurrency >= 1 && a.perMinute >= 1, 'api.apiz2z.concurrency dan perMinute minimal 1');

  need(Number.isInteger(cfg.limit?.daily) && cfg.limit.daily >= 0, 'limit.daily harus bilangan bulat >= 0');
  need(isObj(cfg.mess) && ['owner', 'admin', 'group', 'wait', 'error'].every(k => typeof cfg.mess[k] === 'string'), 'mess.* (owner/admin/group/wait/error) wajib ada');
  need(Number.isInteger(cfg.dashboard?.port) && cfg.dashboard.port > 0 && cfg.dashboard.port < 65536, 'dashboard.port tidak valid');
  need(Number.isInteger(cfg.dashboard?.bcryptCost) && cfg.dashboard.bcryptCost >= 10 && cfg.dashboard.bcryptCost <= 15, 'dashboard.bcryptCost 10-15');

  if (p.length) throw new ConfigError(p);
  return cfg;
}

// Salinan config yang aman untuk dicetak / ditampilkan (nilai secret diganti).
function redact(value, key = '') {
  if (Array.isArray(value)) return value.map(v => redact(v, key));
  if (isObj(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v, k)]));
  if (typeof value === 'string' && SECRET_KEY.test(key) && !/file|dir|method|max|code$/i.test(key)) return value ? '***' : '';
  if (typeof value === 'string' && key === 'customCode') return value ? '********' : '';
  return value;
}

let cached = null;
function loadConfig({ reload = false, envFile } = {}) {
  if (cached && !reload) return cached;
  loadDotEnv(envFile);
  const file = require.resolve(path.join(ROOT, 'settingsbot.js'));
  if (reload) delete require.cache[file];
  cached = validate(require(file));
  return cached;
}

module.exports = { loadConfig, validate, redact, loadDotEnv, ConfigError, ROOT, SECRET_KEY };
