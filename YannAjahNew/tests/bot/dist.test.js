'use strict';
// Build distribusi + obfuscation: dibuat ulang, lalu dimuat dari folder dist di proses terpisah
// (konfigurasi, plugin loading, registry, fitur murni, router, modul koneksi/lisensi).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist', 'YannAjahNew');

test('build dist (obfuscated) bisa dimuat dan dijalankan', { timeout: 300000 }, () => {
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-dist.js'), '--license-url', 'https://lisensi.contoh-bot.id'], { stdio: 'pipe' });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(DIST, 'node_modules'), 'dir');
  // Hanya yannajah.js (entry) yang diobfuscate; file lain tetap kode biasa.
  for (const f of ['handler.js', 'yannai-cmd.js', 'settingsbot.js', 'library/yannajah.js', 'library/license.js', 'plugins/game/snake.js']) {
    assert.ok(!fs.readFileSync(path.join(DIST, f), 'utf8').startsWith('/* YannAjahNew build */'), `${f} tidak diobfuscate`);
  }
  assert.ok(fs.readFileSync(path.join(DIST, 'settingsbot.js'), 'utf8').includes('global.botname'), 'settingsbot.js tetap terbaca');
  assert.ok(!fs.existsSync(path.join(DIST, 'server')), 'backend tidak ikut dist');
  const entry = fs.readFileSync(path.join(DIST, 'yannajah.js'), 'utf8');
  assert.ok(entry.startsWith('/* YannAjahNew build */') && !entry.includes('contoh-bot'), 'yannajah.js diobfuscate; tautan web database tertanam & tidak terbaca sebagai teks biasa');
  const script = `
    const path = require('path');
    require('./yannajah');   // entry (tidak start bot saat di-require) mengunci tautan web database
    const { loadConfig } = require('./library/config-loader'); const cfg = loadConfig();
    const { Registry } = require('./library/registry'); const r = new Registry({ db: () => ({ features: {} }) });
    r.loadDir(path.join(process.cwd(), 'plugins'));
    const { LicenseClient } = require('./library/license');
    const lic = new LicenseClient({ ...cfg.license, serverUrl: 'https://server-lain.example.com', tokenFile: 'library/database/_dist-test.json' }, { logger: { info() {}, warn() {}, error() {} } });
    const out = { size: r.features.size, errors: r.loadErrors.length, upper: r.resolve('upper').pure('dist'), calc: r.resolve('calc').pure('6*7'),
      router: typeof require('./yannai-cmd').createRouter, handler: typeof require('./handler').initializerHandler, wa: typeof require('./library/connection').WhatsAppManager, lic: lic.base, cfgUrl: cfg.license.serverUrl, name: cfg.bot.projectName };
    process.stdout.write(JSON.stringify(out));`;
  const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: DIST, encoding: 'utf8', env: { ...process.env, LICENSE_SERVER_URL: 'https://server-lain.example.com' } }));
  // .env & settingsbot.js menunjuk server lain, tapi bot hasil build tetap ke website tertanam.
  assert.deepEqual(out, { size: out.size, errors: 0, upper: 'DIST', calc: '6*7 = *42*', router: 'function', handler: 'function', wa: 'function', lic: 'https://lisensi.contoh-bot.id', cfgUrl: 'https://lisensi.contoh-bot.id', name: 'YannAjahNew' });
  assert.ok(out.size > 1500);
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'syntax-check.js'), DIST], { stdio: 'pipe' });
});
