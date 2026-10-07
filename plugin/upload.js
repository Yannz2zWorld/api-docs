// Unggah gambar ke CDN (disimpan di Postgres, dilayani di /cdn/<id>). Mengembalikan URL publik
// yang bisa dipakai endpoint lain yang hanya menerima "url" (bukan upload file).
// Kirim file lewat POST (tombol unggah di Sandbox), bukan link.
const cdn = require('../services/cdnService');

module.exports = {
  name: 'Upload Gambar (CDN)',
  desc: 'Unggah gambar lalu dapat URL publik di domain ini. Pakai URL-nya untuk endpoint yang minta "url".',
  category: 'Tools',
  path: '/api/tools/upload',
  upload: true,
  params: [
    { name: 'image', required: true, type: 'file', accept: 'image/*', placeholder: 'Unggah gambar (maks 8 MB)' },
    // Opsional: file sementara yang terhapus otomatis setelah N jam (0 / kosong = permanen).
    { name: 'ttlHours', required: false, placeholder: '0 = permanen' }
  ],
  async run(req, res) {
    if (!req.apiAuth) return res.status(401).json({ status: false, error: 'AUTH_REQUIRED' });
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || !buf.length) {
      return res.status(400).json({ status: false, error: 'NO_FILE', message: 'Kirim gambar lewat unggah (POST), bukan link.' });
    }
    const ttlHours = Math.max(0, Math.min(24 * 365, Number(req.query.ttlHours || req.query.ttl || 0) || 0));
    try {
      const saved = await cdn.store({ buffer: buf, ownerId: req.apiAuth.userId || null, ttlHours });
      return res.json({
        status: true,
        result: { url: cdn.absoluteUrl(req, saved.id), id: saved.id, mime: saved.mime, size: saved.size, expiresAt: saved.expiresAt }
      });
    } catch (e) {
      if (e.code === 'FILE_TOO_LARGE') return res.status(413).json({ status: false, error: 'FILE_TOO_LARGE', message: 'Gambar maksimal 8 MB.' });
      if (e.code === 'NOT_IMAGE') return res.status(400).json({ status: false, error: 'NOT_IMAGE', message: 'File harus gambar (png/jpg/webp/gif/bmp).' });
      if (e.code === 'NO_FILE') return res.status(400).json({ status: false, error: 'NO_FILE', message: 'File kosong.' });
      if (e.code === 'DATABASE_NOT_CONFIGURED' || e.isDatabaseError) {
        return res.status(503).json({ status: false, error: 'CDN_UNAVAILABLE', message: 'Penyimpanan belum siap. Jalankan migrasi 012_cdn_files.sql di Neon.' });
      }
      return res.status(500).json({ status: false, error: 'CDN_FAILED' });
    }
  }
};
