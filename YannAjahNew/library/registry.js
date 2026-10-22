'use strict';
// Feature registry + plugin manager (yannajah.plugins).
// Setiap fitur punya metadata lengkap (id, nama, kategori, deskripsi, alias, permission, dependency,
// parameter, status). Plugin divalidasi saat registrasi; yang tidak valid ditolak dengan alasan jelas.
// Plugin legacy (format base/V15: function + handler.command) dibungkus adapter.

const fs = require('fs');
const path = require('path');

const STATUSES = ['implemented', 'tested', 'needs_api_key', 'needs_permission', 'planned', 'disabled'];
const PERMISSIONS = ['user', 'premium', 'admin', 'owner'];
const SCOPES = ['all', 'group', 'private'];
const NAME_RE = /^[a-z0-9][a-z0-9+_-]{0,39}$/;
const ID_RE = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

class Registry {
  constructor({ logger, db } = {}) {
    this.logger = logger;
    this.db = db;              // fungsi () => global db object (untuk override enable/disable)
    this.features = new Map(); // id -> feature
    this.commands = new Map(); // name/alias -> id
    this.loadErrors = [];
    this.files = new Map();    // file -> [ids]
  }

  validate(f) {
    const p = [];
    if (!f || typeof f !== 'object') return ['bukan object'];
    if (!ID_RE.test(String(f.id || ''))) p.push(`id '${f.id}' tidak valid`);
    if (!NAME_RE.test(String(f.name || ''))) p.push(`name '${f.name}' tidak valid`);
    if (!f.category || typeof f.category !== 'string') p.push('category wajib');
    if (!f.description || typeof f.description !== 'string') p.push('description wajib');
    if (!Array.isArray(f.aliases) || !f.aliases.every(a => NAME_RE.test(a))) p.push('aliases harus array nama valid');
    if (!PERMISSIONS.includes(f.permission)) p.push(`permission harus ${PERMISSIONS.join('|')}`);
    if (!SCOPES.includes(f.scope)) p.push(`scope harus ${SCOPES.join('|')}`);
    if (!STATUSES.includes(f.status)) p.push(`status harus ${STATUSES.join('|')}`);
    if (!['planned', 'disabled'].includes(f.status) && typeof f.run !== 'function') p.push('run() wajib untuk fitur aktif');
    if (!Array.isArray(f.params)) p.push('params harus array');
    if (typeof f.dependencies !== 'object' || f.dependencies === null) p.push('dependencies harus object');
    return p;
  }

  normalize(f, file) {
    return {
      aliases: [], params: [], dependencies: {}, permission: 'user', scope: 'all', status: 'implemented',
      source: 'internal', limit: 0, cooldown: 3, botAdmin: false, usage: '', examples: [],
      ...f,
      name: String(f.name || '').toLowerCase(),
      aliases: (f.aliases || []).map(a => String(a).toLowerCase()),
      file: file ? path.relative(path.join(__dirname, '..'), file) : f.file || null
    };
  }

  register(input, { file = null, replace = false } = {}) {
    const list = Array.isArray(input) ? input : [input];
    const ids = [];
    for (const raw of list) {
      const f = this.normalize(raw, file);
      const problems = this.validate(f);
      if (problems.length) { this.loadErrors.push({ file: f.file, id: f.id, problems }); continue; }
      if (this.features.has(f.id) && !replace) { this.loadErrors.push({ file: f.file, id: f.id, problems: ['id duplikat'] }); continue; }
      const clash = [f.name, ...f.aliases].find(n => this.commands.has(n) && this.commands.get(n) !== f.id);
      if (clash) { this.loadErrors.push({ file: f.file, id: f.id, problems: [`command/alias '${clash}' sudah dipakai ${this.commands.get(clash)}`] }); continue; }
      this.features.set(f.id, f);
      for (const n of [f.name, ...f.aliases]) this.commands.set(n, f.id);
      ids.push(f.id);
    }
    if (file) this.files.set(file, [...(this.files.get(file) || []), ...ids]);
    return ids;
  }

  unregisterFile(file) {
    for (const id of this.files.get(file) || []) {
      const f = this.features.get(id);
      if (!f) continue;
      for (const n of [f.name, ...f.aliases]) if (this.commands.get(n) === id) this.commands.delete(n);
      this.features.delete(id);
    }
    this.files.delete(file);
  }

