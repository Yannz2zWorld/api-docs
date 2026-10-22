'use strict';
// Obfuscates the browser-facing scripts in views/*.js into views/dist/*.js (served to visitors when
// present; the originals stay here, readable and editable). Run `npm run obfuscate` after changing any
// client script, then commit views/dist/. Server code (index.js, routes/, services/) is never shipped
// to the browser, so it is never obfuscated.
const fs = require('fs');
const path = require('path');
const O = require('javascript-obfuscator');

const VIEWS = path.join(__dirname, '..', 'views');
const DIST = path.join(VIEWS, 'dist');
// Every browser script. (i18n-en.json is data, not code; CSS and images are not scripts.)
const FILES = ['announce.js', 'aura-intro.js', 'chat.js', 'channel.js', 'endpoint-monitor.js', 'human-check.js', 'i18n.js', 'music.js', 'scene3d.js', 'scythe-color.js', 'select.js', 'slash-intro.js', 'ui-theme.js'];

// Ultra-max profile (single-line output). renameGlobals:false keeps the cross-file contract (window.YS, the keys
// other pages read) intact (window.Yannz* etc.); reservedStrings keeps serve-time placeholders literal so they can still be
// replaced. selfDefending + control-flow flattening + dead code + RC4 string array = hard to read.
const OPTS = {
  compact: true, target: 'browser',
  controlFlowFlattening: true, controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true, deadCodeInjectionThreshold: 1,
  numbersToExpressions: true, simplify: true,
  stringArray: true, stringArrayEncoding: ['rc4'], stringArrayThreshold: 1,
  stringArrayRotate: true, stringArrayShuffle: true, stringArrayIndexShift: true,
  stringArrayWrappersCount: 5, stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5, stringArrayWrappersType: 'function',
  stringArrayCallsTransform: true, stringArrayCallsTransformThreshold: 1,
  splitStrings: true, splitStringsChunkLength: 4,
  transformObjectKeys: true, selfDefending: true,
  identifierNamesGenerator: 'mangled-shuffled', renameGlobals: false,
  unicodeEscapeSequence: false,
  reservedStrings: ['__CHANNEL_URL__']
}

fs.mkdirSync(DIST, { recursive: true });
let total = 0;
for (const f of FILES) {
  const src = fs.readFileSync(path.join(VIEWS, f), 'utf8');
  const t = Date.now();
  // Unique prefix per file: these are classic scripts that share one global lexical scope across the
  // page's <script> tags, so two files must never emit the same top-level identifier.
  const prefix = '_' + Buffer.from(f).toString('hex').slice(0, 6) + '_';
  const out = O.obfuscate(src, { ...OPTS, identifiersPrefix: prefix }).getObfuscatedCode();
  fs.writeFileSync(path.join(DIST, f), out);
  total += out.length;
  console.log(`  ${f}: ${(src.length / 1024).toFixed(1)}KB -> ${(out.length / 1024).toFixed(1)}KB (${Date.now() - t}ms)`);
}
console.log(`done: ${FILES.length} files, ${(total / 1024).toFixed(0)}KB in views/dist/`);
