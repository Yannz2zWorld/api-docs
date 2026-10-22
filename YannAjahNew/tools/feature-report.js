'use strict';
// Laporan fitur otomatis: menghitung fitur unik per status dari registry + hasil uji sebenarnya
// (reports/feature-tests.json yang ditulis oleh test). Menulis reports/feature-report.json dan docs/FEATURES.md.
//
//   node tools/feature-report.js            (jalankan `npm test` dulu supaya status "tested" akurat)
//
// Definisi status di laporan:
//   tested          : implementasi ada dan SEMUA kasus ujinya lulus pada run terakhir
//                     (jenis uji: unit = fungsi murni, mock = APIZ2Z dengan transport tiruan, real = ffmpeg/Jimp nyata)
//   implemented     : implementasi ada, belum punya kasus uji otomatis (mis. butuh socket WhatsApp)
//   failed          : ada kasus uji yang gagal pada run terakhir
//   needs_api_key   : (kolom terpisah) fitur APIZ2Z yang hanya jalan kalau APIZ2Z_API_KEY diisi
//   planned         : backlog (nama command V15 yang belum diimplementasikan; sebagian adalah alias satu sama lain)
//   disabled        : sengaja tidak diimplementasikan (kebijakan keamanan/konten), alasan tercantum

const fs = require('fs');
const path = require('path');
const { Registry } = require('../library/registry');

const ROOT = path.join(__dirname, '..');
const registry = new Registry({ db: () => ({ features: {} }) });
registry.loadDir(path.join(ROOT, 'plugins'));
let tests = {};
try { tests = JSON.parse(fs.readFileSync(path.join(ROOT, 'reports', 'feature-tests.json'), 'utf8')).results || {}; } catch { /* belum ada hasil uji */ }

const rows = [];
for (const f of registry.features.values()) {
  const t = tests[f.id];
  const testKind = t ? (t.kind || (['media', 'image', 'sticker'].includes(f.category) ? 'real' : 'unit')) : null;
  let status = f.status;
  if (['implemented', 'tested'].includes(f.status)) status = t ? (t.failed ? 'failed' : 'tested') : 'implemented';
  rows.push({
    id: f.id, command: f.name, aliases: f.aliases, category: f.category, source: f.source, description: f.description,
    permission: f.permission, scope: f.scope, params: f.params.map(p => p.name + (p.required ? '*' : '')),
    dependency: f.dependencies.apiz2z ? `APIZ2Z ${f.dependencies.apiz2z}` : (f.dependencies.bins || []).join(', ') || f.dataset || '',
    needsApiKey: Boolean(f.dependencies.apiz2z), status, test: t ? `${t.passed}/${t.cases} ${testKind}` : ''
  });
}

const count = (pred) => rows.filter(pred).length;
const working = r => ['tested', 'implemented', 'failed'].includes(r.status);
const summary = {
  generatedAt: new Date().toISOString(),
  registryEntries: rows.length,
  uniqueWorkingFeatures: count(working),
  byStatus: Object.fromEntries(['tested', 'implemented', 'failed', 'planned', 'disabled'].map(s => [s, count(r => r.status === s)])),
  testedByKind: { unit: count(r => r.status === 'tested' && / unit$/.test(r.test)), mock: count(r => r.status === 'tested' && / mock$/.test(r.test)), real: count(r => r.status === 'tested' && / real$/.test(r.test)) },
  needsApiKey: count(r => working(r) && r.needsApiKey),
  workingWithoutApiKey: count(r => working(r) && !r.needsApiKey),
  bySource: Object.fromEntries(['internal', 'apiz2z', 'v15', 'legacy'].map(s => [s, count(r => r.source === s)])),
  byCategory: rows.filter(working).reduce((a, r) => ((a[r.category] = (a[r.category] || 0) + 1), a), {}),
  loadErrors: registry.loadErrors
};

fs.mkdirSync(path.join(ROOT, 'reports'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'reports', 'feature-report.json'), JSON.stringify({ summary, features: rows }, null, 1));

const esc = s => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const md = [];
md.push('# Katalog Fitur YannAjahNew', '', '> File ini DIBUAT OTOMATIS oleh `npm run features:report` dari feature registry dan hasil uji terakhir (`npm test`). Jangan diedit manual.', '');
md.push(`Dibuat: ${summary.generatedAt}`, '', '## Ringkasan', '');
md.push('| Ukuran | Jumlah |', '|---|---:|');
md.push(`| Entri registry (termasuk backlog) | ${summary.registryEntries} |`);
md.push(`| **Fitur unik yang berfungsi** (punya implementasi) | **${summary.uniqueWorkingFeatures}** |`);
md.push(`| — lulus uji otomatis (tested) | ${summary.byStatus.tested} |`);
md.push(`| &nbsp;&nbsp;· uji unit (fungsi murni) | ${summary.testedByKind.unit} |`);
md.push(`| &nbsp;&nbsp;· uji mock APIZ2Z (bukan live) | ${summary.testedByKind.mock} |`);
md.push(`| &nbsp;&nbsp;· uji nyata ffmpeg/Jimp | ${summary.testedByKind.real} |`);
md.push(`| — implemented, belum ada uji otomatis | ${summary.byStatus.implemented} |`);
md.push(`| — gagal uji (failed) | ${summary.byStatus.failed} |`);
md.push(`| Butuh APIZ2Z_API_KEY | ${summary.needsApiKey} |`);
md.push(`| Jalan tanpa API key | ${summary.workingWithoutApiKey} |`);
md.push(`| Backlog V15 (planned; sebagian alias) | ${summary.byStatus.planned} |`);
md.push(`| Dikecualikan kebijakan (disabled) | ${summary.byStatus.disabled} |`, '');
md.push('### Fitur berfungsi per kategori', '', '| Kategori | Jumlah |', '|---|---:|');
for (const [c, n] of Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1])) md.push(`| ${c} | ${n} |`);
md.push('');
const section = (title, filter, cols) => {
  const list = rows.filter(filter).sort((a, b) => a.category.localeCompare(b.category) || a.command.localeCompare(b.command));
  md.push(`## ${title} (${list.length})`, '', `| ${cols.map(c => c[0]).join(' | ')} |`, `|${cols.map(() => '---').join('|')}|`);
  for (const r of list) md.push(`| ${cols.map(c => esc(c[1](r))).join(' | ')} |`);
  md.push('');
};
section('Fitur berfungsi', working, [['Command', r => '.' + r.command], ['Alias', r => r.aliases.join(', ')], ['Kategori', r => r.category], ['Deskripsi', r => r.description], ['Permission', r => r.permission + (r.scope !== 'all' ? `/${r.scope}` : '')], ['Parameter', r => r.params.join(', ')], ['Dependency', r => r.dependency], ['Status', r => r.status], ['Uji', r => r.test]]);
section('Dikecualikan (disabled)', r => r.status === 'disabled', [['Command V15', r => r.command], ['Alasan', r => r.description]]);
section('Backlog V15 (planned)', r => r.status === 'planned', [['Command V15', r => r.command], ['Catatan', r => r.description]]);
fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'FEATURES.md'), md.join('\n'));

console.log(JSON.stringify({ ...summary, byCategory: undefined, loadErrors: summary.loadErrors.length }, null, 1));
