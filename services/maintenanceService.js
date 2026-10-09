'use strict';
// "Maintenance Info Website": when the owner turns it on, the whole site (pages, sign-in,
// register, API) answers with the maintenance notice for everyone except the owner. Enforced on
// the server (index.js middleware + the sign-in handlers), never only in the browser.
// The flag lives in server_settings; each instance caches it for a few seconds.
const { query } = require('../lib/db');

const TTL_MS = 5000;
const DEFAULT_MESSAGE = 'Website lagi maintenance. Tunggu bentar sampai selesai ya.';
let cached = null;
let cachedAt = 0;

async function state() {
  if (cached && Date.now() - cachedAt < TTL_MS) return cached;
  try {
    const row = (await query('SELECT maintenance_enabled,maintenance_message FROM server_settings WHERE id=1'))[0] || {};
    cached = { enabled: row.maintenance_enabled === true, message: String(row.maintenance_message || '').trim() || DEFAULT_MESSAGE };
  } catch (e) {
    // Without the database nothing works anyway; do not lock the owner out on a read error.
    console.error('Maintenance flag read failed:', { code: e?.code || null });
    cached = { enabled: false, message: DEFAULT_MESSAGE };
  }
  cachedAt = Date.now();
  return cached;
}

function invalidate() { cached = null; cachedAt = 0; }

module.exports = { state, invalidate, DEFAULT_MESSAGE };
