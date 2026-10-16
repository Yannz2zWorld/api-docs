// Endpoint added from the owner panel. The metadata registers the route (see the plugin loader in
// index.js); the uploaded script between the markers handles it. It exports either a function
// (req, res) or an object with run(req, res). Tier, lock and status live in the endpoints table.
const meta = {
  "name": "Alight Motion Send Prem",
  "desc": "Send verifikasi alight motion premium ke email anda",
  "category": "Premium",
  "path": "/api/premium/alightmotion-send-prem",
  "params": [
    {
      "name": "email",
      "required": true,
      "placeholder": "Masukkan email"
    }
  ]
};

const uploaded = { exports: {} };
(function (module, exports) {
// ---- uploaded script ----

const axios = require('axios');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({
      creator: 'YannzAjahBjir',
      status: false,
      message: 'Method not allowed'
    });
  }

  const { email } = req.query;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({
      creator: 'YannzAjahBjir',
      status: false,
      message: 'Parameter email wajib diisi'
    });
  }

  const apiKey = process.env.THERESAV_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      creator: 'YannzAjahBjir',
      status: false,
      message: 'API key belum dikonfigurasi'
    });
  }

  try {
    const response = await axios.get(
      'https://api.theresav.eu/api/premium/alightmotion/send',
      {
        params: { email },
        headers: {
          'x-apikey': apiKey
        },
        timeout: 30000
      }
    );

    return res.status(response.status).json({
      ...response.data,
      creator: 'YannzAjahBjir'
    });
  } catch (error) {
    return res.status(error.response?.status || 500).json({
      ...(error.response?.data || {}),
      creator: 'YannzAjahBjir',
      status: false,
      message:
        error.response?.data?.message ||
        'Gagal mengirim link verifikasi'
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
