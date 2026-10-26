'use strict';
// Build distribusi BOT (tanpa server/ backend, tanpa test, tanpa data runtime) ke dist/YannAjahNew.
// Seperti Yann AI V15: HANYA yannajah.js (entry, berisi tautan web database) yang diobfuscate dengan
// javascript-obfuscator. File lain (handler.js, yannai-cmd.js, settingsbot.js, source/, lib/, library/,
// plugins/) tetap kode biasa supaya bisa dibaca & diedit. Obfuscation hanya lapisan tambahan, bukan
// pengganti autentikasi, dan tidak membuat kode mustahil direkayasa balik.
//
//   node tools/build-dist.js [--no-obfuscate] [--license-url https://lisensi.domainkamu.com]
//
// --license-url menanam alamat web database ke WEB_DATABASE di yannajah.js (diobfuscate penuh),
// seperti index.js bot referensi: bot hasil build hanya bisa login ke website itu.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'dist', 'YannAjahNew');
const obfuscate = !process.argv.includes('--no-obfuscate');
const licArg = process.argv.indexOf('--license-url');
const licenseUrl = licArg > -1 ? process.argv[licArg + 1] : process.env.BUILD_LICENSE_URL || '';
if (licenseUrl) {
  let u;
  try { u = new URL(licenseUrl); } catch { u = null; }
  const local = u && ['localhost', '127.0.0.1', '::1'].includes(u.hostname);
  if (!u || (u.protocol !== 'https:' && !local)) { console.error('--license-url harus URL https (http hanya untuk localhost)'); process.exit(1); }
}
// Struktur seperti Yann AI V15: yannajah.js, handler.js, yannai-cmd.js, settingsbot.js, source/, lib/, library/, plugins/.
const INCLUDE = ['yannajah.js', 'handler.js', 'yannai-cmd.js', 'settingsbot.js', 'package.json', 'package-lock.json', '.env.example', 'source', 'lib', 'library', 'plugins', 'data', 'assets', 'README.md', 'CARA-EDIT.txt', 'DAFTAR-API.txt'];
const OBFUSCATE = ['yannajah.js'];
const OBF_OPTIONS = {
  compact: true, controlFlowFlattening: false, deadCodeInjection: false, debugProtection: false, selfDefending: false,
  identifierNamesGenerator: 'hexadecimal', renameGlobals: false, stringArray: true, stringArrayThreshold: 0.6,
  stringArrayEncoding: ['base64'], splitStrings: false, target: 'node', sourceMap: false, transformObjectKeys: false
};

function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    if (path.basename(src) === 'database' && src.includes(`${path.sep}library${path.sep}`)) { fs.mkdirSync(dst, { recursive: true }); fs.writeFileSync(path.join(dst, '.gitkeep'), ''); return; }
    fs.mkdirSync(dst, { recursive: true });
    for (const e of fs.readdirSync(src)) copy(path.join(src, e), path.join(dst, e));
    return;
  }
  fs.copyFileSync(src, dst);
}

fs.rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const item of INCLUDE) if (fs.existsSync(path.join(ROOT, item))) copy(path.join(ROOT, item), path.join(OUT, item));

if (licenseUrl) {
  const origin = new URL(licenseUrl).origin;
  const entry = path.join(OUT, 'yannajah.js');
  const src = fs.readFileSync(entry, 'utf8');
  const marker = 'const WEB_DATABASE = null;';
  if (!src.includes(marker)) { console.error(`yannajah.js tidak berisi "${marker}"`); process.exit(1); }
  fs.writeFileSync(entry, src.replace(marker, `const WEB_DATABASE = ${JSON.stringify(origin)};`));
}

let n = 0;
if (obfuscate) {
  const JavaScriptObfuscator = require('javascript-obfuscator');
  for (const rel of OBFUSCATE) {
    const p = path.join(OUT, rel);
    // Tautan web database: semua string dikodekan (stringArrayThreshold 1) agar tidak terbaca sebagai teks biasa.
    const code = fs.readFileSync(p, 'utf8');
    fs.writeFileSync(p, '/* YannAjahNew build */\n' + JavaScriptObfuscator.obfuscate(code, { ...OBF_OPTIONS, stringArrayThreshold: 1 }).getObfuscatedCode());
    n++;
  }
}
fs.writeFileSync(path.join(OUT, 'BUILD.txt'), `YannAjahNew dist\nDibuat: ${new Date().toISOString()}\nObfuscated: ${obfuscate ? `${n} file` : 'tidak'}\nWebsite lisensi: ${licenseUrl ? 'tertanam (LICENSE_SERVER_URL di .env tidak dipakai)' : 'dari LICENSE_SERVER_URL (.env)'}\nBackend (server/) TIDAK disertakan: jalankan di server admin terpisah.\n`);
console.log(`dist/YannAjahNew siap (${obfuscate ? `${n} file diobfuscate` : 'tanpa obfuscation'}${licenseUrl ? ', website lisensi tertanam' : ''})`);
