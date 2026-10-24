'use strict';
// Build distribusi BOT (tanpa server/ backend, tanpa test, tanpa data runtime) ke dist/YannAjahNew.
// Kode inti bot diobfuscate dengan javascript-obfuscator sebagai LAPISAN TAMBAHAN saja —
// bukan pengganti autentikasi/secret management, dan tidak membuat kode mustahil direkayasa balik.
// Tidak diobfuscate: settingsbot.js & settings.js (harus bisa diedit), katalog JSON, dataset, dokumentasi.
//
//   node tools/build-dist.js [--no-obfuscate] [--license-url https://lisensi.domainkamu.com]
//
// --license-url menanam alamat website lisensi ke library/license-endpoint.js (ikut diobfuscate),
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
const INCLUDE = ['index.js', 'yannajah.js', 'command.js', 'menu.js', 'settings.js', 'settingsbot.js', 'package.json', 'package-lock.json', '.env.example', 'library', 'myfunct', 'source', 'plugins', 'data', 'assets', 'README.md'];
const NO_OBFUSCATE = new Set(['settingsbot.js', 'settings.js']);
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
  fs.writeFileSync(path.join(OUT, 'library', 'license-endpoint.js'), `'use strict';\nmodule.exports = { url: ${JSON.stringify(origin)}, locked: true };\n`);
}

let n = 0;
if (obfuscate) {
  const JavaScriptObfuscator = require('javascript-obfuscator');
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== 'data') walk(p); continue; }
      if (!e.name.endsWith('.js') || NO_OBFUSCATE.has(path.relative(OUT, p))) continue;
      const code = fs.readFileSync(p, 'utf8');
      // Alamat website lisensi: semua string dikodekan agar tidak terbaca sebagai teks biasa.
      const opts = path.relative(OUT, p) === path.join('library', 'license-endpoint.js') ? { ...OBF_OPTIONS, stringArrayThreshold: 1 } : OBF_OPTIONS;
      fs.writeFileSync(p, '/* YannAjahNew build */\n' + JavaScriptObfuscator.obfuscate(code, opts).getObfuscatedCode());
      n++;
    }
  })(OUT);
}
fs.writeFileSync(path.join(OUT, 'BUILD.txt'), `YannAjahNew dist\nDibuat: ${new Date().toISOString()}\nObfuscated: ${obfuscate ? `${n} file` : 'tidak'}\nWebsite lisensi: ${licenseUrl ? 'tertanam (LICENSE_SERVER_URL di .env tidak dipakai)' : 'dari LICENSE_SERVER_URL (.env)'}\nBackend (server/) TIDAK disertakan: jalankan di server admin terpisah.\n`);
console.log(`dist/YannAjahNew siap (${obfuscate ? `${n} file diobfuscate` : 'tanpa obfuscation'}${licenseUrl ? ', website lisensi tertanam' : ''})`);
