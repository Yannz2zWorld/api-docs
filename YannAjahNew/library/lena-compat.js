'use strict';
// Lapisan kompatibilitas plugin Lena AI v15 / Yann AI V15 (format `handler.command = [...]`).
// Plugin lama dipanggil persis seperti di Lena: handler(m, { lena, Reply, isCreator, text, ... }).
//
//   lenaMessage(m, sock)   -> objek m versi Lena (m.text = isi pesan LENGKAP, m.msg, m.mtype, m.quoted.msg, ...)
//                             tanpa mengubah m asli milik router YannAjah.
//   lenaSocket(sock, ...)  -> socket + helper Lena (sendAsSticker, downloadAndSaveMediaMessage, getFile, ...)
//   lenaContext(...)       -> isi objek kedua handler (sama dengan `alipdev` di lena-cmd.js)
//
// Helper global (isRegistered, isPrem, checkLimit, addLimit, isReseller) dipasang router (yannai-cmd.js)
// dan memakai database YannAjah, jadi limit/premium plugin lama sama dengan fitur baru.

const fs = require('fs');
const path = require('path');
const { sniffMime, sleep, runtime, isUrl, jidUser } = require('./function');
const { download } = require('./net');

const TMP = path.join(__dirname, 'database', 'sampah');
const toIDR = n => `Rp${Number(n || 0).toLocaleString('id-ID')}`;
const capital = s => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const decodeJid = jid => {
  if (!jid || typeof jid !== 'string') return jid;
  const m = /^([^:@]+)(?::\d+)?@(.+)$/.exec(jid);
  return m ? `${m[1]}@${m[2]}` : jid;
};

function contentOf(message, type) {
  if (!message || !type) return null;
  const c = message[type];
  if (c && typeof c === 'object' && c.message) {          // viewOnce / ephemeral / documentWithCaption
    const inner = Object.keys(c.message)[0];
    return c.message[inner];
  }
  return c;
}

// Objek m gaya Lena. Field Y