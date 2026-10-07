// ============================================================================
// TEMPLATE ENDPOINT PROXY (server lain)
// ----------------------------------------------------------------------------
// Cara pakai:
//   1. Copy file ini, ganti nama (mis. clutch-tofigure.js).
//   2. Isi bagian KONFIGURASI di bawah.
//   3. Simpan API key server itu sebagai ENV di Vercel (JANGAN ditulis di sini).
//   4. Upload lewat Developer Panel -> Endpoints -> Tambah endpoint.
//
// Auth / tier / kuota sudah diurus gateway sebelum run() dipanggil.
// req.apiAuth berisi { tier, keyId, quota } kalau butuh.
// ============================================================================
const axios = require('axios');

// ----------------------------- KONFIGURASI ----------------------------------
const UPSTREAM_BASE = 'https://api.contoh-server.com'; // base URL server lain
const UPSTREAM_PATH = '/v1/endpoint';                  // path di server itu
const API_KEY_ENV   = 'CONTOH_API_KEY';                // nama ENV di Vercel
const API_KEY_MODE  = 'header';                        // 'header' | 'query' | 'none'
const API_KEY_NAME  = 'x-api-key';                     // nama header / query key
// -----------------------------------------------------------------------------

module.exports = {
  name: 'Contoh Endpoint',                 // judul di katalog
  desc: 'Deskripsi singkat endpoint ini.', // keterangan
  category: 'Tools',                       // folder kategori di katalog
  path: '/api/tools/contoh',               // alamat publik di web kamu

  // Parameter yang diminta dari user (tampil di Sandbox).
  params: [
    { name: 'text', required: true, placeholder: 'kata kunci', max: 200 }
    // Untuk minta FOTO/FILE pakai: { name: 'image', required: true, type: 'file', accept: 'image/*' }
  ],

  async run(req, res) {
    if (!req.apiAuth) return res.status(401).json({ status: false, error: 'AUTH_REQUIRED' });

    const key = process.env[API_KEY_ENV];
    if (API_KEY_MODE !== 'none' && !key) {
      // fail-safe: tidak memotong kuota kalau belum dikonfigurasi
      return res.status(503).json({ status: false, error: 'UPSTREAM_NOT_CONFIGURED', hint: `Set ENV ${API_KEY_ENV} di Vercel.` });
    }

    // Ambil parameter dari query ATAU body.
    const src = { ...(req.query || {}), ...(req.body || {}) };
    const text = (src.text || '').toString().trim();
    if (!text) return res.status(400).json({ status: false, error: 'MISSING_PARAM', param: 'text' });

    const params = { text };
    const headers = {};
    if (API_KEY_MODE === 'header') headers[API_KEY_NAME] = key;
    if (API_KEY_MODE === 'query')  params[API_KEY_NAME] = key;

    try {
      const r = await axios.get(UPSTREAM_BASE + UPSTREAM_PATH, {
        params, headers, timeout: 30000, validateStatus: () => true,
        responseType: 'json'
      });
      if (r.status >= 400) {
        return res.status(502).json({ status: false, error: 'UPSTREAM_FAILED', code: r.status });
      }
      return res.json({ status: true, result: r.data });
    } catch (e) {
      const timeout = e && (e.code === 'ECONNABORTED' || /timeout/i.test(e.message || ''));
      return res.status(timeout ? 504 : 502).json({ status: false, error: timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_FAILED' });
    }
  }
};
