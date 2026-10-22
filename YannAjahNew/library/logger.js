'use strict';
// Logger sederhana dengan level dan redaksi otomatis: field bernama token/password/key/otp/...
// dan pola yang mirip credential diganti '***' sebelum ditulis ke console atau file.

const fs = require('fs');
const path = require('path');
const util = require('util');
const chalk = require('chalk');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const SECRET_FIELD = /(token|password|passwd|secret|api[-_]?key|apikey|otp|pairing|credential|cookie|authorization|creds)/i;
const SECRET_PATTERNS = [
  /\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi,
  /\b(yat_|yas_)[A-Za-z0-9_-]{10,}/g,
  /([?&](?:apikey|api_key|key|token|password)=)[^&\s]+/gi
];

function scrubString(s) {
  let out = String(s);
  for (const re of SECRET_PATTERNS) out = out.replace(re, (m, p1) => (p1 ? p1 + '***' : '***'));
  return out;
}

function scrub(value, depth = 0, seen = new WeakSet()) {
  if (value == null) return value;
  if (typeof value === 'string') return scrubString(value);
  if (typeof value !== 'object') return value;
  if (value instanceof Error) return { name: value.name, message: scrubString(value.message), code: value.code, stack: value.stack ? scrubString(value.stack) : undefined };
  if (Buffer.isBuffer(value)) return `<Buffer ${value.length} bytes>`;
  if (seen.has(value) || depth > 6) return '[…]';
  seen.add(value);
  if (Array.isArray(value)) return value.slice(0, 50).map(v => scrub(v, depth + 1, seen));
  const out = {};
  for (const [k, v] of Object.entries(value)) out[k] = SECRET_FIELD.test(k) ? '***' : scrub(v, depth + 1, seen);
  return out;
}

function createLogger({ level = 'info', file = null, name = 'yannajah', console: useConsole = true } = {}) {
  let stream = null;
  if (file) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      stream = fs.createWriteStream(file, { flags: 'a', mode: 0o600 });
      stream.on('error', () => { stream = null; });
    } catch { stream = null; }
  }
  const threshold = LEVELS[level] ?? 2;
  const color = { error: chalk.red, warn: chalk.yellow, info: chalk.cyan, debug: chalk.gray };

  function write(lvl, args) {
    if (LEVELS[lvl] > threshold) return;
    const parts = args.map(a => (typeof a === 'string' ? scrubString(a) : util.inspect(scrub(a), { depth: 4, breakLength: 140 })));
    const line = `[${new Date().toISOString()}] ${lvl.toUpperCase()} ${name}: ${parts.join(' ')}`;
    if (useConsole) (lvl === 'error' ? console.error : console.log)(color[lvl](line));
    if (stream) stream.write(line + '\n');
  }
  const logger = {
    level,
    error: (...a) => write('error', a),
    warn: (...a) => write('warn', a),
    info: (...a) => write('info', a),
    debug: (...a) => write('debug', a),
    child: (sub) => createLogger({ level, file: null, name: `${name}:${sub}`, console: useConsole })._attach(stream),
    _attach(s) { if (s) stream = s; return logger; },
    close: () => new Promise(r => (stream ? stream.end(r) : r()))
  };
  return logger;
}

module.exports = { createLogger, scrub, scrubString, LEVELS };
