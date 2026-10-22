'use strict';
// WhatsApp connection manager (Baileys 7, ESM -> dimuat lewat dynamic import).
// Kemampuan yang DIVERIFIKASI di versi terpasang (@whiskeysockets/baileys 7.0.0-rc14):
//   - QR: event connection.update { qr } (printQRInTerminal sudah deprecated, jadi QR dirender sendiri)
//   - Pairing code: sock.requestPairingCode(nomor, customCode?) — customCode harus tepat 8 karakter
// Pengaman:
//   - lock file per folder session: satu folder session tidak dipakai dua proses
//   - nomor WhatsApp yang dipairing WAJIB sama dengan nomor bot terdaftar di server lisensi
//   - reconnect hanya kalau lisensi masih aktif (bot yang diban tidak hidup lagi karena auto-reconnect)
//   - QR / pairing code hanya ke terminal (stdout), TIDAK ke file log; creds tidak pernah dicetak

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const { TTLCache, sleep } = require('./function');
const { err } = require('./errors');

let baileysPromise = null;
const loadBaileys = () => (baileysPromise = baileysPromise || import('@whiskeysockets/baileys'));

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

class SessionLock {
  constructor(dir) { this.file = path.join(dir, '.yannajah.lock'); this.held = false; }
  acquire() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      const fd = fs.openSync(this.file, 'wx', 0o600);
      fs.writeSync(fd, String(process.pid)); fs.closeSync(fd);
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const pid = Number(fs.readFileSync(this.file, 'utf8')) || 0;
      if (pid && pid !== process.pid && pidAlive(pid)) throw err('SESSION_IN_USE', `Folder session sedang dipakai proses lain (pid ${pid})`, { userMessage: 'Session WhatsApp ini sedang dipakai proses lain.' });
      fs.writeFileSync(this.file, String(process.pid), { mode: 0o600 });   // lock basi dari proses yang sudah mati
    }
    this.held = true;
  }
  release() { if (this.held) { try { fs.unlinkSync(this.file); } catch {} this.held = false; } }
}

class WhatsAppManager extends EventEmitter {
  constructor(cfg, { logger, license, baileysLogger, rootDir = path.join(__dirname, '..'), print = s => process.stdout.write(s + '\n') } = {}) {
    super();
    this.cfg = cfg;               // settingsbot.pairing
    this.logger = logger;
    this.license = license;
    this.baileysLogger = baileysLogger;
    this.print = print;
    this.sessionDir = path.resolve(rootDir, cfg.sessionDir);
    this.lock = new SessionLock(this.sessionDir);
    this.sock = null;
    this.status = 'disconnected';
    this.attempts = 0;
    this.stopped = false;
    this.messages = new TTLCache({ ttlMs: 30 * 60000, max: 1000 });
    this.groupCache = new TTLCache({ ttlMs: 5 * 60000, max: 500 });
    this.saving = Promise.resolve();
  }

  setStatus(s) {
    this.status = s;
    this.license?.setConnectionStatus(s);
    this.emit('status', s);
  }

  hasSession() { return fs.existsSync(path.join(this.sessionDir, 'creds.json')); }

  clearSession() {
    if (!fs.existsSync(this.sessionDir)) return;
    for (const f of fs.readdirSync(this.sessionDir)) if (f !== '.yannajah.lock') fs.rmSync(path.join(this.sessionDir, f), { recursive: true, force: true });
  }

