'use strict';
// Payment proof uploads arrive as data URLs from the billing page. Only real JPEG, PNG or
// WebP bytes are accepted (checked by signature, not by the claimed type), at most 2 MB.
const crypto = require('crypto');

const MAX_BYTES = 2 * 1024 * 1024;

function sniff(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

// Returns { buffer, mime, size, sha256 } or { error } with a stable code.
function parseProofImage(dataUrl) {
  const m = /^data:image\/(?:jpeg|jpg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
  if (!m) return { error: 'INVALID_PROOF_IMAGE' };
  const buffer = Buffer.from(m[1].replace(/\s/g, ''), 'base64');
  if (!buffer.length) return { error: 'INVALID_PROOF_IMAGE' };
  if (buffer.length > MAX_BYTES) return { error: 'PROOF_TOO_LARGE' };
  const mime = sniff(buffer);
  if (!mime) return { error: 'INVALID_PROOF_IMAGE' };
  return { buffer, mime, size: buffer.length, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

module.exports = { parseProofImage, MAX_BYTES };
