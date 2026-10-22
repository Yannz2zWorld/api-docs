'use strict';
// Backup logis terenkripsi (AES-256-GCM, kunci dari scrypt(BACKUP_ENCRYPTION_KEY)).
// Isi: ranks (kuota), rank_permissions, accounts, bots, bot_credentials (hash saja), maintenance, audit_logs.
// Sesi (dashboard/bot) sengaja TIDAK di-backup: setelah restore semua orang login ulang.
//
// Restore hanya ke database KOSONG yang sudah dimigrasi (tidak menimpa data nyata). Prosedur aman:
//   buat database baru -> migrate -> restore -> uji -> arahkan DATABASE_URL ke database baru.
// Untuk production, backup fisik `pg_dump` terjadwal tetap disarankan (lihat docs/DEPLOYMENT.md).

const crypto = require('crypto');

const FORMAT = 'yannajah-backup';
const VERSION = 1;

function keyFrom(passphrase, salt) {
  if (typeof passphrase !== 'string' || passphrase.length < 16) {
    const e = new Error('BACKUP_ENCRYPTION_KEY minimal 16 karakter.'); e.code = 'BACKUP_KEY_MISSING'; throw e;
  }
  return crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 });
}

function encrypt(obj, passphrase) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyFrom(passphrase, salt), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  return JSON.stringify({ format: FORMAT, version: VERSION, kdf: 'scrypt', salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') });
}

function decrypt(text, passphrase) {
  let env;
  try { env = JSON.parse(text); } catch { const e = new Error('File backup rusak.'); e.code = 'BACKUP_INVALID'; throw e; }
  if (env.format !== FORMAT || env.version !== VERSION) { const e = new Error('Format backup tidak dikenal.'); e.code = 'BACKUP_INVALID'; throw e; }
  try {
    const d = crypto.createDecipheriv('aes-256-gcm', keyFrom(passphrase, Buffer.from(env.salt, 'base64')), Buffer.from(env.iv, 'base64'));
    d.setAuthTag(Buffer.from(env.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8'));
  } catch (e) {
    if (e.code === 'BACKUP_KEY_MISSING') throw e;
    const x = new Error('Kunci backup salah atau file diubah.'); x.code = 'BACKUP_DECRYPT_FAILED'; throw x;
  }
}

const TABLES = ['ranks', 'rank_permissions', 'accounts', 'bots', 'bot_credentials', 'maintenance_settings', 'audit_logs'];

async function exportData(db) {
  const out = { exported_at: new Date().toISOString(), tables: {} };
  await db.withTransaction(async tx => {
    for (const t of TABLES) out.tables[t] = await tx.query(`SELECT * FROM ${t} ORDER BY 1`);
  }, { isolation: 'REPEATABLE READ' });   // snapshot konsisten
  out.counts = Object.fromEntries(Object.entries(out.tables).map(([k, v]) => [k, v.length]));
  return out;
}

async function insertRows(tx, table, rows, { omit = [] } = {}) {
  for (const r of rows) {
    const cols = Object.keys(r).filter(c => !omit.includes(c));
    const vals = cols.map(c => (r[c] !== null && typeof r[c] === 'object' && !(r[c] instanceof Date) && !Array.isArray(r[c]) ? JSON.stringify(r[c]) : r[c]));
    await tx.query(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((_, i) => '$' + (i + 1)).join(',')})`, vals);
  }
}

async function restoreData(db, data) {
  if (!data?.tables || !TABLES.every(t => Array.isArray(data.tables[t]))) { const e = new Error('Isi backup tidak lengkap.'); e.code = 'BACKUP_INVALID'; throw e; }
  return db.withTransaction(async tx => {
    const existing = Number((await tx.query('SELECT (SELECT count(*) FROM accounts) + (SELECT count(*) FROM bots) AS n'))[0].n);
    if (existing > 0) { const e = new Error('Database tujuan tidak kosong. Restore hanya ke database baru yang sudah dimigrasi.'); e.code = 'RESTORE_TARGET_NOT_EMPTY'; throw e; }
    const T = data.tables;
    for (const r of T.ranks) await tx.query('UPDATE ranks SET max_numbers = $2, max_managed_users = $3, assignable = $4, description = $5 WHERE code = $1', [r.code, r.max_numbers, r.max_managed_users, r.assignable, r.description]);
    await tx.query('DELETE FROM rank_permissions');
    await insertRows(tx, 'rank_permissions', T.rank_permissions);
    // FK ke accounts sendiri diisi setelah semua baris masuk.
    const selfRefs = ['manager_id', 'created_by', 'status_changed_by', 'deleted_by'];
    await insertRows(tx, 'accounts', T.accounts, { omit: selfRefs });
    for (const a of T.accounts) await tx.query('UPDATE accounts SET manager_id = $2, created_by = $3, status_changed_by = $4, deleted_by = $5 WHERE id = $1', [a.id, a.manager_id, a.created_by, a.status_changed_by, a.deleted_by]);
    await insertRows(tx, 'bots', T.bots);
    await insertRows(tx, 'bot_credentials', T.bot_credentials);
    for (const m of T.maintenance_settings) await tx.query('UPDATE maintenance_settings SET enabled = $1, message = $2, exempt_ranks = $3, updated_by = $4, updated_at = $5 WHERE id = 1', [m.enabled, m.message, m.exempt_ranks, m.updated_by, m.updated_at]);
    await insertRows(tx, 'audit_logs', T.audit_logs);
    for (const t of ['accounts', 'bots', 'audit_logs']) {
      await tx.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM ${t}), 1))`);
    }
    await tx.query("INSERT INTO audit_logs (actor_type, action, details) VALUES ('cli', 'backup.restore', $1)", [JSON.stringify({ exported_at: data.exported_at, counts: data.counts })]);
    return Object.fromEntries(TABLES.map(t => [t, T[t].length]));
  });
}

module.exports = { encrypt, decrypt, exportData, restoreData, TABLES };
