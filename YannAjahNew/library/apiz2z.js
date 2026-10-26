'use strict';
// API manager APIZ2Z (yannajah.api).
// - Hanya memanggil endpoint yang ADA di katalog terverifikasi (library/catalog/apiz2z-endpoints.json).
// - Hanya ke host yang diizinkan (anti-SSRF). Key lewat header Authorization: Bearer, tidak lewat URL.
// - Timeout, retry terbatas (network/5xx/429), rate limit per menit, concurrency, batas ukuran,
//   cache GET JSON, dan parsing sesuai Content-Type sebenarnya (JSON / image / video / audio / teks).

const path = require('path');
const { request } = require('./net');
const { err } = require('./errors');
const { TTLCache, Semaphore, RateLimiter, sleep, sniffMime } = require('./function');

const CATALOG_FILE = path.join(__dirname, 'catalog', 'apiz2z-endpoints.json');

function loadCatalog(file = CATALOG_FILE) {
  const raw = require(file);
  const map = new Map();
  for (const e of raw.endpoints) map.set(e.path, e);
  return { meta: { source: raw.source, generatedAt: raw.generatedAt, count: raw.count }, map };
}

// Pesan ramah untuk kode error dari gateway APIZ2Z (lihat index.js platform: gatewayFail()).
const GATEWAY_MESSAGES = {
  AUTH_REQUIRED: 'API key APIZ2Z belum diisi.',
  INVALID_API_KEY: 'API key APIZ2Z tidak valid.',
  API_KEY_DISABLED: 'API key APIZ2Z sedang dinonaktifkan.',
  API_KEY_REVOKED: 'API key APIZ2Z sudah dicabut.',
  API_KEY_EXPIRED: 'Masa aktif API key APIZ2Z habis.',
  ACCOUNT_RESTRICTED: 'Akun APIZ2Z sedang tidak aktif.',
  TIER_RESTRICTED: 'Endpoint ini butuh tier APIZ2Z lebih tinggi.',
  QUOTA_EXCEEDED: 'Kuota harian APIZ2Z habis.',
  ENDPOINT_UNAVAILABLE: 'Endpoint sedang tidak tersedia.',
  ENDPOINT_LOCKED: 'Endpoint sedang dikunci oleh pengelola API.',
  MAINTENANCE: 'APIZ2Z sedang maintenance.',
  TOO_MANY_INVALID_KEYS: 'Terlalu banyak percobaan key salah, coba lagi nanti.'
};

class Apiz2zClient {
  constructor(cfg, { logger, transport = request, catalogFile } = {}) {
    this.cfg = cfg;
    this.logger = logger;
    this.transport = transport;
    this.catalog = loadCatalog(catalogFile);
    const base = new URL(cfg.baseUrl);
    this.base = base.origin;
    this.allowHosts = new Set([base.hostname.toLowerCase(), ...(cfg.allowedHosts || []).map(h => h.toLowerCase())]);
    this.cache = new TTLCache({ ttlMs: cfg.cacheTtlMs, max: 300 });
    this.sem = new Semaphore(cfg.concurrency);
    this.limiter = new RateLimiter({ limit: cfg.perMinute, windowMs: 60000 });
    this.stats = { requests: 0, ok: 0, failed: 0, cached: 0, lastError: null, lastOkAt: null };
  }

  hasKey() { return Boolean(this.cfg.apiKey); }
  getEndpoints({ category, includeExcluded = false } = {}) {
    return [...this.catalog.map.values()].filter(e => (includeExcluded || !e.excluded) && (!category || e.category.toLowerCase() === String(category).toLowerCase()));
  }
  getEndpoint(p) { return this.catalog.map.get(p) || null; }

