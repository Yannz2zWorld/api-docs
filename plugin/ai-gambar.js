// AI Gambar: bikin gambar dari teks pakai Google Gemini (Nano Banana, gemini-2.5-flash-image).
// Cuma teks, tanpa upload foto. Hasilnya disimpan ke CDN situs ini (24 jam), jadi yang dikirim
// ke pengguna link https://cdn.apiz2z.web.id/cdn/<id>, bukan link provider.
// Env: GEMINI_API_KEY (Sensitive). Opsional: GEMINI_IMAGE_MODEL.
const cdn = require('../services/cdnService');

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const TIMEOUT_MS = 60000;
const KEEP_HOURS = 24;
const MAX_PROMPT = 1000;

const fail = (res, status, error, message) => res.status(status).json({ status: false, error, message });

async function run(req, res) {
  const prompt = typeof req.query.prompt === 'string' ? req.query.prompt.trim() : '';
  if (!prompt) return fail(res, 400, 'PARAM_REQUIRED', "Parameter 'prompt' wajib diisi.");
  if (prompt.length > MAX_PROMPT) return fail(res, 400, 'PROMPT_TOO_LONG', `Prompt maksimal ${MAX_PROMPT} karakter.`);

  const key = process.env.GEMINI_API_KEY;
  if (!key) return fail(res, 503, 'UPSTREAM_NOT_CONFIGURED', 'Endpoint ini belum aktif. Kuota nggak dipotong.');

  let r, data;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    data = await r.json().catch(() => null);
  } catch (e) {
    const timeout = e.name === 'TimeoutError' || e.name === 'AbortError';
    return fail(res, timeout ? 504 : 502, timeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR', timeout ? 'Bikin gambarnya kelamaan, coba lagi.' : 'Gagal nyambung ke server AI.');
  }

  if (r.status === 401 || r.status === 403) return fail(res, 502, 'API_AUTH_FAILED', 'Key AI ditolak. Cek GEMINI_API_KEY.');
  if (r.status === 429) return fail(res, 429, 'RATE_LIMITED', 'Lagi rame, kuota AI habis sementara. Coba lagi sebentar.');
  if (r.status >= 500) return fail(res, 502, 'UPSTREAM_ERROR', 'Server AI lagi bermasalah.');
  if (!r.ok) return fail(res, 400, 'UPSTREAM_REJECTED', 'Prompt-nya ditolak server AI. Coba kalimat lain.');

  if (data?.promptFeedback?.blockReason) return fail(res, 400, 'PROMPT_BLOCKED', 'Prompt-nya diblok filter keamanan. Coba kalimat lain.');
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find(p => p.inlineData?.data)?.inlineData;
  if (!img) return fail(res, 422, 'NO_IMAGE', 'AI nggak ngasih gambar. Coba perjelas prompt-nya.');

  const buffer = Buffer.from(img.data, 'base64');
  if (!cdn.sniff(buffer)) return fail(res, 502, 'INVALID_IMAGE', 'Hasil dari AI bukan gambar yang valid.');
  if (buffer.length > cdn.MAX_BYTES) return fail(res, 502, 'FILE_TOO_LARGE', 'Gambarnya kegedean buat disimpan.');

  let saved;
  try {
    saved = await cdn.store({ buffer, name: `ai-${Date.now()}.png`, type: img.mimeType || 'image/png', ttlHours: KEEP_HOURS, imagesOnly: true });
  } catch (e) {
    return fail(res, 502, 'CDN_ERROR', 'Gambarnya jadi, tapi gagal disimpan ke CDN. Coba lagi.');
  }

  return res.json({
    status: true,
    result: { url: cdn.absoluteUrl(req, saved.id), model: MODEL, expires_at: saved.expiresAt }
  });
}

module.exports = {
  name: 'AI Gambar',
  desc: 'Bikin gambar dari teks pakai AI Gemini, hasilnya disimpan di CDN 24 jam.',
  category: 'AI',
  path: '/api/ai/gambar?prompt=',
  params: [{ name: 'prompt', required: true, placeholder: 'kucing astronot di bulan, gaya kartun' }],
  run
};
