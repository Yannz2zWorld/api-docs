// Lets users verify their API key / session and see their quota without calling an upstream service.
// Authentication, tier, and quota are enforced by the gateway in index.js before run() is called.
module.exports = {
  name: "Ping",
  desc: "Cek API key/sesi dan sisa kuota harian tanpa memanggil layanan pihak ketiga.",
  category: "Tools",
  path: "/api/tools/ping",
  async run(req, res) {
    if (!req.apiAuth) {
      return res.status(401).json({ status: false, error: "AUTH_REQUIRED" });
    }
    const { tier, keyId, quota } = req.apiAuth;
    return res.json({
      status: true,
      result: {
        pong: true,
        tier,
        auth: keyId ? "api_key" : "session",
        quota: { used: quota.used, limit: quota.limit, remaining: quota.remaining, resetAt: quota.resetAt },
        serverTime: new Date().toISOString()
      }
    });
  }
};
