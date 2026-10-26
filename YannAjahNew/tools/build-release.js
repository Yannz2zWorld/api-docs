'use strict';
// Paket rilis siap deploy (dua project terpisah):
//   release/YannAjah-AI/            bot WhatsApp untuk panel Pterodactyl (hasil build:dist, diobfuscate,
//                                   tautan web database tertanam di yannajah.js) + YannAjah-AI.zip
//   release/YannAjah-WebDatabase/   website dashboard + API lisensi + migrasi PostgreSQL untuk VPS
//                                   (pemasang otomatis install-vps.sh) + YannAjah-WebDatabase.zip
//
//   node tools/build-release.js --license-url https://lisensi.domainkamu.com [--apiz2z-key KEY] [--no-obfuscate] [--no-zip]
//
// Tidak pernah ikut: .env asli, session WhatsApp, database lokal bot, token lisensi, test, node_modules.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const REL = path.join(ROOT, 'release');
const BOT = path.join(REL, 'YannAjah-AI');
const WEB = path.join(REL, 'YannAjah-WebDatabase');
const arg = name => { const i = process.argv.indexOf(name); return i > -1 ? process.argv[i + 1] : null; };
const licenseUrl = arg('--license-url') || process.env.BUILD_LICENSE_URL || '';
const zip = !process.argv.includes('--no-zip');
if (!licenseUrl) { console.error('Wajib: --license-url https://alamat-web-database (alamat yang sama dengan DASHBOARD_PUBLIC_URL)'); process.exit(1); }

const pkg = require(path.join(ROOT, 'package.json'));
const BOT_DEPS = ['@napi-rs/canvas', '@whiskeysockets/baileys', 'chalk', 'jimp', 'node-webpmux', 'pino', 'qrcode-terminal'];
const WEB_DEPS = ['bcryptjs', 'express', 'pg'];
const pick = names => Object.fromEntries(names.map(n => {
  if (!pkg.dependencies[n]) throw new Error(`dependency ${n} tidak ada di package.json`);
  return [n, pkg.dependencies[n]];
}));
const writeJson = (file, obj) => fs.writeFileSync(file, JSON.stringify(obj, null, 2) + '\n');
const copy = (src, dst) => fs.cpSync(src, dst, { recursive: true, filter: s => !/(^|[\\/])(\.env|node_modules|server[\\/]data)$/.test(path.relative(ROOT, s)) });

fs.rmSync(REL, { recursive: true, force: true });
fs.mkdirSync(REL, { recursive: true });

// ------------------------------------------------------------------ bot (panel)
execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-dist.js'), '--license-url', licenseUrl, ...(process.argv.includes('--no-obfuscate') ? ['--no-obfuscate'] : [])], { stdio: 'inherit' });
fs.renameSync(path.join(ROOT, 'dist', 'YannAjahNew'), BOT);
fs.rmSync(path.join(BOT, 'package-lock.json'), { force: true });   // dependency bot berbeda dari repo pengembangan
writeJson(path.join(BOT, 'package.json'), {
  name: 'yannajah-ai',
  version: pkg.version,
  description: 'YannAjah AI — bot WhatsApp (terhubung ke YannAjah Web Database)',
  main: 'yannajah.js',
  type: 'commonjs',
  private: true,
  engines: pkg.engines,
  scripts: { start: 'node yannajah.js', 'start:qr': 'node yannajah.js --qr', 'start:pairing': 'node yannajah.js --pairing-code' },
  license: pkg.license,
  dependencies: pick(BOT_DEPS),
  // Panel tanpa ffmpeg sistem: ffmpeg-static dipakai otomatis (library/converter.js).
  optionalDependencies: { 'ffmpeg-static': '^5.2.0' }
});
fs.copyFileSync(path.join(ROOT, 'deploy', 'bot', '.env.example'), path.join(BOT, '.env.example'));
// API key APIZ2Z untuk paket ini (tidak pernah disimpan di repo): --apiz2z-key <key> atau env BUILD_APIZ2Z_KEY.
const apiKey = arg('--apiz2z-key') || process.env.BUILD_APIZ2Z_KEY || '';
if (apiKey) {
  if (!/^[\w.-]{4,200}$/.test(apiKey)) { console.error('--apiz2z-key tidak valid'); process.exit(1); }
  const sf = path.join(BOT, 'settingsbot.js');
  const src = fs.readFileSync(sf, 'utf8');
  const out = src.replace(/global\.apikeyapiz2z = "[^"]*"/, `global.apikeyapiz2z = "${apiKey}"`);
  if (out === src) { console.error('settingsbot.js tidak berisi global.apikeyapiz2z'); process.exit(1); }
  fs.writeFileSync(sf, out);
}
for (const f of ['PANDUAN-PANEL.md', 'README.md']) fs.copyFileSync(path.join(ROOT, 'deploy', 'bot', f), path.join(BOT, f));
fs.writeFileSync(path.join(BOT, '.gitignore'), 'node_modules\n.env\nsession/\nlibrary/database/*.json\n');

