'use strict';
// Runner migrasi: menerapkan server/migrations/*.sql berurutan, satu transaksi per file,
// mencatat checksum di schema_migrations. Menolak jalan kalau file yang SUDAH diterapkan berubah
// (mencegah migrasi diam-diam diubah setelah production). Advisory lock mencegah dua proses
// menjalankan migrasi bersamaan.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'migrations');
const LOCK_KEY = 74311579;   // angka tetap untuk pg_advisory_xact_lock

function listMigrations(dir = DIR) {
  return fs.readdirSync(dir).filter(f => /^\d{3}_[a-z0-9_]+\.sql$/.test(f)).sort().map(name => {
    const sql = fs.readFileSync(path.join(dir, name), 'utf8');
    return { name, sql, checksum: crypto.createHash('sha256').update(sql).digest('hex') };
  });
}

async function migrate(db, { dir = DIR, log = () => {} } = {}) {
  return db.withTransaction(async tx => {
    await tx.query('SELECT pg_advisory_xact_lock($1)', [LOCK_KEY]);
    await tx.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
    const applied = new Map((await tx.query('SELECT name, checksum FROM schema_migrations')).map(r => [r.name, r.checksum]));
    const done = [];
    for (const m of listMigrations(dir)) {
      if (applied.has(m.name)) {
        if (applied.get(m.name) !== m.checksum) {
          const e = new Error(`Migrasi ${m.name} sudah diterapkan tetapi isinya berubah. Buat migrasi baru, jangan ubah yang lama.`);
          e.code = 'MIGRATION_CHECKSUM_MISMATCH';
          throw e;
        }
        continue;
      }
      await tx.query(m.sql);
      await tx.query('INSERT INTO schema_migrations (name, checksum) VALUES ($1, $2)', [m.name, m.checksum]);
      log(`✔ migrasi ${m.name}`);
      done.push(m.name);
    }
    return done;
  });
}

async function pending(db, { dir = DIR } = {}) {
  const exists = (await db.query("SELECT to_regclass('schema_migrations') AS t"))[0].t;
  const applied = exists ? new Set((await db.query('SELECT name FROM schema_migrations')).map(r => r.name)) : new Set();
  return listMigrations(dir).filter(m => !applied.has(m.name)).map(m => m.name);
}

module.exports = { migrate, pending, listMigrations };
