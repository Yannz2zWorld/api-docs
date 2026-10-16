// Endpoint added from the owner panel. The metadata registers the route (see the plugin loader in
// index.js); the uploaded script between the markers handles it. It exports either a function
// (req, res) or an object with run(req, res). Tier, lock and status live in the endpoints table.
const meta = {
  "name": "Deep Nude",
  "desc": "Deep Nude Undress ~ man or woman",
  "category": "Ai",
  "path": "/api/ai/deepnude-ai",
  "params": [
    {
      "name": "url",
      "required": true,
      "placeholder": "Masukkan url"
    },
    {
      "name": "type",
      "required": true,
      "placeholder": "Masukkan type"
    }
  ]
};

const uploaded = { exports: {} };
(function (module, exports) {
// ---- uploaded script ----

const axios = require('axios');
const FormData = require('form-data');
const cdn = require('../services/cdnService');

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const KEEP_HOURS = 24;
const API_URL = 'https://api.pitucode.com/deep-nude-ai-undress';

const fail = (res, status, error, message) =>
  res.status(status).json({
    status: false,
    error,
    message
  });

module.exports = async (req, res) => {
  try {
    if (req.method !== 'GET') {
      return fail(
        res,
        405,
        'METHOD_NOT_ALLOWED',
        'Gunakan method GET.'
      );
    }

    const { url, type } = req.query;

    if (!url || !type) {
      return fail(
        res,
        400,
        'PARAM_REQUIRED',
        "Parameter 'url' dan 'type' wajib diisi."
      );
    }

    const t = String(type).toLowerCase().trim();

    if (!['woman', 'man'].includes(t)) {
      return fail(
        res,
        400,
        'INVALID_TYPE',
        "Type harus 'woman' atau 'man'."
      );
    }

    const apiKey = process.env.PITUCODE_API_KEY;

    if (!apiKey) {
      return fail(
        res,
        503,
        'UPSTREAM_NOT_CONFIGURED',
        'API key belum dikonfigurasi.'
      );
    }

    if (
      !cdn ||
      typeof cdn.store !== 'function' ||
      typeof cdn.sniff !== 'function' ||
      typeof cdn.absoluteUrl !== 'function'
    ) {
      return fail(
        res,
        500,
        'CDN_NOT_CONFIGURED',
        'CDN service belum tersedia.'
      );
    }

    // Validasi URL input
    let parsedUrl;

    try {
      parsedUrl = new URL(url);

      if (
        !['http:', 'https:'].includes(parsedUrl.protocol) ||
        parsedUrl.username ||
        parsedUrl.password
      ) {
        throw new Error('Invalid URL');
      }
    } catch {
      return fail(
        res,
        400,
        'INVALID_URL',
        'URL gambar tidak valid.'
      );
    }

    // Mencegah akses langsung ke host internal.
    // Untuk deployment publik, sebaiknya tambahkan pemeriksaan
    // DNS/IP dan validasi setiap redirect untuk mencegah SSRF.
    const hostname = parsedUrl.hostname.toLowerCase();

    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname === '::1' ||
      hostname === '169.254.169.254' ||
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
    ) {
      return fail(
        res,
        400,
        'URL_NOT_ALLOWED',
        'Host URL gambar tidak diizinkan.'
      );
    }

    // Download gambar input
    let imgRes;

    try {
      imgRes = await axios.get(parsedUrl.href, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 0,
        maxContentLength: MAX_INPUT_BYTES,
        validateStatus: status => status >= 200 && status < 300
      });
    } catch (err) {
      const tooLarge =
        err.code === 'ERR_BAD_RESPONSE' ||
        /maxContentLength/i.test(err.message);

      return fail(
        res,
        tooLarge ? 413 : err.code === 'ECONNABORTED' ? 504 : 502,
        tooLarge ? 'FILE_TOO_LARGE' :
          err.code === 'ECONNABORTED' ? 'FETCH_TIMEOUT' : 'FETCH_FAILED',
        tooLarge ? 'Ukuran gambar input maksimal 5 MB.' :
          err.code === 'ECONNABORTED'
            ? 'Download gambar timeout.'
            : 'Gagal mengambil gambar. Pastikan URL dapat diakses langsung.'
      );
    }

    const inputType = String(
      imgRes.headers['content-type'] || ''
    ).split(';')[0].toLowerCase();

    const extensions = {
      'image/jpeg': 'image.jpg',
      'image/png': 'image.png'
    };

    if (!extensions[inputType]) {
      return fail(
        res,
        400,
        'INVALID_IMAGE',
        'Format gambar input harus JPG atau PNG.'
      );
    }

    const inputBuffer = Buffer.from(imgRes.data);

    if (inputBuffer.length > MAX_INPUT_BYTES) {
      return fail(
        res,
        413,
        'FILE_TOO_LARGE',
        'Ukuran gambar input maksimal 5 MB.'
      );
    }

    if (!cdn.sniff(inputBuffer)) {
      return fail(
        res,
        400,
        'INVALID_IMAGE',
        'Isi file bukan gambar yang valid.'
      );
    }

    // Kirim gambar ke PituCode
    const form = new FormData();

    form.append('type', t.toUpperCase());
    form.append('image', inputBuffer, {
      filename: extensions[inputType],
      contentType: inputType
    });

    let response;

    try {
      response = await axios.post(API_URL, form, {
        headers: {
          ...form.getHeaders(),
          'x-api-key': apiKey
        },
        timeout: 60000,
        maxBodyLength: 6 * 1024 * 1024,
        maxContentLength: 2 * 1024 * 1024,
        validateStatus: () => true
      });
    } catch (err) {
      const timeout = [
        'ECONNABORTED',
        'ETIMEDOUT'
      ].includes(err.code);

      return fail(
        res,
        timeout ? 504 : 502,
        timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        timeout
          ? 'Proses AI timeout, coba lagi.'
          : 'Gagal terhubung ke API AI.'
      );
    }

    const data = response.data;

    if (response.status === 413) {
      return fail(
        res,
        413,
        'FILE_TOO_LARGE',
        'Gambar input terlalu besar.'
      );
    }

    if ([401, 403].includes(response.status)) {
      return fail(
        res,
        502,
        'API_AUTH_FAILED',
        'API key upstream ditolak.'
      );
    }

    if (response.status === 429) {
      return fail(
        res,
        429,
        'RATE_LIMITED',
        'Terlalu banyak request. Coba lagi nanti.'
      );
    }

    if (response.status >= 500) {
      return fail(
        res,
        502,
        'UPSTREAM_ERROR',
        'Server upstream sedang bermasalah.'
      );
    }

    if (response.status < 200 || response.status >= 300) {
      return fail(
        res,
        502,
        'UPSTREAM_REQUEST_FAILED',
        data?.message || 'Request upstream gagal.'
      );
    }

    if (!data?.success || !data?.data?.result) {
      return fail(
        res,
        404,
        'NO_RESULT',
        data?.message || 'Hasil gambar tidak ditemukan.'
      );
    }

    // Download hasil gambar dari upstream.
    // Jangan menerima URL hasil sembarang domain.
    let resultUrl;

    try {
      resultUrl = new URL(data.data.result);

      if (
        resultUrl.protocol !== 'https:' ||
        resultUrl.hostname !== 'api.pitucode.com' &&
        resultUrl.hostname !== 'pitucode.com' ||
        resultUrl.username ||
        resultUrl.password
      ) {
        throw new Error('Upstream result URL not allowed');
      }
    } catch {
      return fail(
        res,
        502,
        'INVALID_RESULT_URL',
        'URL hasil upstream tidak valid atau tidak diizinkan.'
      );
    }

    let resultResponse;

    try {
      resultResponse = await axios.get(resultUrl.href, {
        responseType: 'arraybuffer',
        timeout: 30000,
        maxRedirects: 0,
        maxContentLength: cdn.MAX_BYTES,
        validateStatus: status => status >= 200 && status < 300
      });
    } catch {
      return fail(
        res,
        502,
        'RESULT_DOWNLOAD_FAILED',
        'Gagal mengunduh hasil gambar dari upstream.'
      );
    }

    const resultType = String(
      resultResponse.headers['content-type'] || ''
    ).split(';')[0].toLowerCase();

    const resultExtensions = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/webp': 'webp'
    };

    if (!resultExtensions[resultType]) {
      return fail(
        res,
        502,
        'INVALID_RESULT',
        'Hasil upstream bukan format gambar yang didukung.'
      );
    }

    const resultBuffer = Buffer.from(resultResponse.data);

    if (
      resultBuffer.length === 0 ||
      resultBuffer.length > cdn.MAX_BYTES ||
      !cdn.sniff(resultBuffer)
    ) {
      return fail(
        res,
        502,
        'INVALID_RESULT',
        'Gambar hasil tidak valid atau melebihi batas CDN.'
      );
    }

    // Simpan ke CDN milik sendiri selama 24 jam.
    let saved;

    try {
      saved = await cdn.store({
        buffer: resultBuffer,
        name: `deep-ai-${Date.now()}.${resultExtensions[resultType]}`,
        type: resultType,
        ttlHours: KEEP_HOURS,
        imagesOnly: true
      });
    } catch (err) {
      console.error('CDN storage failed:', err.message);

      return fail(
        res,
        502,
        'CDN_ERROR',
        'Gambar berhasil diproses, tetapi gagal disimpan ke CDN.'
      );
    }

    if (!saved?.id) {
      return fail(
        res,
        502,
        'CDN_INVALID_RESPONSE',
        'CDN tidak mengembalikan ID file.'
      );
    }

    return res.status(200).json({
      status: true,
      result: {
        url: cdn.absoluteUrl(req, saved.id),
        type: data.data.process_type || t.toUpperCase(),
        expires_at: saved.expiresAt
      }
    });

  } catch (err) {
    console.error('Deep AI Turbo Error:', err.message);

    return res.status(500).json({
      status: false,
      error: 'INTERNAL_ERROR',
      message: 'Terjadi kesalahan pada server.'
    });
  }
};
// ---- end of uploaded script ----
})(uploaded, uploaded.exports);

const handler = uploaded.exports;
const run = typeof handler === 'function' ? handler : handler && typeof handler.run === 'function' ? handler.run.bind(handler) : null;
if (!run) throw new Error(meta.path + ': the uploaded script must export a function (req, res) or { run(req, res) }');
// The sandbox form shows the script's own parameters when it has them (lib/theresav, lib/apiproxy specs).
const params = meta.params || (handler && Array.isArray(handler.params) ? handler.params : undefined);
module.exports = { ...meta, ...(params ? { params } : {}), ...(handler && handler.upload ? { upload: true } : {}), run };
