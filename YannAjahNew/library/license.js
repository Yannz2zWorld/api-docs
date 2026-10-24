'use strict';
// yannajah.auth — autentikasi proses bot ke backend pusat (server/).
//   1. Ada token tersimpan? -> POST /api/bot/auth/verify. Valid & diizinkan -> lanjut tanpa minta password.
//   2. Tidak ada / ditolak -> minta nomor bot + password bot -> POST /api/bot/auth/login -> token baru.
//   3. Heartbeat berkala: kirim status koneksi WhatsApp, terima status ban/disable/maintenance terbaru.
// Gagal aman: server tidak bisa dihubungi lebih lama dari offlineGraceMinutes (default 0) -> bot TERKUNCI.
// Password tidak pernah disimpan, dicatat, atau dikirim lewat URL. Token disimpan lokal dengan mode 0600
// (hanya token sesi bot yang bisa dicabut dari dashboard, bukan password).

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const { request } = require('./net');
const { err } = require('./errors');
const { normalizePhone } = require('./function');

const MESSAGES = {
  INVALID_CREDENTIALS: 'Nomor atau password salah.',
  TOO_MANY_ATTEMPTS: 'Terlalu banyak percobaan login. Coba lagi nanti.',
  TOO_MANY_REQUESTS: 'Terlalu banyak request ke server lisensi. Coba lagi nanti.',
  BOT_BANNED: 'Bot ini sedang diban oleh administrator.',
  BOT_DISABLED: 'Bot ini sedang dinonaktifkan.',
  BOT_DELETED: 'Bot ini sudah dihapus dari server.',
  OWNER_RESTRICTED: 'Akun pemilik bot sedang tidak aktif.',
  USER_RESTRICTED: 'Akun pemakai bot sedang tidak aktif.',
  INSTANCE_ACTIVE: 'Bot ini sedang dijalankan oleh proses lain.',
  INSTANCE_MISMATCH: 'Token milik proses bot lain.',
  SESSION_REVOKED: 'Sesi bot dicabut dari dashboard.',
  SESSION_EXPIRED: 'Sesi bot kedaluwarsa.',
  INVALID_TOKEN: 'Token bot tidak valid.',
  SERVER_UNREACHABLE: 'Server lisensi tidak bisa dihubungi.'
};

class LicenseClient extends EventEmitter {
  constructor(cfg, { logger, transport = request, rootDir = path.join(__dirname, '..') } = {}) {
    super();
    this.cfg = cfg;
    this.logger = logger;
    this.transport = transport;
    // Build distribusi: alamat website tertanam (library/license-endpoint.js) selalu menang.
    const endpoint = require('./license-endpoint');
    const url = endpoint.locked && endpoint.url ? endpoint.url : cfg.serverUrl;
    this.base = new URL(url).origin;
    this.allowHosts = new Set([new URL(url).hostname]);
    this.file = path.resolve(rootDir, cfg.tokenFile);
    this.session = this._load();
    this.state = null;          // state terakhir dari server
    this.locked = true;         // fail-closed sampai verifikasi berhasil
    this.lockReason = 'NOT_VERIFIED';
    this.lastOkAt = 0;
    this.timer = null;
    this.connectionStatus = 'disconnected';
  }

  _load() {
    try {
      const s = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (s && typeof s.instanceId === 'string') return s;
    } catch { /* belum ada */ }
    return { instanceId: crypto.randomBytes(18).toString('base64url'), token: null, expiresAt: null, botPhone: null };
  }