  // Adapter plugin legacy: function(m, ctx) dengan handler.command = [...]
  adaptLegacy(fn, file) {
    const cmds = (Array.isArray(fn.command) ? fn.command : [fn.command]).filter(c => typeof c === 'string').map(c => c.toLowerCase());
    if (!cmds.length) return null;
    const base = path.basename(file, '.js').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      id: `legacy.${base}`, name: cmds[0], aliases: cmds.slice(1), category: fn.category || 'legacy',
      description: fn.description || fn.help || `Plugin legacy ${path.basename(file)}`,
      permission: fn.owner ? 'owner' : fn.admin ? 'admin' : fn.premium ? 'premium' : 'user',
      scope: fn.group ? 'group' : fn.private ? 'private' : 'all', status: 'implemented', source: 'legacy',
      params: [], dependencies: {}, legacy: true,
      run: ctx => fn(ctx.m, ctx.legacyContext())
    };
  }

  loadFile(file) {
    delete require.cache[require.resolve(file)];
    const mod = require(file);
    if (typeof mod === 'function' && mod.command) {
      const adapted = this.adaptLegacy(mod, file);
      return adapted ? this.register(adapted, { file }) : [];
    }
    const feats = typeof mod === 'function' ? mod() : mod;
    return this.register(feats, { file });
  }

  // Muat semua plugin dari folder (rekursif). Folder 'external' hanya dimuat kalau hash-nya dipercaya.
  loadDir(dir, { trustedExternal = {} } = {}) {
    if (!fs.existsSync(dir)) return 0;
    let n = 0;
    const walk = d => {
      for (const ent of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const full = path.join(d, ent.name);
        if (ent.isDirectory()) { if (!ent.name.startsWith('_')) walk(full); continue; }
        if (!ent.name.endsWith('.js') || ent.name.startsWith('_')) continue;
        if (full.includes(`${path.sep}external${path.sep}`)) {
          const hash = require('crypto').createHash('sha256').update(fs.readFileSync(full)).digest('hex');
          if (trustedExternal[ent.name] !== hash) { this.loadErrors.push({ file: full, problems: ['plugin external tidak dipercaya (hash tidak cocok di settingsbot plugin.trustedExternal)'] }); continue; }
        }
        try { n += this.loadFile(full).length; }
        catch (e) { this.loadErrors.push({ file: path.relative(path.join(__dirname, '..'), full), problems: [e.message] }); this.logger?.error(`Plugin gagal dimuat: ${ent.name}`, e.message); }
      }
    };
    walk(dir);
    return n;
  }

  resolve(command) {
    const id = this.commands.get(String(command || '').toLowerCase());
    return id ? this.features.get(id) : null;
  }

  // Status efektif: override dari database (enable/disable) + config.
  effectiveStatus(f, { apiKey = true, disabledList = [] } = {}) {
    const ov = this.db?.()?.features?.[f.id];
    if (ov && ov.enabled === false) return 'disabled';
    if (disabledList.includes(f.id) || disabledList.includes(f.name)) return 'disabled';
    if (f.status === 'disabled' || f.status === 'planned') return f.status;
    if (f.dependencies.apiz2z && !apiKey) return 'needs_api_key';
    return f.status;
  }

  setEnabled(id, enabled) {
    const f = this.features.get(id) || this.resolve(id);
    if (!f) return null;
    const db = this.db?.();
    if (db) { db.features = db.features || {}; db.features[f.id] = { enabled: Boolean(enabled), at: Date.now() }; }
    return f;
  }

  list({ category, includePlanned = true } = {}) {
    return [...this.features.values()].filter(f => (!category || f.category === category) && (includePlanned || f.status !== 'planned'));
  }

  categories() {
    const out = {};
    for (const f of this.features.values()) if (f.status !== 'planned') (out[f.category] = out[f.category] || []).push(f);
    return out;
  }

  // Cari command terdekat untuk saran "maksud kamu ...?"
  suggest(command, max = 3) {
    command = String(command || '').toLowerCase();
    if (command.length < 2) return [];
    const scored = [];
    for (const name of this.commands.keys()) {
      const d = levenshtein(command, name);
      if (d <= Math.max(1, Math.floor(name.length / 4))) scored.push([d, name]);
    }
    return scored.sort((a, b) => a[0] - b[0]).slice(0, max).map(x => x[1]);
  }
}

function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]; dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

// Helper untuk penulis plugin: isi default metadata.
function defineFeature(f) { return f; }

module.exports = { Registry, defineFeature, STATUSES, PERMISSIONS, SCOPES, levenshtein };