  // options: { method: 'qr' | 'pairing', phone }
  async start(options = {}) {
    if (this.license && !this.license.isActive()) throw err('LICENSE_LOCKED', 'Lisensi tidak aktif, koneksi WhatsApp tidak dibuka', { userMessage: 'Bot terkunci oleh server lisensi.' });
    this.stopped = false;
    if (!this.lock.held) this.lock.acquire();
    fs.chmodSync(this.sessionDir, 0o700);
    this.options = { ...this.options, ...options };
    const B = await loadBaileys();
    const { state, saveCreds } = await B.useMultiFileAuthState(this.sessionDir);
    let version;
    try { ({ version } = await B.fetchLatestBaileysVersion()); } catch { version = undefined; /* pakai default bawaan library */ }
    const registered = Boolean(state.creds.registered);
    const method = registered ? null : this.options.method;
    if (!registered && !['qr', 'pairing'].includes(method)) throw err('PAIRING_METHOD_REQUIRED', 'Metode pairing belum dipilih');

    const sock = B.makeWASocket({
      version,
      auth: { creds: state.creds, keys: B.makeCacheableSignalKeyStore(state.keys, this.baileysLogger) },
      logger: this.baileysLogger,
      browser: this.cfg.browser,
      markOnlineOnConnect: false,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 25000,
      getMessage: async key => this.messages.get(key.id)?.message || undefined,
      cachedGroupMetadata: async jid => this.groupCache.get(jid)
    });
    this.sock = sock;
    this.setStatus('connecting');
    sock.ev.on('creds.update', () => { this.saving = this.saving.then(saveCreds).catch(e => this.logger?.error('Gagal menyimpan creds', e.message)); });

    let qrCount = 0;
    let pairingRequested = false;
    let pairingTimer = null;
    if (!registered) {
      pairingTimer = setTimeout(() => {
        if (!sock.authState.creds.registered) { this.logger?.warn('Pairing timeout'); this.emit('pairing_timeout'); this.stop().catch(() => {}); }
      }, this.cfg.pairingTimeoutMs);
      pairingTimer.unref?.();
    }

    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update;
      if (qr && !registered) {
        if (method === 'qr') {
          qrCount++;
          if (qrCount > this.cfg.qrMaxRefresh) { this.print('QR kedaluwarsa terlalu sering. Jalankan ulang untuk mencoba lagi.'); return this.stop(); }
          this.emit('qr', qr);
          await this.renderQr(qr, qrCount);
        } else if (method === 'pairing' && !pairingRequested) {
          pairingRequested = true;
          try {
            const custom = this.cfg.customCode && /^[A-Z0-9]{8}$/.test(this.cfg.customCode) ? this.cfg.customCode : undefined;
            const code = await sock.requestPairingCode(this.options.phone, custom);
            this.emit('pairing_code', code);
            this.print(`\n  KODE PAIRING: ${String(code).match(/.{1,4}/g).join('-')}\n  WhatsApp > Perangkat tertaut > Tautkan perangkat > Tautkan dengan nomor telepon\n`);
          } catch (e) {
            this.logger?.error('Gagal meminta pairing code', e.message);
            this.emit('pairing_failed', e);
          }
        }
      }
      if (connection === 'open') {
        clearTimeout(pairingTimer);
        this.attempts = 0;
        const me = String(sock.user?.id || '').split(':')[0].split('@')[0];
        const licensed = this.license?.botPhone();
        if (licensed && me && me !== licensed) {
          this.logger?.error('Nomor WhatsApp yang tertaut tidak sama dengan nomor bot terdaftar. Session dilepas.', { connected: me.slice(0, 4) + '…', licensed: licensed.slice(0, 4) + '…' });
          this.emit('number_mismatch', { connected: me, licensed });
          try { await sock.logout(); } catch {}
          this.clearSession();
          return this.stop();
        }
        this.setStatus('connected');
        this.emit('open', sock);
      }
      if (connection === 'close') {
        clearTimeout(pairingTimer);
        const code = lastDisconnect?.error?.output?.statusCode;
        this.setStatus('disconnected');
        this.emit('close', code);
        await this.handleClose(code, B.DisconnectReason);
      }
    });

    sock.ev.on('messages.upsert', ev => {
      for (const msg of ev.messages || []) if (msg?.key?.id && msg.message) this.messages.set(msg.key.id, msg);
      this.emit('messages', ev);
    });
    sock.ev.on('group-participants.update', ev => { this.groupCache.delete(ev.id); this.emit('group-participants', ev); });
    sock.ev.on('groups.update', list => { for (const g of list || []) this.groupCache.delete(g.id); });
    return sock;
  }

  async renderQr(qr, n) {
    try {
      const qrt = require('qrcode-terminal');
      await new Promise(r => qrt.generate(qr, { small: true }, out => { this.print(`\nScan QR (${n}/${this.cfg.qrMaxRefresh}) — WhatsApp > Perangkat tertaut > Tautkan perangkat\n${out}`); r(); }));
    } catch { this.print('QR tersedia tetapi gagal dirender di terminal.'); }
  }

  async handleClose(code, R) {
    if (this.stopped) return;
    const terminal = { [R.loggedOut]: 'logged_out', [R.connectionReplaced]: 'replaced', [R.forbidden]: 'forbidden', [R.badSession]: 'bad_session', [R.multideviceMismatch]: 'multidevice_mismatch' };
    if (terminal[code]) {
      this.logger?.warn(`Koneksi WhatsApp ditutup: ${terminal[code]} (${code})`);
      if (code === R.loggedOut || code === R.badSession) this.clearSession();
      this.emit('terminal', terminal[code]);
      return this.stop();
    }
    if (this.license && !this.license.isActive()) {
      this.logger?.warn('Tidak reconnect: lisensi terkunci', { reason: this.license.lockReason });
      return this.stop();
    }
    const max = this.cfg.reconnect.maxAttempts;
    if (code !== R.restartRequired && ++this.attempts > max) {
      this.logger?.error(`Reconnect gagal ${max} kali, berhenti.`);
      this.emit('terminal', 'max_reconnect');
      return this.stop();
    }
    const wait = code === R.restartRequired ? 500 : Math.min(this.cfg.reconnect.baseDelayMs * 2 ** (this.attempts - 1), this.cfg.reconnect.maxDelayMs);
    this.logger?.info(`Reconnect ${code === R.restartRequired ? '(restart required)' : `${this.attempts}/${max}`} dalam ${Math.round(wait / 1000)} detik`, { code });
    await sleep(wait);
    if (this.stopped) return;
    try { await this.start(); } catch (e) { this.logger?.error('Reconnect gagal', e.message); }
  }

  // Graceful: tutup socket, tunggu creds selesai ditulis, lepas lock. Session TIDAK dihapus.
  async stop() {
    this.stopped = true;
    const s = this.sock;
    this.sock = null;
    if (s) { try { s.end(undefined); } catch {} }
    await this.saving.catch(() => {});
    this.setStatus('disconnected');
    this.lock.release();
    this.emit('stopped');
  }
}

module.exports = { WhatsAppManager, SessionLock, loadBaileys };