  // Validasi parameter terhadap katalog. Mengembalikan object query yang bersih.
  validateParams(ep, params = {}, { hasFile = false } = {}) {
    const clean = {};
    for (const p of ep.params) {
      let v = params[p.name];
      if (v === undefined) for (const a of p.aliases || []) if (params[a] !== undefined) { v = params[a]; break; }
      if (v === undefined || v === null || v === '') {
        if (p.file && hasFile) continue;
        if (p.required && p.default === undefined) throw err('PARAM_REQUIRED', `Parameter '${p.name}' wajib diisi`, { userMessage: `Parameter *${p.name}* wajib diisi.` });
        continue;
      }
      v = String(v);
      if (v.length > (p.max || 4000)) throw err('PARAM_TOO_LONG', `Parameter '${p.name}' terlalu panjang`, { userMessage: `Parameter *${p.name}* maksimal ${p.max || 4000} karakter.` });
      if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)) throw err('PARAM_INVALID', `Parameter '${p.name}' berisi karakter kontrol`, { userMessage: `Parameter *${p.name}* tidak valid.` });
      if (p.options && !p.options.includes(v)) throw err('PARAM_INVALID', `Parameter '${p.name}' di luar pilihan`, { userMessage: `Pilihan *${p.name}*: ${p.options.join(', ')}` });
      clean[p.name] = v;
    }
    const known = new Set(ep.params.flatMap(p => [p.name, ...(p.aliases || [])]));
    for (const k of Object.keys(params)) if (!known.has(k)) throw err('PARAM_UNKNOWN', `Parameter '${k}' tidak dikenal untuk ${ep.path}`, { userMessage: `Parameter *${k}* tidak dikenal.` });
    return clean;
  }

  parseResponse(r) {
    const type = String(r.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (/^(image|video|audio)\//.test(type) || type === 'application/octet-stream' || type === 'application/pdf') {
      const sniff = sniffMime(r.body);
      return { kind: 'media', mime: sniff?.mime || type, ext: sniff?.ext || type.split('/')[1] || 'bin', buffer: r.body };
    }
    const text = r.body.toString('utf8');
    if (type.includes('json') || /^\s*[[{]/.test(text)) {
      try { return { kind: 'json', data: JSON.parse(text) }; }
      catch { throw err('INVALID_RESPONSE', 'Respons JSON tidak valid dari APIZ2Z', { userMessage: 'Respons dari server API tidak valid.' }); }
    }
    return { kind: 'text', text };
  }

  async call(method, endpointPath, params = {}, { file = null, cache = method === 'GET' } = {}) {
    const ep = this.getEndpoint(endpointPath);
    if (!ep) throw err('UNKNOWN_ENDPOINT', `Endpoint ${endpointPath} tidak ada di katalog terverifikasi`, { userMessage: 'Endpoint tidak dikenal.' });
    if (ep.excluded) throw err('ENDPOINT_EXCLUDED', `Endpoint ${endpointPath} dikecualikan: ${ep.excluded}`, { userMessage: 'Fitur ini tidak tersedia.' });
    if (!this.hasKey()) throw err('NEEDS_API_KEY', 'APIZ2Z_API_KEY belum diisi', { userMessage: 'API key APIZ2Z belum diisi oleh owner (env APIZ2Z_API_KEY).' });
    if (file && !ep.upload) throw err('UPLOAD_NOT_SUPPORTED', `${endpointPath} tidak menerima upload`);
    if (file && file.buffer.length > 8 * 1024 * 1024) throw err('FILE_TOO_LARGE', 'File maksimal 8 MB', { userMessage: 'File maksimal 8 MB.' });

    const query = this.validateParams(ep, params, { hasFile: Boolean(file) });
    const url = `${this.base}${ep.path}${Object.keys(query).length ? '?' + new URLSearchParams(query) : ''}`;
    const cacheKey = !file && cache ? url : null;
    if (cacheKey) { const hit = this.cache.get(cacheKey); if (hit) { this.stats.cached++; return hit; } }

    const rl = this.limiter.check('apiz2z');
    if (!rl.allowed) throw err('RATE_LIMITED', 'Batas request APIZ2Z per menit tercapai', { userMessage: `Terlalu banyak request ke API, coba lagi ${Math.ceil(rl.retryAfterMs / 1000)} detik lagi.` });

    const result = await this.sem.run(() => this._withRetry(file ? 'POST' : method, url, file));
    if (cacheKey && result.kind === 'json') this.cache.set(cacheKey, result);
    return result;
  }

  async _withRetry(method, url, file) {
    const headers = { Authorization: `Bearer ${this.cfg.apiKey}`, Accept: 'application/json, image/*, video/*, audio/*;q=0.9, */*;q=0.5' };
    if (file) headers['Content-Type'] = file.mime || 'application/octet-stream';
    let attempt = 0, lastError;
    while (attempt <= this.cfg.retries) {
      this.stats.requests++;
      try {
        const r = await this.transport(url, { method, headers, body: file ? file.buffer : null, timeoutMs: this.cfg.timeoutMs, maxBytes: this.cfg.maxResponseBytes, allowHosts: this.allowHosts });
        if (r.status === 429 || r.status >= 500) {
          const parsed = safeParse(r);
          lastError = gatewayError(r.status, parsed);
          if (attempt < this.cfg.retries && !['QUOTA_EXCEEDED', 'MAINTENANCE', 'ENDPOINT_UNAVAILABLE'].includes(lastError.code)) {
            const ra = Number(r.headers['retry-after']);
            await sleep(Math.min(Number.isFinite(ra) && ra > 0 ? ra * 1000 : 800 * 2 ** attempt, 8000));
            attempt++; continue;
          }
          throw lastError;
        }
        if (r.status >= 400) throw gatewayError(r.status, safeParse(r));
        const parsed = this.parseResponse(r);
        if (parsed.kind === 'json' && parsed.data && parsed.data.status === false) throw gatewayError(r.status, parsed.data);
        this.stats.ok++; this.stats.lastOkAt = new Date().toISOString();
        return parsed;
      } catch (e) {
        lastError = e;
        const retryable = ['NETWORK_ERROR', 'TIMEOUT'].includes(e.code);
        if (retryable && attempt < this.cfg.retries) { await sleep(800 * 2 ** attempt); attempt++; continue; }
        this.stats.failed++; this.stats.lastError = { code: e.code || 'ERROR', at: new Date().toISOString() };
        this.logger?.warn('APIZ2Z gagal', { url: url.replace(/\?.*$/, ''), code: e.code, status: e.status });
        throw e;
      }
    }
    this.stats.failed++;
    throw lastError;
  }

  get(endpointPath, params, opts) { return this.call('GET', endpointPath, params, opts); }
  post(endpointPath, params, file, opts = {}) { return this.call('POST', endpointPath, params, { ...opts, file }); }

  // Status koneksi: /health platform (tanpa key, tidak memakai kuota).
  async getStatus() {
    const started = Date.now();
    try {
      const r = await this.transport(`${this.base}/health`, { method: 'GET', timeoutMs: 10000, maxBytes: 64 * 1024, allowHosts: this.allowHosts });
      return { reachable: r.status === 200, status: r.status, ms: Date.now() - started, hasKey: this.hasKey(), endpoints: this.getEndpoints().length, stats: { ...this.stats } };
    } catch (e) {
      return { reachable: false, error: e.code || 'ERROR', ms: Date.now() - started, hasKey: this.hasKey(), endpoints: this.getEndpoints().length, stats: { ...this.stats } };
    }
  }
}

function safeParse(r) {
  try { return JSON.parse(r.body.toString('utf8')); } catch { return null; }
}

function gatewayError(status, body) {
  const code = (body && (body.error || body.code)) || (status === 429 ? 'RATE_LIMITED' : status >= 500 ? 'UPSTREAM_FAILED' : 'REQUEST_FAILED');
  const msg = GATEWAY_MESSAGES[code] || (body && typeof body.message === 'string' ? body.message : null) || `Server API menjawab HTTP ${status}`;
  return err(String(code), `APIZ2Z ${status} ${code}`, { status, userMessage: String(msg).slice(0, 300) });
}

module.exports = { Apiz2zClient, loadCatalog, CATALOG_FILE, GATEWAY_MESSAGES };
