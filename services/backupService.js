'use strict';
// Backups for the Developer Panel and the daily automatic backup.
//   database  yannz-db-<date>.sql      every table, every row, as INSERT statements. Restore into an
//                                      empty database: run migrations/*.sql first, then this file.
//   json      yannz-db-<date>.json     the same data as JSON: easy to open and read, not for restoring.
//   web       yannz-web-<date>.zip     the website's source code (the GitHub repo: GITHUB_TOKEN,
//                                      GITHUB_REPO, GITHUB_BRANCH as for the plugin upload).
// sendToOwner() emails all three as attachments to BACKUP_EMAIL (default: OWNER_EMAIL) through
// services/emailService.js.
// API keys are only ever stored as hashes, so no backup contains a usable key; it does contain
// password hashes and account data, so it is only for the developer.
const zlib = require('zlib');
const { promisify } = require('util');
const { query } = require('../lib/db');
const emailService = require('./emailService');
const gzip = promisify(zlib.gzip);

const DEFAULT_REPO = 'Yannz2zWorld/api-docs';
const today = () => new Date().toISOString().slice(0, 10);
const qi = name => `"${String(name).replace(/"/g, '""')}"`;
const lit = v => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// Tables of the current schema, parents before children (foreign keys), so the INSERTs restore in order.
async function tableOrder() {
  const tables = (await query("SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' ORDER BY table_name")).map(r => r.table_name);
  const deps = await query(`SELECT c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
     WHERE c.contype = 'f' AND n.nspname = current_schema()`);
  const plain = s => s.replace(/^.*\./, '').replace(/^"|"$/g, '');
  const parents = new Map(tables.map(t => [t, new Set()]));
  for (const d of deps) { const c = plain(d.child), p = plain(d.parent); if (c !== p && parents.has(c) && parents.has(p)) parents.get(c).add(p); }
  const out = [], seen = new Set();
  const visit = (t, path = new Set()) => {
    if (seen.has(t) || path.has(t)) return;
    path.add(t);
    for (const p of parents.get(t)) visit(p, path);
    seen.add(t); out.push(t);
  };
  tables.forEach(t => visit(t));
  return out;
}