  _save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.session), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  _clearToken() { this.session.token = null; this.session.expiresAt = null; this._save(); }

  async _call(pathname, body, { token } = {}) {
    let r;
    try {
      r = await this.transport(this.base + pathname, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body || {}),
        timeoutMs: this.cfg.requestTimeoutMs,
        maxBytes: 256 * 1024,
        allowHosts: this.allowHosts
      });
    } catch (e) {
      throw err('SERVER_UNREACHABLE', `Server lisensi tidak bisa dihubungi (${e.code || 'NETWORK'})`, { userMessage: MESSAGES.SERVER_UNREACHABLE, cause: e });
    }
    let json = null;
    try { json = JSON.parse(r.body.toString('utf8')); } catch { /* respons bukan JSON */ }
    if (r.status >= 200 && r.status < 300 && json?.success) return json;
    if (!json) throw err('SERVER_UNREACHABLE', `Respons server lisensi tidak valid (HTTP ${r.status})`, { userMessage: MESSAGES.SERVER_UNREACHABLE, status: r.status });
    const code = json.error || 'AUTH_FAILED';
    throw err(code, `Server lisensi menolak: ${code}`, { userMessage: json.message || MESSAGES[code] || 'Akses ditolak server lisensi.', status: r.status, details: { reasons: json.reasons, ban_reason: json.ban_reason, reason: json.reason } });
  }

  _apply(state) {
    this.state = state;
    this.lastOkAt = Date.now();
    this.locked = !state.allowed;
    this.lockReason = state.allowed ? null : (state.reasons || ['DENIED'])[0];
    this.emit('state', state);
    if (this.locked) this.emit('locked', this.lockReason, state);
  }

  _lock(reason) {
    const was = this.locked;
    this.locked = true; this.lockReason = reason;
    if (!was) this.emit('locked', reason, this.state);
  }

  // Coba token tersimpan. true = terverifikasi dan diizinkan.
  async verifyStored() {
    if (!this.session.token) return false;
    try {
      const r = await this._call('/api/bot/auth/verify', {}, { token: this.session.token });
      this._apply(r.state);
      return !this.locked;
    } catch (e) {
      if (e.code === 'SERVER_UNREACHABLE') throw e;
      this.logger?.warn('Token bot tersimpan ditolak server', { code: e.code });
      this._clearToken();
      return false;
    }
  }

  async login({ phone, password, force = false, version }) {
    const p = normalizePhone(phone);
    if (!p) throw err('INVALID_PHONE', 'Nomor tidak valid', { userMessage: 'Format nomor tidak valid. Contoh: 6281234567890' });
    if (typeof password !== 'string' || !password) throw err('INVALID_CREDENTIALS', 'Password kosong', { userMessage: MESSAGES.INVALID_CREDENTIALS });
    const r = await this._call('/api/bot/auth/login', { phone_number: p, password, instance_id: this.session.instanceId, instance_name: this.cfg.instanceName, version, force: force === true });
    this.session.token = r.token;
    this.session.expiresAt = r.expires_at;
    this.session.botPhone = r.state?.bot?.phone_number || p;
    this._save();
    this._apply(r.state);
    return r.state;
  }

  async heartbeat() {
    if (!this.session.token) return this._lock('NOT_LOGGED_IN');
    try {
      const r = await this._call('/api/bot/heartbeat', { instance_id: this.session.instanceId, connection_status: this.connectionStatus }, { token: this.session.token });
      this._apply(r.state);
    } catch (e) {
      if (e.code === 'SERVER_UNREACHABLE') {
        const graceMs = this.cfg.offlineGraceMinutes * 60000;
        if (Date.now() - this.lastOkAt > graceMs) this._lock('SERVER_UNREACHABLE');
        this.logger?.warn('Heartbeat lisensi gagal', { code: e.code, locked: this.locked });
        return;
      }
      // Dicabut / kedaluwarsa / instance lain: kunci dan buang token. Tidak ada akses penuh secara default.
      this._clearToken();
      this._lock(e.code);
      this.logger?.warn('Sesi bot ditolak server', { code: e.code, reason: e.details?.reason });
    }
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.timer = setInterval(() => this.heartbeat(), this.cfg.heartbeatMinutes * 60000);
    this.timer.unref?.();
  }
  stopHeartbeat() { if (this.timer) clearInterval(this.timer); this.timer = null; }

  setConnectionStatus(s) {
    if (s === this.connectionStatus) return;
    this.connectionStatus = s;
    if (!this.locked) this.heartbeat().catch(() => {});
  }

  async logout() {
    this.stopHeartbeat();
    if (!this.session.token) return;
    try { await this._call('/api/bot/auth/logout', {}, { token: this.session.token }); } catch { /* tetap hapus lokal */ }
    this._clearToken();
    this._lock('LOGGED_OUT');
  }

  // API untuk namespace yannajah.auth
  isActive() { return !this.locked; }
  maintenance() { return this.state?.maintenance || { active: false }; }
  botPhone() { return this.state?.bot?.phone_number || this.session.botPhone || null; }
  status() {
    return { active: !this.locked, reason: this.lockReason, bot: this.state?.bot || null, maintenance: this.maintenance(), lastOkAt: this.lastOkAt ? new Date(this.lastOkAt).toISOString() : null, expiresAt: this.session.expiresAt, instanceName: this.cfg.instanceName };
  }
  async verify() { return this.verifyStored(); }
  describe(code) { return MESSAGES[code] || code; }
}

module.exports = { LicenseClient, MESSAGES };
