// Endpoint added from the owner panel. The metadata registers the route (see the plugin loader in
// index.js); the uploaded script between the markers handles it. It exports either a function
// (req, res) or an object with run(req, res). Tier, lock and status live in the endpoints table.
const meta = {
  "name": "IQC Pink",
  "desc": "Bikin gambar IQC Pink dari teks yang kamu kasih",
  "category": "Maker",
  "path": "/api/maker/iqc-pink",
  "params": [
    {
      "name": "q",
      "required": true,
      "placeholder": "aku sayang kamu"
    }
  ]
};

const uploaded = { exports: {} };
(function (module, exports) {
// ---- uploaded script ----
module.exports = async (req, res) => {
  const q = req.query.q;
  if (!q || !String(q).trim()) {
    return res.status(400).json({
      status: false,
      error: "PARAM_REQUIRED",
      message: "Parameter 'q' wajib diisi."
    });
  }

  try {
    const url = `https://api-moondrowend.web.id/api/maker/iqcpink?text=${encodeURIComponent(q)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });

    if (!r.ok) {
      return res.status(502).json({
        status: false,
        error: "UPSTREAM_ERROR",
        message: "Server sumber lagi error, coba lagi ya."
      });
    }

    const ctype = r.headers.get("content-type") || "";
    const buf = Buffer.from(await r.arrayBuffer());

    if (!buf.length) {
      return res.status(404).json({
        status: false,
        error: "NOT_FOUND",
        message: "Gambar nggak ketemu."
      });
    }

    if (ctype.includes("application/json")) {
      try {
        const j = JSON.parse(buf.toString("utf8"));
        return res.status(200).json({ status: true, result: j });
      } catch {}
    }

    res.setHeader("Content-Type", ctype.startsWith("image/") ? ctype : "image/png");
    return res.status(200).send(buf);
  } catch (e) {
    if (e.name === "TimeoutError" || e.name === "AbortError") {
      return res.status(504).json({
        status: false,
        error: "UPSTREAM_TIMEOUT",
        message: "Servernya lama banget, timeout."
      });
    }
    return res.status(502).json({
      status: false,
      error: "UPSTREAM_ERROR",
      message: "Gagal ambil gambar dari server."
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
