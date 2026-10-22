'use strict';
// Syntax check seluruh JavaScript proyek (node --check), tanpa node_modules / dist.
//   node tools/syntax-check.js [folder]
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SKIP = new Set(['node_modules', '.git', 'session', 'reports']);
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (SKIP.has(e.name) || (e.name === 'dist' && d === root)) continue;
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(c?js)$/.test(e.name)) files.push(p);
  }
})(root);
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch (e) { failed++; console.error(`✖ ${path.relative(root, f)}\n${String(e.stderr).split('\n').slice(0, 5).join('\n')}`); }
}
console.log(`${files.length - failed}/${files.length} file JavaScript lolos syntax check`);
process.exit(failed ? 1 : 0);