// { generatedAt, tables: [{ name, columns, serial: [col], pk: [col], rows: [[text|null]] }] } with every value as
// Postgres prints it (::text), so timestamps, json, arrays and numbers come back exactly.
async function readDatabase() {
  const tables = [];
  for (const name of await tableOrder()) {
    const cols = await query("SELECT column_name, column_default FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position", [name]);
    const columns = cols.map(c => c.column_name);
    const serial = cols.filter(c => /^nextval\(/.test(c.column_default || '')).map(c => c.column_name);
    const pk = (await query(`SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
        WHERE i.indisprimary AND i.indrelid = (quote_ident(current_schema()) || '.' || quote_ident($1))::regclass`, [name])).map(r => r.attname);
    const rows = await query(`SELECT ${columns.map((c, i) => `${qi(c)}::text AS c${i}`).join(', ')} FROM ${qi(name)}`);
    tables.push({ name, columns, serial, pk, rows: rows.map(r => columns.map((_, i) => r[`c${i}`])) });
  }
  return { generatedAt: new Date().toISOString(), tables };
}

function toSql(db) {
  const lines = [
    `-- Yannz API database backup, ${db.generatedAt}`,
    '-- Cara restore ke database kosong (mis. project Neon baru):',
    '--   1. jalankan semua migrations/*.sql (urut 001, 002, ...) dari backup file web',
    '--   2. jalankan file ini di SQL Editor Neon / psql',
    '-- Baris dengan ID yang sama ditimpa isi backup, jadi aman dijalankan ulang.',
    '-- Jalankan SEBELUM DATABASE_URL di Vercel diarahkan ke database baru.',
    'BEGIN;'
  ];
  for (const t of db.tables) {
    lines.push('', `-- ${t.name}: ${t.rows.length} baris`);
    const head = `INSERT INTO ${qi(t.name)} (${t.columns.map(qi).join(', ')}) VALUES `;
    // Same primary key already there (e.g. the server_settings row the migrations create): take the backup's values.
    const rest = t.columns.filter(c => !(t.pk || []).includes(c));
    const tail = t.pk?.length && rest.length ? ` ON CONFLICT (${t.pk.map(qi).join(', ')}) DO UPDATE SET ${rest.map(c => `${qi(c)} = EXCLUDED.${qi(c)}`).join(', ')};` : ' ON CONFLICT DO NOTHING;';
    for (const row of t.rows) lines.push(`${head}(${row.map(lit).join(', ')})${tail}`);
    for (const c of t.serial) {
      lines.push(`SELECT setval(pg_get_serial_sequence(${lit(qi(t.name))}, ${lit(c)}), GREATEST(COALESCE((SELECT max(${qi(c)}) FROM ${qi(t.name)}), 0), 1));`);
    }
  }
  lines.push('', 'COMMIT;', '');
  return lines.join('\n');
}

function toJson(db) {
  const data = {};
  for (const t of db.tables) data[t.name] = t.rows.map(r => Object.fromEntries(t.columns.map((c, i) => [c, r[i]])));
  return JSON.stringify({ generatedAt: db.generatedAt, version: 2, counts: Object.fromEntries(db.tables.map(t => [t.name, t.rows.length])), data }, null, 1);
}

// { filename, contentType, raw: Buffer, tables, rows }. Downloads send `raw` gzip-encoded on the wire
// (the browser saves the plain file); emails attach it as is when small, else as .gz.
async function databaseBackup(db) {
  db = db || await readDatabase();
  return { filename: `yannz-db-${today()}.sql`, contentType: 'application/sql; charset=utf-8', raw: Buffer.from(toSql(db)), tables: db.tables.length, rows: db.tables.reduce((n, t) => n + t.rows.length, 0) };
}
async function jsonBackup(db) {
  db = db || await readDatabase();
  return { filename: `yannz-db-${today()}.json`, contentType: 'application/json; charset=utf-8', raw: Buffer.from(toJson(db)), tables: db.tables.length, rows: db.tables.reduce((n, t) => n + t.rows.length, 0) };
}

const github = () => ({ token: process.env.GITHUB_TOKEN || '', repo: process.env.GITHUB_REPO || DEFAULT_REPO, branch: process.env.GITHUB_BRANCH || 'main' });
const ghHeaders = token => ({ Accept: 'application/vnd.github+json', 'User-Agent': 'yannz-api-backup', 'X-GitHub-Api-Version': '2022-11-28', ...(token ? { Authorization: `Bearer ${token}` } : {}) });
const webError = (status, code, message) => Object.assign(new Error(message), { status, code });

// Short-lived download link for the source zip (GitHub answers with a redirect to codeload).
async function webZipUrl() {
  const { token, repo, branch } = github();
  let r;
  try {
    r = await fetch(`https://api.github.com/repos/${repo}/zipball/${encodeURIComponent(branch)}`, { headers: ghHeaders(token), redirect: 'manual', signal: AbortSignal.timeout(20000) });
  } catch { throw webError(502, 'GITHUB_UNREACHABLE', 'GitHub lagi nggak bisa dihubungi. Coba lagi bentar.'); }
  const location = r.headers.get('location');
  if (r.status >= 300 && r.status < 400 && location) return location;
  if (r.status === 404) throw webError(503, token ? 'GITHUB_REPO_NOT_FOUND' : 'GITHUB_NOT_CONFIGURED', token ? 'Repo/branch GitHub nggak ketemu. Cek GITHUB_REPO dan GITHUB_BRANCH.' : 'Repo-nya private, jadi isi dulu GITHUB_TOKEN (izin Contents: read) di Environment Variables Vercel.');
  if (r.status === 401 || r.status === 403) throw webError(503, 'GITHUB_AUTH', 'GITHUB_TOKEN ditolak GitHub. Cek tokennya masih aktif dan punya akses ke repo ini.');
  throw webError(502, 'GITHUB_ERROR', `GitHub nolak permintaan backup (HTTP ${r.status}).`);
}

async function webBackup() {
  const url = await webZipUrl();
  let r;
  try { r = await fetch(url, { signal: AbortSignal.timeout(60000) }); } catch { throw webError(502, 'GITHUB_UNREACHABLE', 'Gagal ngunduh file web dari GitHub.'); }
  if (!r.ok) throw webError(502, 'GITHUB_ERROR', `Gagal ngunduh file web dari GitHub (HTTP ${r.status}).`);
  return { filename: `yannz-web-${today()}.zip`, contentType: 'application/zip', raw: Buffer.from(await r.arrayBuffer()), zipped: true };
}

// Gmail takes up to 25 MB per email, and attachments grow by a third when encoded.
const EMAIL_LIMIT = 18 * 1024 * 1024;
const ATTACH_PLAIN_LIMIT = 4 * 1024 * 1024;   // bigger files are attached gzipped (.gz)
const mb = n => `${(n / 1024 / 1024).toFixed(2)} MB`;

// Builds all three backups and emails them to backupRecipient(). A part that fails (e.g. GitHub not set
// up) is reported in the email and the result instead of stopping the others.
// Where backups go: BACKUP_EMAIL if set, else the developer's OWNER_EMAIL.
const backupRecipient = () => String(process.env.BACKUP_EMAIL || process.env.OWNER_EMAIL || '').trim();

async function sendToOwner({ reason = 'manual' } = {}) {
  const to = backupRecipient();
  if (!to) throw webError(503, 'OWNER_EMAIL_MISSING', 'Isi BACKUP_EMAIL (atau OWNER_EMAIL) dulu di Environment Variables.');
  if (!emailService.isConfigured()) throw webError(503, 'EMAIL_NOT_CONFIGURED', 'Email belum aktif: isi EMAIL_FROM + SMTP (Gmail App Password) atau RESEND_API_KEY di Vercel.');

  const parts = [];
  let db = null;
  try { db = await readDatabase(); } catch { db = null; }
  const fromDb = make => async () => { if (!db) throw new Error('db'); return make(db); };
  for (const [label, make] of [['Database (.sql)', fromDb(databaseBackup)], ['Database (JSON)', fromDb(jsonBackup)], ['File web', webBackup]]) {
    try { parts.push({ label, ...(await make()) }); } catch (e) { parts.push({ label, error: e.status ? e.message : 'Gagal dibuat.' }); }
  }
  let total = 0;
  for (const p of parts) {
    if (p.error) continue;
    p.content = p.raw;
    if (!p.zipped && p.raw.length > ATTACH_PLAIN_LIMIT) { p.content = await gzip(p.raw, { level: 9 }); p.filename += '.gz'; p.contentType = 'application/gzip'; }
    if (total + p.content.length > EMAIL_LIMIT) { p.error = `Kebesaran buat lampiran email (${mb(p.content.length)}), unduh langsung dari Developer Panel.`; continue; }
    total += p.content.length;
    p.attached = true;
  }
  const attached = parts.filter(p => p.attached);
  if (!attached.length) throw webError(502, 'BACKUP_FAILED', 'Semua backup gagal dibuat: ' + parts.map(p => `${p.label}: ${p.error}`).join(' · '));

  const when = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'short' });
  const lines = parts.map(p => (p.attached ? `✔ ${p.label}: ${p.filename} (${mb(p.content.length)}${p.rows != null ? `, ${p.tables} tabel, ${p.rows} baris` : ''})` : `✘ ${p.label}: ${p.error}`));
  const text = [`Halo! Ini backup Yannz API ${reason === 'cron' ? 'otomatis harian' : 'yang kamu minta dari Developer Panel'}.`, `Dibuat: ${when} WIB`, '', ...lines, '',
    'Cara balikin database kalau ada apa-apa:', '1. Bikin database baru (mis. project Neon baru), jalankan semua migrations/*.sql dari zip file web.', '2. Jalankan isi yannz-db-*.sql (kalau .sql.gz, ekstrak dulu) di SQL Editor Neon.', '3. Ganti DATABASE_URL di Vercel ke database baru, lalu redeploy.', '',
    'Simpan email ini baik-baik dan jangan diteruskan ke siapa pun: isinya data akun.', '— YannApi'].join('\n');
  const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#111">${text.split('\n').map(l => (l ? esc(l) : '&nbsp;')).join('<br>')}</div>`;
  await emailService.sendMail({ to, subject: `Backup Yannz API — ${today()}`, text, html, attachments: attached.map(p => ({ filename: p.filename, content: p.content, contentType: p.contentType })) });
  return { to, parts: parts.map(p => ({ label: p.label, filename: p.filename || null, size: p.content?.length || 0, attached: !!p.attached, error: p.error || null })) };
}

module.exports = { backupRecipient, readDatabase, toSql, toJson, databaseBackup, jsonBackup, webZipUrl, webBackup, sendToOwner, gzip, EMAIL_LIMIT };