// ------------------------------------------------------------------ web database (VPS)
fs.mkdirSync(WEB, { recursive: true });
copy(path.join(ROOT, 'server'), path.join(WEB, 'server'));
for (const f of ['.env.example', 'ecosystem.config.js', 'nginx-yannajah.conf', 'install-vps.sh', 'PANDUAN-VPS.md', 'README.md']) fs.copyFileSync(path.join(ROOT, 'deploy', 'web', f), path.join(WEB, f));
fs.chmodSync(path.join(WEB, 'install-vps.sh'), 0o755);
for (const d of ['RANKS.md', 'DATABASE.md']) if (fs.existsSync(path.join(ROOT, 'docs', d))) { fs.mkdirSync(path.join(WEB, 'docs'), { recursive: true }); fs.copyFileSync(path.join(ROOT, 'docs', d), path.join(WEB, 'docs', d)); }
writeJson(path.join(WEB, 'package.json'), {
  name: 'yannajah-web-database',
  version: pkg.version,
  description: 'YannAjah Web Database — dashboard + API lisensi bot (PostgreSQL)',
  main: 'server/index.js',
  type: 'commonjs',
  private: true,
  engines: pkg.engines,
  scripts: { start: 'node server/index.js', migrate: 'node server/cli.js migrate', status: 'node server/cli.js status' },
  license: pkg.license,
  dependencies: pick(WEB_DEPS)
});
fs.writeFileSync(path.join(WEB, '.gitignore'), 'node_modules\n.env\nserver/data/\n');
fs.writeFileSync(path.join(WEB, 'BUILD.txt'), `YannAjah Web Database\nDibuat: ${new Date().toISOString()}\nAlamat (bot hasil build ini login ke sini): ${new URL(licenseUrl).origin}\n`);

// Pengaman: tidak ada file rahasia / runtime yang ikut.
const leaks = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (['node_modules', 'session'].includes(e.name)) leaks.push(p); else walk(p); continue; }
    if (e.name === '.env' || /license-session|creds\.json$|\.db$/.test(e.name)) leaks.push(p);
  }
})(REL);
if (leaks.length) { console.error('✖ File rahasia/runtime ikut paket:\n' + leaks.join('\n')); process.exit(1); }

if (zip) {
  for (const dir of ['YannAjah-AI', 'YannAjah-WebDatabase']) execFileSync('zip', ['-qr', `${dir}.zip`, dir], { cwd: REL, stdio: 'inherit' });
}
console.log(`✔ release/YannAjah-AI${zip ? ' (+ .zip)' : ''} — bot untuk panel, web database tertanam: ${new URL(licenseUrl).origin}`);
console.log(`✔ release/YannAjah-WebDatabase${zip ? ' (+ .zip)' : ''} — web database untuk VPS (bash install-vps.sh --domain ${new URL(licenseUrl).hostname})`);
