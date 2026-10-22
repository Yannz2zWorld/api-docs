#!/usr/bin/env node
'use strict';
// CLI administrasi server (butuh akses shell ke server = prosedur administratif khusus).
// Semua aksi tercatat di audit_logs dengan actor_type 'cli'. Tidak ada credential yang dicetak,
// kecuali link login sekali pakai yang memang diminta (berlaku 15 menit).
//
//   node server/cli.js migrate
//   node server/cli.js status
//   node server/cli.js bootstrap-developer --username yann --email kamu@gmail.com
//   node server/cli.js grant-developer --username yann --confirm yann
//   node server/cli.js revoke-developer --username yann --to CEO --confirm yann
//   node server/cli.js login-link --username yann
//   node server/cli.js set-bot-password --phone 6281234567890
//   node server/cli.js backup --out backup.json.enc
//   node server/cli.js restore --in backup.json.enc --confirm-empty
//   node server/cli.js purge --days 90

const fs = require('fs');
const readline = require('readline');
const { buildServerConfig } = require('./config');
const { createDb } = require('./lib/db');
const { migrate, pending } = require('./lib/migrate');
const v = require('./lib/validate');
const { hashPassword } = require('./lib/security');
const audit = require('./services/auditService');
const links = require('./services/loginLinkService');
const backup = require('./services/backupService');

function args() {
  const out = { _: [] };
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); out[k] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; }
    else out._.push(a[i]);
  }
  return out;
}

