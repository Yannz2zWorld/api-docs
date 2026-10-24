/*
 * YannAjahNew — settingsbot.js
 * Konfigurasi utama bot. Isinya mengikuti settings.js Yann AI V15 Fixed, dirapikan per kelompok.
 *
 * ATURAN SECRET: API key, token, password, dan URL backend produksi TIDAK ditulis di file ini.
 * Semuanya dibaca dari environment variable (file .env, panel hosting, atau secret manager).
 * Nilai di bawah yang memakai env() hanya default yang aman untuk development.
 *
 * File ini divalidasi saat startup oleh library/config-loader.js. Kalau ada yang salah,
 * bot berhenti dengan pesan yang jelas (tanpa mencetak nilai secret).
 */

const env = (name, fallback = undefined) => {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
};
const envInt = (name, fallback) => {
  const v = parseInt(env(name, ''), 10);
  return Number.isFinite(v) ? v : fallback;
};
const envBool = (name, fallback) => {
  const v = env(name);
  if (v === undefined) return fallback;
  return /^(1|true|yes|on)$/i.test(String(v));
};
const envList = (name, fallback = []) => {
  const v = env(name);
  return v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : fallback;
};

module.exports = {
  // ------------------------------------------------------------------ identitas bot
  bot: {
    projectName: 'YannAjahNew',
    name: env('BOT_NAME', 'ꜱᴇɪʜᴀ - ᴍᴅ'),
    name2: env('BOT_NAME2', 'ₛₑᵢₕₐ ₋ ₘd'),
    version: require('./package.json').version,
    packname: env('BOT_PACKNAME', 'ꜱᴇɪʜᴀ - ᴍᴅ'),
    author: env('BOT_AUTHOR', '© Yann Ai Md'),
    timezone: env('BOT_TIMEZONE', 'Asia/Jakarta'),
    locale: 'id-ID'
  },

  // ------------------------------------------------------------------ owner
  owner: {
    number: env('OWNER_NUMBER', '6285282426298'),
    name: env('OWNER_NAME', 'YannDoangJir'),
    // Owner tambahan (nomor, dipisah koma) — bisa juga ditambah lewat .addowner
    extra: envList('OWNER_EXTRA')
  },

  // ------------------------------------------------------------------ prefix & mode chat
  prefix: {
    // Prefix yang diterima. Ubah lewat .setprefix juga bisa (disimpan di database).
    list: envList('BOT_PREFIX', ['.', '!', '#', '/']),
    // Izinkan command tanpa prefix (mis. "menu"). Default mati agar bot tidak salah respon.
    allowNoPrefix: envBool('BOT_NO_PREFIX', false)
  },
  chat: {
    public: envBool('BOT_PUBLIC', true),      // false = self mode, hanya owner
    groupOnly: envBool('BOT_GROUP_ONLY', false),
    privateOnly: envBool('BOT_PRIVATE_ONLY', false),
    autoRead: envBool('BOT_AUTOREAD', false),
    autoTyping: envBool('BOT_AUTOTYPING', false),
    readStatus: false,
    // Isi pesan pribadi tidak dicatat ke log secara default (privasi).
    logMessageContent: envBool('BOT_LOG_CONTENT', false)
  },

  // ------------------------------------------------------------------ logger
  logger: {
    level: env('LOG_LEVEL', 'info'),             // error | warn | info | debug
    file: env('LOG_FILE', 'library/database/logs/yannajah.log'),
    baileysLevel: env('BAILEYS_LOG_LEVEL', 'silent')
  },

  // ------------------------------------------------------------------ pairing WhatsApp
  pairing: {
    // 'ask' = tanya di terminal, 'qr' = QR code, 'pairing' = pairing code via nomor telepon.
    // Flag CLI --qr / --pairing-code menimpa nilai ini.
    method: env('PAIRING_METHOD', 'ask'),
    // Nomor bot untuk pairing code (opsional, kalau kosong ditanya di terminal).
    phoneNumber: env('PAIRING_NUMBER', ''),
    // Custom pairing code (tepat 8 karakter huruf/angka). V15: global.custompairing.
    customCode: env('PAIRING_CUSTOM_CODE', 'YANNAJAH'),
    sessionDir: env('SESSION_DIR', 'session'),
    qrMaxRefresh: envInt('PAIRING_QR_MAX_REFRESH', 6),
    pairingTimeoutMs: envInt('PAIRING_TIMEOUT_MS', 180000),
    browser: ['Ubuntu', 'Chrome', '22.04.4'],
    reconnect: { maxAttempts: envInt('RECONNECT_MAX', 12), baseDelayMs: 3000, maxDelayMs: 60000 },
    // V15 otomatis follow saluran tanpa tanya. Di sini harus dinyalakan sendiri (default mati).
    followChannelOnConnect: envBool('FOLLOW_CHANNEL', false)
  },

  // ------------------------------------------------------------------ autentikasi lisensi pusat
  license: {
    // URL website lisensi (server/). Wajib HTTPS kecuali localhost untuk development.
    // Di build distribusi dengan --license-url, alamat tertanam di library/license-endpoint.js dipakai.
    serverUrl: (e => (e.locked && e.url ? e.url : env('LICENSE_SERVER_URL', 'http://127.0.0.1:8787')))(require('./library/license-endpoint')),
    instanceName: env('BOT_INSTANCE_NAME', 'yannajah-main'),
    tokenFile: env('LICENSE_TOKEN_FILE', 'library/database/license-session.json'),
    heartbeatMinutes: envInt('LICENSE_HEARTBEAT_MINUTES', 10),
    requestTimeoutMs: envInt('LICENSE_TIMEOUT_MS', 15000),
    // 0 = gagal aman: kalau server lisensi tidak bisa dihubungi, fitur utama tidak aktif.
    offlineGraceMinutes: envInt('LICENSE_OFFLINE_GRACE_MINUTES', 0),
    maxPasswordAttempts: 3
  },

  // ------------------------------------------------------------------ database lokal bot
  database: {
    // V15: global.tempatDB = 'database.json'
    file: env('BOT_DB_FILE', 'database.json'),
    dir: 'library/database',
    saveIntervalMs: envInt('BOT_DB_SAVE_MS', 30000)
  },

  // ------------------------------------------------------------------ API
  api: {
    apiz2z: {
      baseUrl: env('APIZ2Z_BASE_URL', 'https://apiz2z.web.id'),
      // Key dikirim lewat header Authorization: Bearer (tidak lewat URL).
      apiKey: env('APIZ2Z_API_KEY', ''),
      // Host lain yang boleh dihubungi API manager (anti-SSRF). Host baseUrl selalu diizinkan.
      allowedHosts: envList('APIZ2Z_ALLOWED_HOSTS', ['apiz2z.web.id', 'cdn.apiz2z.web.id', 'apiz2z.vercel.app']),
      timeoutMs: envInt('APIZ2Z_TIMEOUT_MS', 60000),
      retries: envInt('APIZ2Z_RETRIES', 2),
      perMinute: envInt('APIZ2Z_PER_MINUTE', 60),
      concurrency: envInt('APIZ2Z_CONCURRENCY', 4),
      maxResponseBytes: envInt('APIZ2Z_MAX_RESPONSE_BYTES', 16 * 1024 * 1024),
      cacheTtlMs: envInt('APIZ2Z_CACHE_TTL_MS', 5 * 60 * 1000)
    }
  },

  // ------------------------------------------------------------------ plugin
  plugin: {
    dir: 'plugins',
    // Plugin legacy (format handler.command) dari V15/base tetap bisa dipakai lewat adapter.
    enableLegacy: true,
    hotReload: envBool('PLUGIN_HOT_RELOAD', false),
    disabled: envList('DISABLED_FEATURES'),
    // plugins/external/*.js hanya dimuat kalau SHA-256 file-nya terdaftar di sini: { 'nama.js': '<sha256>' }
    trustedExternal: {}
  },

  // ------------------------------------------------------------------ media
  media: {
    tmpDir: 'library/database/sampah',
    maxDownloadBytes: envInt('MEDIA_MAX_BYTES', 50 * 1024 * 1024),
    maxUploadBytes: 8 * 1024 * 1024,     // batas upload endpoint APIZ2Z
    downloadTimeoutMs: 45000,
    ffmpegPath: env('FFMPEG_PATH', 'ffmpeg'),
    // Batas CPU untuk VPS bersama: berapa ffmpeg boleh jalan bersamaan & thread per proses
    // (dibaca library/media.js dari env MEDIA_MAX_CONCURRENT / FFMPEG_THREADS)
    maxConcurrent: envInt('MEDIA_MAX_CONCURRENT', 1),
    ffmpegThreads: envInt('FFMPEG_THREADS', 1)
  },

  // ------------------------------------------------------------------ limit & premium (V15)
  limit: {
    daily: envInt('LIMIT_HARIAN', 10),        // V15: global.limitHarian
    premiumUnlimited: true,
    warnBeforeKick: envInt('WARN_GRUP', 3),   // V15: global.warnGrup
    cooldownSeconds: 3,
    spamWindowMs: 8000,
    spamMaxCommands: 6
  },

  // ------------------------------------------------------------------ permission
  permission: {
    // level: user < premium < admin(grup) < owner
    registerRequired: envBool('REGISTER_REQUIRED', false),
    allowEvalForOwner: false   // eval/exec dari chat dimatikan secara default
  },

  cache: { groupMetadataTtlMs: 5 * 60 * 1000, messageCacheSize: 500 },
  concurrency: { commandsPerUser: 2, globalCommands: 24 },
  retry: { sendMessage: 2 },
  timeout: { commandMs: 120000 },

  // ------------------------------------------------------------------ dashboard / backend (server/)
  dashboard: {
    host: env('DASHBOARD_HOST', '127.0.0.1'),
    port: envInt('DASHBOARD_PORT', 8787),
    dbFile: env('DASHBOARD_DB_FILE', 'server/data/yannajah-auth.db'),
    trustProxy: envBool('DASHBOARD_TRUST_PROXY', false),
    botSessionDays: envInt('BOT_SESSION_DAYS', 30),
    adminSessionHours: envInt('ADMIN_SESSION_HOURS', 12),
    bcryptCost: envInt('BCRYPT_COST', 12)
  },

  // ------------------------------------------------------------------ harga & sewa (V15)
  harga: { prem: '5000', sewa: '10000' },
  sewa: { bulan1: 10000, bulan3: 25000, bulan6: 45000, bulan12: 80000 },

  // ------------------------------------------------------------------ link & tautan (V15)
  links: {
    owner: env('LINK_OWNER', 'https://wa.me/6281249703469'),
    group: env('LINK_GROUP', 'https://chat.whatsapp.com/BqJAqcdEjijJHrIWHNr1la'),
    channel: env('LINK_CHANNEL', 'https://whatsapp.com/channel/0029VbCBj0N3LdQTosP3Hj0T'),
    channelId: env('CHANNEL_ID', '120363409375529920@newsletter'),
    channelName: env('CHANNEL_NAME', '# cenel inpo ꜱᴇɪʜᴀ - ᴍᴅ')
  },
  payment: {
    dana: env('PAY_DANA', ''),
    gopay: env('PAY_GOPAY', ''),
    qris: env('PAY_QRIS_URL', 'https://files.catbox.moe/o77sec.png')
  },
  delay: { jpm: 3000 },

  // ------------------------------------------------------------------ gambar (V15)
  image: {
    menu: 'https://cdn-alip.clutch.web.id/api/u/mtmyjmca.jpg',
    menuv3: 'https://cdn-alip.clutch.web.id/api/u/mr8s2q9m.jpg',
    welcome: 'https://files.catbox.moe/3fh8c6.jpg',
    left: 'https://files.catbox.moe/3fh8c6.jpg',
    reply: 'https://cdn-alip.clutch.web.id/api/u/mtmyi1fe.jpg',
    qris: 'https://files.catbox.moe/o77sec.png'
  },

  // ------------------------------------------------------------------ pesan sistem (V15 global.mess)
  mess: {
    limit: '🔔 𝗟𝗶𝗺𝗶𝘁 𝗛𝗮𝗯𝗶𝘀\nSilakan ketik *.claim* untuk klaim bonus limit harian\nAtau hubungi owner untuk upgrade ke Premium.',
    owner: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya tersedia untuk *Owner Bot*.',
    verifikasi: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nDaftar dulu dengan *.daftar nama,umur* untuk mengakses fitur bot.',
    admin: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini khusus untuk *Admin Grup*.',
    botAdmin: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nBot harus menjadi *Admin Grup* untuk menjalankan fitur ini.',
    group: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya dapat digunakan di dalam *Grup*.',
    private: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya dapat digunakan di *Chat Pribadi*.',
    prem: '🚫 𝗔𝗸𝘀𝗲𝘀 𝗗𝗶𝘁𝗼𝗹𝗮𝗸\nFitur ini hanya tersedia untuk *User Premium*.',
    wait: '⏳ 𝗖𝗼𝘁𝘁𝗼 𝗠𝗮𝘁𝘁𝗲...\nPermintaan sedang diproses.',
    error: '❌ 𝗧𝗲𝗿𝗷𝗮𝗱𝗶 𝗸𝗲𝘀𝗮𝗹𝗮𝗵𝗮𝗻\nSilakan coba kembali beberapa saat lagi.',
    done: '✅ 𝗕𝗲𝗿𝗵𝗮𝘀𝗶𝗹\nProses telah diselesaikan.',
    cooldown: '⏱️ Tunggu {s} detik sebelum memakai command lagi.',
    disabled: '⛔ Fitur ini sedang dinonaktifkan.',
    needApiKey: '🔑 Fitur ini butuh API key APIZ2Z. Owner perlu mengisi APIZ2Z_API_KEY.',
    unlicensed: '🔒 Bot belum terverifikasi oleh server lisensi. Hubungi owner.'
  }
};
