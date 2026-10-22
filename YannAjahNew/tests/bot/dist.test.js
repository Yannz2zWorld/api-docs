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
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'build-dist.js')], { stdio: 'pipe' });
  fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(DIST, 'node_modules'), 'dir');
  const yjs = fs.readFileSync(path.join(DIST, 'yannajah.js'), 'utf8');
  assert.ok(yjs.startsWith('/* YannAjahNew build */') && /_0x[0-9a-f]+/.test(yjs), 'yannajah.js diobfuscate');
  assert.ok(fs.readFileSync(path.join(DIST, 'settingsbot.js'), 'utf8').includes("projectName: 'YannAjahNew'"), 'settingsbot.js tetap terbaca');
  assert.ok(!fs.existsSync(path.join(DIST, 'server')), 'backend tidak ikut dist');
  const script = `
    const path = require('path');
    const { loadConfig } = require('./library/config-loader'); const cfg = loadConfig();
    const { Registry } = require('./library/registry'); const r = new Registry({ db: () => ({ features: {} }) });
    r.loadDir(path.join(process.cwd(), 'plugins'));
    const out = { size: r.features.size, errors: r.loadErrors.length, upper: r.resolve('upper').pure('dist'), calc: r.resolve('calc').pure('6*7'),
      router: typeof require('./command').createRouter, wa: typeof require('./library/connection').WhatsAppManager, lic: typeof require('./library/license').LicenseClient, name: cfg.bot.projectName };
    process.stdout.write(JSON.stringify(out));`;
  const out = JSON.parse(execFileSync(process.execPath, ['-e', script], { cwd: DIST, encoding: 'utf8' }));
  assert.deepEqual(out, { size: out.size, errors: 0, upper: 'DIST', calc: '6*7 = *42*', router: 'function', wa: 'function', lic: 'function', name: 'YannAjahNew' });
  assert.ok(out.size > 1500);
  execFileSync(process.execPath, [path.join(ROOT, 'tools', 'syntax-check.js'), DIST], { stdio: 'pipe' });
});
