'use strict';
/*
 * YannAjahNew — entry point bot.
 *   node index.js                 (metode pairing sesuai settingsbot.js, default: tanya)
 *   node index.js --qr            (paksa QR)
 *   node index.js --pairing-code  (paksa pairing code nomor telepon)
 *
 * Urutan start:
 *   banner -> validasi konfigurasi -> verifikasi/login ke server lisensi pusat (nomor bot + password bot)
 *   -> database lokal -> muat plugin & feature registry -> koneksi WhatsApp (session lama / QR / pairing code)
 *   -> heartbeat lisensi (ban/disable/maintenance dari dashboard langsung berlaku).
 * Exit code 78 = ditolak server lisensi / konfigurasi salah (process manager sebaiknya TIDAK restart otomatis).
 */

const path = require('path');
const readline = require('readline');
const chalk = require('chalk');
const pino = require('pino');
const { loadConfig, ConfigError } = require('./library/config-loader');
const { createLogger } = require('./library/logger');
const { banner } = require('./library/banner');
const { LicenseClient } = require('./library/license');
const { WhatsAppManager, loadBaileys } = require('./library/connection');
const { Apiz2zClient } = require('./library/apiz2z');
const { Registry } = require('./library/registry');
const DataBase = require('./source/database');
const { createYannajah } = require('./yannajah');
const { createRouter } = require('./command');
const { serialize } = require('./myfunct/message');
const { createGroupHandler } = require('./myfunct/handler');
const { applyLegacyGlobals } = require('./settings');
const { sleep } = require('./library/function');

const EXIT_DENIED = 78;
const ROOT = __dirname;

function ask(question, { hidden = false } = {}) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) rl._writeToOutput = s => rl.output.write(s.includes(question) ? s : s.replace(/[^\r\n]/g, '*'));
    rl.question(question, a => { rl.close(); if (hidden) process.stdout.write('\n'); resolve(String(a || '').trim()); });
  });
}

async function authenticate(license, config, logger) {
  // 1) token tersimpan (tidak perlu password tiap restart selama sesi masih sah)
  for (let i = 1; i <= 3; i++) {
    try {
      if (await license.verifyStored()) return true;
      if (license.state && !license.state.allowed) {
        console.log(chalk.red(`✖ ${license.describe(license.lockReason)}`));
        return false;
      }
      break;
    } catch (e) {
      if (e.code !== 'SERVER_UNREACHABLE') throw e;
      logger.warn(`Server lisensi tidak bisa dihubungi (percobaan ${i}/3)`);
      if (i === 3) { console.log(chalk.red('✖ Server lisensi tidak bisa dihubungi. Bot tidak dijalankan (gagal aman).')); return false; }
      await sleep(5000 * i);
    }
  }
  // 2) login nomor bot + password bot
  const interactive = process.stdin.isTTY;
  const envPhone = process.env.BOT_AUTH_PHONE, envPass = process.env.BOT_AUTH_PASSWORD;
  if (!interactive && !(envPhone && envPass)) {
    console.log(chalk.red('✖ Butuh login ke server lisensi, tetapi tidak ada terminal interaktif. Jalankan sekali secara interaktif, atau isi BOT_AUTH_PHONE & BOT_AUTH_PASSWORD (env) untuk login pertama.'));
    return false;
  }
  console.log(chalk.cyan('🔐 Login ke server lisensi YannAjahNew'));
  for (let attempt = 1; attempt <= config.license.maxPasswordAttempts; attempt++) {
    const phone = envPhone || await ask(chalk.blue('Nomor bot terdaftar (contoh 6281234567890): '));
    const password = envPass || await ask(chalk.blue('Password bot: '), { hidden: true });
    let force = false;
    for (;;) {
      try {
        const state = await license.login({ phone, password, force, version: config.bot.version });
        console.log(chalk.green(`✔ Terverifikasi: ${state.bot.name} (${state.bot.phone_number})`));
        return true;
      } catch (e) {
        if (e.code === 'INSTANCE_ACTIVE' && interactive && !force) {
          const a = await ask(chalk.yellow('Bot ini masih tercatat berjalan di proses lain. Ambil alih (proses lain akan berhenti)? (y/N) '));
          if (/^y/i.test(a)) { force = true; continue; }
        }
        console.log(chalk.red(`✖ ${e.userMessage || e.message}`));
        if (['BOT_BANNED', 'BOT_DISABLED', 'BOT_DELETED', 'OWNER_RESTRICTED', 'USER_RESTRICTED', 'TOO_MANY_ATTEMPTS', 'SERVER_UNREACHABLE'].includes(e.code)) {
          if (e.details?.ban_reason) console.log(chalk.red(`  Alasan: ${e.details.ban_reason}`));
          return false;
        }
        break;
      }
    }
    if (envPhone && envPass) return false;
  }
  return false;
}

