'use strict';
// Membuat library/catalog/apiz2z-endpoints.json dari SOURCE platform APIZ2Z (repo api-docs: folder plugin/).
// Hanya endpoint yang benar-benar terdaftar di source yang masuk katalog — tidak ada endpoint karangan.
//
//   node tools/sync-apiz2z-catalog.js [path-ke-repo-api-docs]
//
// Default path: folder induk proyek ini (YannAjahNew berada di dalam repo api-docs).
// Endpoint "backupOnly" (cadangan failover, tidak tampil publik) tidak dimasukkan.

const fs = require('fs');
const path = require('path');
const Module = require('module');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', '..'));
const pluginDir = path.join(root, 'plugin');
const out = path.join(__dirname, '..', 'library', 'catalog', 'apiz2z-endpoints.json');

// Endpoint yang sengaja TIDAK dijadikan command (kebijakan konten/keamanan). Tercatat di katalog sebagai excluded.
const EXCLUDED = {
  '/api/ai/deepnude-ai': 'Konten seksual dari foto orang nyata tanpa persetujuan — tidak diimplementasikan.',
  '/api/premium/alightmotion-send-prem': 'Aktivasi premium aplikasi pihak ketiga — di luar cakupan bot.',
  '/api/premium/alightmotion-verify': 'Aktivasi premium aplikasi pihak ketiga — di luar cakupan bot.'
};

if (!fs.existsSync(pluginDir)) {
  console.error(`Folder plugin APIZ2Z tidak ditemukan: ${pluginDir}`);
  process.exit(1);
}
// Plugin APIZ2Z memakai dependency repo api-docs.
process.env.NODE_PATH = [path.join(root, 'node_modules'), process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

const endpoints = [];
const errors = [];
for (const f of fs.readdirSync(pluginDir).filter(f => f.endsWith('.js')).sort()) {
  let mod;
  try { mod = require(path.join(pluginDir, f)); } catch (e) { errors.push(`${f}: ${e.message}`); continue; }
  for (const e of (Array.isArray(mod) ? mod : [mod])) {
    if (!e || typeof e.path !== 'string' || typeof e.run !== 'function' || !e.name || !e.category) continue;
    if (e.backupOnly) continue;
    const p = e.path.split('?')[0];
    endpoints.push({
      path: p,
      name: String(e.name),
      desc: String(e.desc || ''),
      category: String(e.category),
      source: f.replace(/\.js$/, ''),
      upload: Boolean(e.upload),
      params: (e.params || []).map(x => ({
        name: x.name,
        required: Boolean(x.required),
        ...(x.type === 'file' ? { file: true } : {}),
        ...(x.aliases ? { aliases: x.aliases } : {}),
        ...(x.options ? { options: x.options } : {}),
        ...(x.default !== undefined ? { default: String(x.default) } : {}),
        ...(x.max ? { max: x.max } : {})
      })),
      ...(EXCLUDED[p] ? { excluded: EXCLUDED[p] } : {})
    });
  }
}
const seen = new Set();
const unique = endpoints.filter(e => (seen.has(e.path) ? false : seen.add(e.path)));
unique.sort((a, b) => a.path.localeCompare(b.path));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({
  source: 'api-docs repository (platform apiz2z.web.id), folder plugin/',
  generatedAt: new Date().toISOString(),
  auth: { header: 'Authorization: Bearer <APIZ2Z_API_KEY>', alt: 'x-api-key' },
  uploads: 'Endpoint upload:true menerima POST body file mentah (maks 8 MB) dengan Content-Type file, parameter lain lewat query.',
  count: unique.length,
  endpoints: unique
}, null, 1) + '\n');
console.log(`Katalog: ${unique.length} endpoint publik (${unique.filter(e => e.excluded).length} dikecualikan) -> ${path.relative(process.cwd(), out)}`);
if (errors.length) { console.warn('Plugin gagal dimuat:\n - ' + errors.join('\n - ')); }
