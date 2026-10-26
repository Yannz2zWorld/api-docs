'use strict';
// Mengubah global.* dari settingsbot.js (gaya Yann AI V15) menjadi konfigurasi yang dipakai bot.
// settingsbot.js cukup berisi global.xxx; file ini yang menerjemahkannya. Nilai .env (kalau diisi)
// menimpa nilai settingsbot.js, berguna untuk panel/VPS.

const env = (name, fallback = undefined) => { const v = process.env[name]; return v === undefined || v === '' ? fallback : v; };
const envInt = (name, fallback) => { const v = parseInt(env(name, ''), 10); return Number.isFinite(v) ? v : fallback; };
const envBool = (name, fallback) => { const v = env(name); return v === undefined ? fallback : /^(1|true|yes|on)$/i.test(String(v)); };
const envList = (name, fallback = []) => { const v = env(name); return v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : fallback; };
const or = (v, d) => (v === undefined || v === null ? d : v);

function settingsMap(g = global) {
  return {
    bot: {
      projectName: 'YannAjahNew',
      name: env('BOT_NAME', g.botname),
      name2: env('BOT_NAME2', g.botname2),
      version: g.versi,
      packname: env('BOT_PACKNAME', g.packname),
      author: env('BOT_AUTHOR', g.author),
      timezone: env('BOT_TIMEZONE', or(g.timezone, 'Asia/Jakarta')),
      locale: 'id-ID'
    },
    owner: { number: env('OWNER_NUMBER', g.owner), name: env('OWNER_NAME', g.namaOwner), extra: envList('OWNER_EXTRA', or(g.ownerTambahan, [])) },
    prefix: { list: envList('BOT_PREFIX', or(g.prefix, ['.', '!', '#', '/'])), allowNoPrefix: envBool('BOT_NO_PREFIX', or(g.tanpaPrefix, false)) },
    chat: {
      public: envBool('BOT_PUBLIC', or(g.public, true)), groupOnly: envBool('BOT_GROUP_ONLY', or(g.onlyGrup, false)), privateOnly: envBool('BOT_PRIVATE_ONLY', or(g.onlyPrivate, false)),
      autoRead: envBool('BOT_AUTOREAD', or(g.autoRead, false)), autoTyping: envBool('BOT_AUTOTYPING', or(g.autoTyping, false)), readStatus: false,
      logMessageContent: envBool('BOT_LOG_CONTENT', false)   // isi pesan pribadi tidak dicatat ke log (privasi)
    },
    logger: { level: env('LOG_LEVEL', 'info'), file: env('LOG_FILE', 'library/database/logs/yannajah.log'), baileysLevel: env('BAILEYS_LOG_LEVEL', 'silent') },
    pairing: {
      method: env('PAIRING_METHOD', or(g.pairing, 'ask')),   // flag --qr / --pairing-code menimpa nilai ini
      phoneNumber: env('PAIRING_NUMBER', ''),
      customCode: env('PAIRING_CUSTOM_CODE', g.custompairing),
      sessionDir: env('SESSION_DIR', 'session'),
      qrMaxRefresh: envInt('PAIRING_QR_MAX_REFRESH', 6),
      pairingTimeoutMs: envInt('PAIRING_TIMEOUT_MS', 180000),
      browser: ['Ubuntu', 'Chrome', '22.04.4'],
      reconnect: { maxAttempts: envInt('RECONNECT_MAX', 12), baseDelayMs: 3000, maxDelayMs: 60000 },
      followChannelOnConnect: envBool('FOLLOW_CHANNEL', or(g.followSaluran, false))
    },
    license: {
      // Alamat web database. Di paket bot (build) alamatnya tertanam di yannajah.js dan selalu dipakai.
      serverUrl: (e => (e.locked && e.url ? e.url : env('LICENSE_SERVER_URL', 'http://127.0.0.1:8787')))(require('./license-endpoint')),
      instanceName: env('BOT_INSTANCE_NAME', 'yannajah-main'),
      tokenFile: env('LICENSE_TOKEN_FILE', 'library/database/license-session.json'),
      heartbeatMinutes: envInt('LICENSE_HEARTBEAT_MINUTES', 2),
      requestTimeoutMs: envInt('LICENSE_TIMEOUT_MS', 15000),
      offlineGraceMinutes: envInt('LICENSE_OFFLINE_GRACE_MINUTES', 0),   // 0 = web database mati -> bot berhenti
      maxPasswordAttempts: 3
    },
    database: { file: env('BOT_DB_FILE', or(g.tempatDB, 'database.json')), dir: 'library/database', saveIntervalMs: envInt('BOT_DB_SAVE_MS', 30000) },
    api: {
      apiz2z: {
        baseUrl: env('APIZ2Z_BASE_URL', 'https://apiz2z.web.id'),
        apiKey: env('APIZ2Z_API_KEY', g.apikeyapiz2z || ''),
        allowedHosts: envList('APIZ2Z_ALLOWED_HOSTS', ['apiz2z.web.id', 'cdn.apiz2z.web.id', 'apiz2z.vercel.app']),
        timeoutMs: envInt('APIZ2Z_TIMEOUT_MS', 60000),
        retries: envInt('APIZ2Z_RETRIES', 2),
        perMinute: envInt('APIZ2Z_PER_MINUTE', 60),
        concurrency: envInt('APIZ2Z_CONCURRENCY', 4),
        maxResponseBytes: envInt('APIZ2Z_MAX_RESPONSE_BYTES', 16 * 1024 * 1024),
        cacheTtlMs: envInt('APIZ2Z_CACHE_TTL_MS', 5 * 60 * 1000)
      }
    },
    plugin: { dir: or(g.folderPlugin, 'plugins'), enableLegacy: true, hotReload: envBool('PLUGIN_HOT_RELOAD', false), disabled: envList('DISABLED_FEATURES', or(g.fiturMati, [])), trustedExternal: {} },
    media: {
      tmpDir: 'library/database/sampah',
      maxDownloadBytes: envInt('MEDIA_MAX_BYTES', 50 * 1024 * 1024),
      maxUploadBytes: 8 * 1024 * 1024,
      downloadTimeoutMs: 45000,
      ffmpegPath: env('FFMPEG_PATH', 'ffmpeg'),
      maxConcurrent: envInt('MEDIA_MAX_CONCURRENT', 1),
      ffmpegThreads: envInt('FFMPEG_THREADS', 1)
    },
    limit: { daily: envInt('LIMIT_HARIAN', g.limitHarian), premiumUnlimited: true, warnBeforeKick: envInt('WARN_GRUP', g.warnGrup), cooldownSeconds: or(g.cooldown, 3), spamWindowMs: 8000, spamMaxCommands: 6 },
    permission: { registerRequired: envBool('REGISTER_REQUIRED', or(g.wajibDaftar, false)), allowEvalForOwner: false },
    cache: { groupMetadataTtlMs: 5 * 60 * 1000, messageCacheSize: 500 },
    concurrency: { commandsPerUser: 2, globalCommands: 24 },
    retry: { sendMessage: 2 },
    timeout: { commandMs: 120000 },
    harga: g.harga,
    sewa: g.sewa,
    links: { owner: g.linkOwner, group: g.linkGrup, channel: g.linkSaluran, channelId: g.idSaluran, channelName: g.namaSaluran },
    payment: { dana: env('PAY_DANA', g.dana), gopay: env('PAY_GOPAY', g.gopay), qris: g.image?.qris },
    delay: { jpm: or(g.delayJpm, 3000) },
    image: g.image,
    mess: {
      cooldown: '⏱️ Tunggu {s} detik sebelum memakai command lagi.',
      disabled: '⛔ Fitur ini sedang dinonaktifkan.',
      needApiKey: '🔑 Fitur ini butuh API key APIZ2Z. Owner perlu mengisi global.apikeyapiz2z di settingsbot.js.',
      unlicensed: '🔒 Bot belum terverifikasi oleh web database. Hubungi owner.',
      ...g.mess
    }
  };
}

module.exports = { settingsMap };