async function choosePairingMethod(config) {
  if (process.argv.includes('--qr')) return 'qr';
  if (process.argv.includes('--pairing-code')) return 'pairing';
  if (config.pairing.method !== 'ask') return config.pairing.method;
  if (!process.stdin.isTTY) return 'qr';
  console.log(chalk.cyan('\nBelum ada session WhatsApp. Pilih metode tautkan perangkat:\n  1) QR code\n  2) Pairing code (nomor telepon)'));
  const a = await ask(chalk.blue('Pilih 1/2: '));
  return a === '2' ? 'pairing' : 'qr';
}

async function main() {
  let config;
  try { config = loadConfig(); }
  catch (e) {
    console.log(banner({}));
    console.error(chalk.red(e instanceof ConfigError ? e.message : `Gagal memuat konfigurasi: ${e.message}`));
    process.exit(EXIT_DENIED);
  }
  applyLegacyGlobals(config);
  console.log(banner({ version: config.bot.version, botName: config.bot.name, instance: config.license.instanceName }));
  const logger = createLogger({ level: config.logger.level, file: path.resolve(ROOT, config.logger.file) });
  const baileysLogger = pino({ level: config.logger.baileysLevel });

  // ---------------------------------------------------------------- lisensi pusat (wajib sebelum fitur aktif)
  const license = new LicenseClient(config.license, { logger: logger.child('auth'), rootDir: ROOT });
  if (!(await authenticate(license, config, logger))) process.exit(EXIT_DENIED);

  // ---------------------------------------------------------------- database lokal, API, plugin
  const store = new DataBase({ dir: path.resolve(ROOT, config.database.dir), file: config.database.file, logger });
  await store.read();
  store.startAutoSave(config.database.saveIntervalMs);
  const api = new Apiz2zClient(config.api.apiz2z, { logger: logger.child('apiz2z') });
  const registry = new Registry({ logger, db: () => store.data });
  const n = registry.loadDir(path.resolve(ROOT, config.plugin.dir), { trustedExternal: config.plugin.trustedExternal || {} });
  logger.info(`Feature registry: ${n} fitur dimuat${registry.loadErrors.length ? `, ${registry.loadErrors.length} ditolak (lihat npm run features:report)` : ''}`);
  if (!api.hasKey()) logger.warn('APIZ2Z_API_KEY belum diisi: fitur berbasis APIZ2Z berstatus needs_api_key.');

  let shuttingDown = false;
  const wa = new WhatsAppManager(config.pairing, { logger: logger.child('wa'), license, baileysLogger, rootDir: ROOT });
  const yannajah = createYannajah({ config, logger, store, license, api, registry, wa });
  global.yannajah = yannajah;   // akses untuk plugin legacy
  const route = createRouter(yannajah, { config, logger: logger.child('router') });
  const onGroup = createGroupHandler(yannajah, { logger });
  const B = await loadBaileys();
  const groupMetadata = jid => wa.groupCache.get(jid) ? Promise.resolve(wa.groupCache.get(jid)) : wa.sock.groupMetadata(jid).then(md => { wa.groupCache.set(jid, md); return md; });

  wa.on('messages', async ev => {
    if (ev.type !== 'notify') return;
    for (const raw of ev.messages || []) {
      try {
        if (!raw.message || raw.key?.remoteJid === 'status@broadcast' || raw.message.protocolMessage) continue;
        const settings = store.data.settings;
        if (settings.autoread ?? config.chat.autoRead) wa.sock.readMessages([raw.key]).catch(() => {});
        const m = await serialize(wa.sock, raw, { B, groupMetadata, prefixes: settings.prefix?.length ? settings.prefix : config.prefix.list, allowNoPrefix: config.prefix.allowNoPrefix });
        if (config.chat.logMessageContent) logger.debug('pesan', { chat: m.chat, cmd: m.command });
        if ((settings.autotyping ?? config.chat.autoTyping) && m.isCmd) wa.sock.sendPresenceUpdate('composing', m.chat).catch(() => {});
        await route(m);
      } catch (e) { logger.error('Gagal memproses pesan', e.message); }
    }
  });
  wa.on('group-participants', onGroup);
  wa.on('open', () => {
    logger.info(`✔ WhatsApp terhubung sebagai ${wa.sock?.user?.id?.split(':')[0] || '?'}`);
    if (config.pairing.followChannelOnConnect && config.links.channelId) wa.sock.newsletterFollow?.(config.links.channelId).catch(() => {});
  });
  wa.on('number_mismatch', () => console.log(chalk.red('✖ Nomor WhatsApp yang ditautkan BUKAN nomor bot terdaftar di dashboard. Session dilepas. Tautkan memakai nomor yang benar.')));
  wa.on('terminal', reason => {
    const msg = { logged_out: 'Perangkat logout dari WhatsApp. Session dihapus; jalankan ulang untuk pairing lagi.', replaced: 'Session dipakai di tempat lain (connection replaced). Bot berhenti.', bad_session: 'Session rusak dan dihapus. Jalankan ulang untuk pairing.', forbidden: 'WhatsApp menolak koneksi (403).', max_reconnect: 'Gagal reconnect berulang kali.' }[reason] || reason;
    console.log(chalk.red(`✖ ${msg}`));
    // Butuh tindakan manusia (pairing ulang / proses lain) -> 78 agar process manager tidak restart terus; lainnya -> 1.
    shutdown(`terminal:${reason}`, ['logged_out', 'replaced', 'bad_session', 'forbidden', 'multidevice_mismatch'].includes(reason) ? EXIT_DENIED : 1);
  });
  wa.on('pairing_timeout', () => { console.log(chalk.red('✖ Pairing tidak selesai dalam batas waktu.')); shutdown('pairing_timeout', EXIT_DENIED); });
  wa.on('number_mismatch', () => shutdown('number_mismatch', EXIT_DENIED));

  // Ban / disable / sesi dicabut dari dashboard -> hentikan pemakaian WhatsApp (tidak reconnect).
  license.on('locked', reason => {
    logger.warn(`Lisensi terkunci: ${license.describe(reason)} — koneksi WhatsApp dihentikan`);
    wa.stop().catch(() => {});
    // Server tidak terjangkau: tetap hidup dan tunggu pulih (heartbeat terus mencoba).
    // Sesi dicabut / bot diban / disable: butuh tindakan admin + login ulang -> keluar 78.
    if (reason !== 'SERVER_UNREACHABLE') shutdown(`lisensi terkunci (${reason})`, EXIT_DENIED);
  });
  // Pulih dari gangguan jaringan ke server lisensi (token masih sah) -> sambung lagi.
  license.on('state', s => { if (s.allowed && wa.stopped && !shuttingDown && wa.hasSession()) wa.start().catch(e => logger.error('Gagal menyambung ulang', e.message)); });
  license.startHeartbeat();
  license.timer?.ref?.();   // proses bot tetap hidup selama heartbeat berjalan (menunggu pulih bila server lisensi down)

  async function shutdown(sig, code = 0) {
    if (shuttingDown) return; shuttingDown = true;
    console.log(chalk.yellow(`\n${sig} — menutup dengan aman (session & database disimpan)...`));
    license.stopHeartbeat();
    await wa.stop().catch(() => {});
    store.stopAutoSave();
    await store.write().catch(e => logger.error('Gagal menyimpan database', e.message));
    await license.heartbeat().catch(() => {});   // laporkan disconnected
    await logger.close();
    process.exit(code);
  }
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('unhandledRejection', e => logger.error('unhandledRejection', e?.message || String(e)));

  // ---------------------------------------------------------------- WhatsApp
  const options = {};
  if (!wa.hasSession()) {
    options.method = await choosePairingMethod(config);
    if (options.method === 'pairing') options.phone = license.botPhone();
    console.log(chalk.gray(options.method === 'pairing' ? `Pairing code akan dibuat untuk nomor bot terdaftar ${license.botPhone()}.` : 'Menyiapkan QR code...'));
  }
  await wa.start(options);
}

main().catch(e => {
  console.error(chalk.red(`✖ Gagal start: ${e.userMessage || e.message}`));
  process.exit(e.code === 'SESSION_IN_USE' || e.code === 'LICENSE_LOCKED' ? EXIT_DENIED : 1);
});
