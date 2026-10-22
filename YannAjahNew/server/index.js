'use strict';
// Menjalankan backend lisensi + dashboard: `npm run dashboard`.
// Menolak start kalau konfigurasi tidak valid atau masih ada migrasi yang belum diterapkan.

const { buildServerConfig } = require('./config');
const { createDb } = require('./lib/db');
const { pending } = require('./lib/migrate');
const { createApp } = require('./app');

async function main() {
  const cfg = buildServerConfig();
  const db = createDb({ connectionString: cfg.databaseUrl, schema: cfg.databaseSchema });
  const waiting = await pending(db);
  if (waiting.length) {
    console.error(`Ada ${waiting.length} migrasi belum diterapkan (${waiting.join(', ')}). Jalankan: npm run migrate`);
    process.exit(1);
  }
  const app = createApp({ db, cfg });
  const server = app.listen(cfg.port, cfg.host, () => {
    console.log(`YannAjahNew dashboard berjalan di ${cfg.publicUrl} (listen ${cfg.host}:${cfg.port})${cfg.googleEnabled ? '' : ' — Google OAuth belum dikonfigurasi'}`);
  });
  // Graceful shutdown: berhenti menerima koneksi, selesaikan request, tutup pool database.
  let closing = false;
  const shutdown = sig => {
    if (closing) return; closing = true;
    console.log(`${sig} diterima, mematikan server...`);
    server.close(() => db.close().finally(() => process.exit(0)));
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(e => {
  console.error(e.code === 'SERVER_CONFIG_INVALID' ? e.message : `Gagal start: ${e.code || e.message}`);
  process.exit(1);
});
