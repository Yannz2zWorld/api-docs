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
    // to_jsonb: the start time and the Dev announcement (migration 022) are optional columns.
    const row = (await query('SELECT to_jsonb(server_settings.*) AS s FROM server_settings WHERE id=1'))[0]?.s || {};
    cached = {
      enabled: row.maintenance_enabled === true,
      message: String(row.maintenance_message || '').trim() || DEFAULT_MESSAGE,
      since: row.maintenance_enabled === true ? row.maintenance_since || null : null,
      announcement: announcement(row)
    };
  } catch (e) {
    // Without the database nothing works anyway; do not lock the owner out on a read error.
    console.error('Maintenance flag read failed:', { code: e?.code || null });
    cached = { enabled: false, message: DEFAULT_MESSAGE, since: null, announcement: null };
  }
  cachedAt = Date.now();
  return cached;
}

// The Developer panel's "Pengumuman Dev" (shown on the sign-in page and Home); null when empty.
function announcement(row) {
  const message = String(row.announce_message || '').trim();
  if (!message) return null;
  return {
    id: String(row.announce_at ? new Date(row.announce_at).getTime() : 0),
    message,
    message2: String(row.announce_message2 || '').trim(),
    buttonLabel: String(row.announce_button_label || '').trim(),
    buttonUrl: String(row.announce_button_url || '').trim(),
    at: row.announce_at || null
  };
}

// What the announcement cards show (GET /auth/announce, and the maintenance sign-in page).
async function publicState() {
  const s = await state();
  return { maintenance: s.enabled ? { message: s.message, since: s.since } : null, announcement: s.announcement };
}

function invalidate() { cached = null; cachedAt = 0; }

module.exports = { state, publicState, invalidate, DEFAULT_MESSAGE };