function askHidden(prompt) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = s => { if (s.includes(prompt)) rl.output.write(s); else rl.output.write('*'); };
    rl.question(prompt, answer => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const fail = msg => { console.error('✖ ' + msg); process.exit(1); };

async function findAccount(db, username) {
  const a = (await db.query('SELECT id, username, rank_code, status FROM accounts WHERE username = $1 AND deleted_at IS NULL', [v.username(username)]))[0];
  if (!a) fail(`Akun ${username} tidak ditemukan`);
  return { ...a, id: Number(a.id) };
}

async function main() {
  const o = args();
  const cmd = o._[0];
  if (!cmd || cmd === 'help') { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter(l => l.startsWith('//   ')).map(l => l.slice(5)).join('\n')); return; }
  const cfg = buildServerConfig();
  const db = createDb({ connectionString: cfg.databaseUrl, schema: cfg.databaseSchema, max: 2 });
  try {
    switch (cmd) {
      case 'migrate': {
        const done = await migrate(db, { log: console.log });
        console.log(done.length ? `Selesai: ${done.length} migrasi diterapkan.` : 'Database sudah terbaru.');
        break;
      }
      case 'status': {
        const p = await pending(db);
        console.log(p.length ? `Migrasi tertunda: ${p.join(', ')}` : 'Tidak ada migrasi tertunda.');
        break;
      }
      case 'bootstrap-developer': {
        const username = v.username(o.username);
        const email = v.email(o.email, { optional: false });
        await db.withTransaction(async tx => {
          await tx.query('LOCK TABLE accounts IN SHARE ROW EXCLUSIVE MODE');
          const exists = (await tx.query("SELECT count(*)::int AS n FROM accounts WHERE rank_code = 'DEVELOPER' AND deleted_at IS NULL"))[0].n;
          if (exists) fail('Sudah ada DEVELOPER. Pakai grant-developer untuk akun lain.');
          const id = Number((await tx.query("INSERT INTO accounts (username, display_name, email, rank_code) VALUES ($1,$2,$3,'DEVELOPER') RETURNING id", [username, String(o['display-name'] || username).slice(0, 80), email]))[0].id);
          await audit.write(tx, { actorType: 'cli', action: 'account.bootstrap_developer', targetType: 'account', targetId: id, details: { username } });
          console.log(`✔ DEVELOPER ${username} dibuat (id ${id}). Login dengan Google memakai ${email}, atau: node server/cli.js login-link --username ${username}`);
        });
        break;
      }
      case 'grant-developer':
      case 'revoke-developer': {
        if (o.confirm !== o.username) fail('Konfirmasi wajib: --confirm <username yang sama>');
        const a = await findAccount(db, o.username);
        const to = cmd === 'grant-developer' ? 'DEVELOPER' : v.rank(o.to || 'CEO');
        if (cmd === 'revoke-developer' && (a.rank_code !== 'DEVELOPER' || to === 'DEVELOPER')) fail('Akun ini bukan DEVELOPER / rank tujuan tidak valid.');
        await db.withTransaction(async tx => {
          if (cmd === 'revoke-developer') {
            const others = (await tx.query("SELECT count(*)::int AS n FROM accounts WHERE rank_code = 'DEVELOPER' AND deleted_at IS NULL AND id <> $1", [a.id]))[0].n;
            if (!others) fail('Tidak bisa mencabut DEVELOPER terakhir.');
          }
          await tx.query('UPDATE accounts SET rank_code = $1, updated_at = now() WHERE id = $2', [to, a.id]);
          await audit.write(tx, { actorType: 'cli', action: cmd === 'grant-developer' ? 'account.grant_developer' : 'account.revoke_developer', targetType: 'account', targetId: a.id, details: { from: a.rank_code, to } });
        });
        console.log(`✔ ${a.username}: ${a.rank_code} -> ${to}`);
        break;
      }
      case 'login-link': {
        const a = await findAccount(db, o.username);
        if (a.status !== 'active') fail('Akun tidak aktif.');
        const token = await links.create(db, a.id);
        console.log(`Link login sekali pakai (15 menit, jangan dibagikan):\n${cfg.publicUrl}/auth/link?token=${token}`);
        break;
      }
      case 'set-bot-password': {
        const phone = v.phone(o.phone);
        const bot = (await db.query('SELECT id, bot_name FROM bots WHERE phone_number = $1 AND deleted_at IS NULL', [phone]))[0];
        if (!bot) fail('Bot dengan nomor itu tidak terdaftar.');
        const p1 = await askHidden('Password bot baru: ');
        const p2 = await askHidden('Ulangi password: ');
        if (p1 !== p2) fail('Password tidak sama.');
        const hash = await hashPassword(v.botPassword(p1), cfg.bcryptCost);
        await db.withTransaction(async tx => {
          await tx.query(`INSERT INTO bot_credentials (bot_id, password_hash, set_via) VALUES ($1,$2,'cli')
            ON CONFLICT (bot_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, set_by = NULL, set_via = 'cli', updated_at = now(), failed_attempts = 0, locked_until = NULL`, [bot.id, hash]);
          const n = (await tx.query("UPDATE bot_sessions SET revoked_at = now(), revoked_reason = 'password_reset' WHERE bot_id = $1 AND revoked_at IS NULL RETURNING id", [bot.id])).length;
          await audit.write(tx, { actorType: 'cli', action: 'bot.credential.reset', targetType: 'bot', targetId: Number(bot.id), details: { via: 'cli', revoked_sessions: n } });
        });
        console.log(`✔ Password bot ${bot.bot_name} diperbarui. Sesi lama dicabut.`);
        break;
      }
      case 'backup': {
        if (!o.out) fail('--out <file> wajib');
        const data = await backup.exportData(db);
        fs.writeFileSync(o.out, backup.encrypt(data, cfg.backupKey), { mode: 0o600 });
        await audit.write(db, { actorType: 'cli', action: 'backup.export', details: { counts: data.counts } });
        console.log(`✔ Backup terenkripsi ditulis ke ${o.out}:`, data.counts);
        break;
      }
      case 'restore': {
        if (!o.in) fail('--in <file> wajib');
        if (o['confirm-empty'] !== true) fail('Restore hanya ke database KOSONG yang sudah dimigrasi. Tambahkan --confirm-empty.');
        const data = backup.decrypt(fs.readFileSync(o.in, 'utf8'), cfg.backupKey);
        console.log('✔ Restore selesai:', await backup.restoreData(db, data));
        break;
      }
      case 'purge': {
        const days = Math.max(parseInt(o.days, 10) || 90, 7);
        const res = await db.withTransaction(async tx => {
          const r = {};
          r.bot_sessions = (await tx.query("DELETE FROM bot_sessions WHERE (revoked_at IS NOT NULL OR expires_at < now()) AND created_at < now() - make_interval(days => $1::int) RETURNING id", [days])).length;
          r.dashboard_sessions = (await tx.query("DELETE FROM dashboard_sessions WHERE (revoked_at IS NOT NULL OR expires_at < now()) AND created_at < now() - make_interval(days => $1::int) RETURNING id", [days])).length;
          r.login_attempts = (await tx.query('DELETE FROM login_attempts WHERE created_at < now() - make_interval(days => $1::int) RETURNING id', [days])).length;
          r.login_links = (await tx.query('DELETE FROM login_links WHERE expires_at < now() - make_interval(days => $1::int) RETURNING id', [days])).length;
          r.bots = (await tx.query('DELETE FROM bots WHERE deleted_at < now() - make_interval(days => $1::int) RETURNING id', [days])).length;
          await audit.write(tx, { actorType: 'cli', action: 'system.purge', details: { days, ...r } });
          return r;
        });
        console.log('✔ Purge selesai:', res);
        break;
      }
      default: fail(`Perintah tidak dikenal: ${cmd}. Jalankan: node server/cli.js help`);
    }
  } finally {
    await db.close();
  }
}

main().catch(e => { console.error('✖', e.code ? `${e.code}: ${e.message}` : e.message); process.exit(1); });
