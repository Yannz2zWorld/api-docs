// Unggah file apa saja ke CDN (disimpan di Postgres, dilayani di /cdn/<id>.<ext>) dan dapat link
// publik di domain ini. Kirim file lewat POST (tombol unggah di Sandbox / halaman /upload), bukan link.
// ?name=<nama file asli> dipakai untuk ekstensi link dan nama unduhan.
const cdn = require('../services/cdnService');

module.exports = {
  name: 'Upload File (CDN)',
  desc: 'Unggah file apa saja (foto, video, audio, dokumen, dll.) lalu dapat link publik di domain ini.',
  category: 'Tools',
  path: '/api/tools/upload',
  upload: true,
  params: [
    { name: 'file', required: true, type: 'file', accept: '*/*', placeholder: 'Unggah file (maks 4 MB)' },
    { name: 'name', required: false, placeholder: 'nama file, mis. dokumen.pdf' },
    // Opsional: file sementara yang terhapus otomatis setelah N jam (0 / kosong = permanen).
    { name: 'ttlHours', required: false, placeholder: '0 = permanen' }
  ],
  async run(req, res) {
    if (!req.apiAuth) return res.status(401).json({ status: false, error: 'AUTH_REQUIRED' });
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || !buf.length) {
      return res.status(400).json({ status: false, error: 'NO_FILE', message: 'Kirim file lewat unggah (POST), bukan link.' });
    }
    const ttlHours = Math.max(0, Math.min(24 * 365, Number(req.query.ttlHours || req.query.ttl || 0) || 0));
    try {
      const saved = await cdn.store({
        buffer: buf,
        name: typeof req.query.name === 'string' ? req.query.name : null,
        type: req.get('content-type'),
        ownerId: req.apiAuth.userId || null,
        ttlHours
      });
      return res.json({
        status: true,
        result: { url: cdn.absoluteUrl(req, saved.id), id: saved.id, name: saved.name, mime: saved.mime, size: saved.size, preview: saved.inline, expiresAt: saved.expiresAt }
      });
    } catch (e) {
      if (e.code === 'FILE_TOO_LARGE') return res.status(413).json({ status: false, error: 'FILE_TOO_LARGE', message: 'File maksimal 4 MB.' });
      if (e.code === 'NO_FILE') return res.status(400).json({ status: false, error: 'NO_FILE', message: 'File kosong.' });
      if (e.code === 'DATABASE_NOT_CONFIGURED' || e.isDatabaseError) {
        return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE', message: 'Penyimpanan belum siap. Jalankan migrasi 012_cdn_files.sql di Neon.' });
      }
      return res.status(500).json({ status: false, error: 'CDN_FAILED' });
    }
  }
};
