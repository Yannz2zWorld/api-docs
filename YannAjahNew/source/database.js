'use strict';
// Database lokal bot (JSON), menggantikan source/database.js base/V15.
// - Tulis atomik (file sementara + rename) agar file tidak korup saat proses mati di tengah tulis.
// - Simpan berkala + saat keluar. Backup .bak dibuat sebelum menimpa.
// - Struktur sama dengan V15 (users, groups, settings, database) ditambah stats & features.

const fs = require('fs');
const path = require('path');

const DEFAULTS = () => ({ users: {}, groups: {}, settings: {}, database: {}, features: {}, stats: { commands: {}, totalCommands: 0 }, owners: [], premium: [] });

class DataBase {
  constructor({ dir, file, logger } = {}) {
    if (!file || !/^[a-zA-Z0-9._-]+\.json$/.test(file)) throw new Error('Nama file database tidak valid');
    this.file = path.resolve(dir || 'library/database', file);
    this.logger = logger;
    this.data = DEFAULTS();
    this.dirty = false;
    this.timer = null;
  }

  async read() {
    let loaded = null;
    for (const f of [this.file, this.file + '.bak']) {
      if (!fs.existsSync(f)) continue;
      try { loaded = JSON.parse(await fs.promises.readFile(f, 'utf8')); break; }
      catch (e) { this.logger?.warn(`Database ${path.basename(f)} rusak, mencoba cadangan`, e.message); }
    }
    const base = DEFAULTS();
    if (loaded && typeof loaded === 'object' && !Array.isArray(loaded)) {
      for (const k of Object.keys(base)) if (loaded[k] !== undefined && typeof loaded[k] === typeof base[k]) base[k] = loaded[k];
      for (const k of Object.keys(loaded)) if (!(k in base)) base[k] = loaded[k];
    }
    this.data = base;
    if (!loaded) await this.write();
    return this.data;
  }

  async write(data = this.data) {
    const dir = path.dirname(this.file);
    await fs.promises.mkdir(dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    if (fs.existsSync(this.file)) await fs.promises.copyFile(this.file, this.file + '.bak').catch(() => {});
    await fs.promises.rename(tmp, this.file);
    this.dirty = false;
    return this.file;
  }

  writeSync() {
    const tmp = `${this.file}.${process.pid}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  markDirty() { this.dirty = true; }

  startAutoSave(intervalMs = 30000) {
    this.stopAutoSave();
    this.timer = setInterval(() => {
      if (!this.dirty) return;
      this.write().catch(e => this.logger?.error('Gagal menyimpan database', e.message));
    }, intervalMs);
    this.timer.unref?.();
  }

  stopAutoSave() { if (this.timer) clearInterval(this.timer); this.timer = null; }
}

module.exports = DataBase;
module.exports.DEFAULTS = DEFAULTS;
