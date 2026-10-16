'use strict';
// npm run lint: syntax check (node --check) of every .js file of the site, so new plugins (also the
// ones added from the Developer panel) and new browser scripts are checked without editing a list.
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIRS = ['.', 'routes', 'services', 'lib', 'config', 'plugin', 'views', 'tools', 'tests', 'tests/integration'];
const files = DIRS.flatMap(d => fs.readdirSync(path.join(ROOT, d)).filter(f => f.endsWith('.js')).map(f => path.join(d, f)));
let failed = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); }
  catch (e) { failed++; process.stderr.write(`✕ ${f}\n${String(e.stderr || e.message)}\n`); }
}
console.log(`${files.length - failed}/${files.length} file .js lolos node --check`);
process.exit(failed ? 1 : 0);
