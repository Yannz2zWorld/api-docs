'use strict';
// Serving CDN files (/cdn/<id>): files kept in Postgres are sent as they are; big files kept in the
// bucket (R2/B2) are passed through, so the visitor stays on this domain. Used by index.js (Vercel)
// and cdn-server.js (a VPS that serves the same links without Vercel's size limit).
const cdnService = require('./cdnService');
const mediaProxy = require('./mediaProxyService');

function handler({ pieces }) {
  return async (req, res) => {
    const id = String(req.params.id || '');
    if (!cdnService.isValidId(id)) return res.status(404).json({ status: false, error: 'NOT_FOUND' });
    try {
      const f = await cdnService.fetchFile(id);
      if (!f) return res.status(404).json({ status: false, error: 'NOT_FOUND' });
      if ('redirect' in f) {   // large file kept in R2 / B2 / catbox
        if (!f.redirect) return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE' });
        // Without the size limit (a VPS) the whole file streams through, ranges as asked.
        return pieces ? serveLargeFile(req, res, id, f) : mediaProxy.stream(req, res, f.redirect, { safeHeaders: safeFileHeaders });
      }
      return sendStoredFile(res, f);
    } catch (e) {
      return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE' });
    }
  };
}

// A response from this server can't carry more than about 4.5 MB (Vercel), so a big file is sent in
// pieces of at most CDN_PIECE bytes, as range answers (206): video and audio players ask for the
// rest themselves, and keep seeking. A browser opening the link gets a small player page that
// does the same. A plain request for the whole file (a bot or server downloading it) is sent to a
// short-lived link to the file itself, as no single answer from here could hold it.
const CDN_PIECE = 4 * 1024 * 1024;
const PLAYABLE = /^(video|audio|image)\//;
function serveLargeFile(req, res, id, f) {
  const size = f.size || 0;
  const header = String(req.get('range') || '');
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (m && size && (m[1] || m[2])) {
    let start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    let end = m[1] && m[2] ? Number(m[2]) : size - 1;
    if (start >= size) { res.set('Content-Range', `bytes */${size}`); return res.status(416).end(); }
    end = Math.min(end, size - 1, start + CDN_PIECE - 1);
    return mediaProxy.stream(req, res, f.redirect, { safeHeaders: safeFileHeaders, range: `bytes=${start}-${end}` });
  }
  if (!size || size <= CDN_PIECE) return mediaProxy.stream(req, res, f.redirect, { safeHeaders: safeFileHeaders });
  const kind = PLAYABLE.exec(f.mime || '')?.[1];
  if (req.get('sec-fetch-dest') === 'document' && kind) {
    const src = `/cdn/${encodeURIComponent(id)}`;
    const el = kind === 'video' ? `<video controls playsinline preload="metadata" src="${src}"></video>` : kind === 'audio' ? `<audio controls preload="metadata" src="${src}"></audio>` : `<img alt="" src="${src}">`;
    const title = String(f.name || id).replace(/[<>&"]/g, c => `&#${c.charCodeAt(0)};`);
    res.set('Cache-Control', 'no-store');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Content-Type-Options', 'nosniff');
    // the media element loads in pieces from this domain; a big picture (no range requests) comes from the short-lived link
    res.set('Content-Security-Policy', "default-src 'none'; media-src 'self'; img-src 'self' https:; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox");
    return res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>html,body{margin:0;height:100%;background:#000}body{display:grid;place-items:center}video,img{max-width:100%;max-height:100vh}audio{width:min(480px,92vw)}</style></head><body>${el}</body></html>`);
  }
  res.set('Cache-Control', 'no-store');
  return res.redirect(302, f.redirect);
}

// Files are served from this domain: safe types open in the browser, everything else downloads, and
// the sandbox CSP keeps any uploaded / fetched content from running script here.
function sendStoredFile(res, f) {
  const fname = encodeURIComponent(f.name).replace(/['()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  res.set('Cache-Control', 'public, max-age=86400, immutable');
  res.set('Content-Type', f.mime);
  res.set('Content-Length', String(f.size));
  res.set('Content-Disposition', `${f.inline ? 'inline' : 'attachment'}; filename*=UTF-8''${fname}`);
  safeFileHeaders(res, f.mime);
  return res.end(f.buffer);
}
function safeFileHeaders(res, mime) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', mime === 'application/pdf' ? "default-src 'none'; frame-ancestors 'none'" : "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox");
  res.set('Cross-Origin-Resource-Policy', 'cross-origin');
}

module.exports = { handler, serveLargeFile, sendStoredFile, safeFileHeaders, CDN_PIECE };
