const axios = require("axios");

const TIKWM = "https://www.tikwm.com";
// Only TikTok links are forwarded upstream (www/m/vm/vt.tiktok.com and similar).
function isTiktokUrl(value) {
  try {
    const u = new URL(value);
    return (u.protocol === "https:" || u.protocol === "http:") && (u.hostname === "tiktok.com" || u.hostname.endsWith(".tiktok.com"));
  } catch {
    return false;
  }
}

function formatNumber(integer) {
  return Number(parseInt(integer) || 0).toLocaleString().replace(/,/g, '.');
}

function formatDate(n, locale = "en") {
  return new Date(n * 1000).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric'
  });
}

const absolute = path => (!path ? null : path.startsWith("http") ? path : TIKWM + path);

async function tiktokDl(url) {
  const { data } = await axios.post(
    TIKWM + "/api/",
    {},
    {
      timeout: 15000,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        Origin: TIKWM,
        Referer: TIKWM + "/",
        "User-Agent": "Mozilla/5.0",
        "X-Requested-With": "XMLHttpRequest"
      },
      params: {
        url,
        count: 12,
        cursor: 0,
        web: 1,
        hd: 1
      }
    }
  );

  const res = data?.data;
  if (!res) throw new Error("Data kosong");

  const media = Array.isArray(res.images) && res.images.length > 0
    ? res.images.map(v => ({ type: "photo", url: absolute(v) }))
    : [
      { type: "watermark", url: absolute(res.wmplay) },
      { type: "nowatermark", url: absolute(res.play) },
      { type: "nowatermark_hd", url: absolute(res.hdplay) }
    ];

  const music = res.music_info || {};
  const author = res.author || {};
  return {
    status: true,
    title: res.title,
    taken_at: formatDate(res.create_time),
    region: res.region,
    id: res.id,
    durations: res.duration,
    duration: res.duration + " Seconds",
    cover: absolute(res.cover),
    data: media,
    music_info: {
      id: music.id,
      title: music.title,
      author: music.author,
      album: music.album || null,
      url: absolute(res.music || music.play)
    },
    stats: {
      views: formatNumber(res.play_count),
      likes: formatNumber(res.digg_count),
      comment: formatNumber(res.comment_count),
      share: formatNumber(res.share_count),
      download: formatNumber(res.download_count)
    },
    author: {
      id: author.id,
      fullname: author.unique_id,
      nickname: author.nickname,
      avatar: absolute(author.avatar)
    }
  };
}

module.exports = {
  name: "Tiktok Downloader",
  desc: "Download video atau slideshow Tiktok tanpa watermark.",
  category: "Downloader",
  path: "/api/download/tiktok?url=",
  async run(req, res) {
    const url = typeof req.query.url === "string" ? req.query.url.trim() : "";

    // Authentication, tier, and quota are enforced by the gateway in index.js.
    if (!req.apiAuth) {
      return res.status(401).json({ status: false, error: "Apikey invalid atau tidak terdaftar" });
    }
    if (!url) {
      return res.status(400).json({ status: false, error: "INVALID_PARAMETER", message: "Parameter 'url' wajib diisi" });
    }
    if (url.length > 500 || !isTiktokUrl(url)) {
      return res.status(400).json({ status: false, error: "INVALID_PARAMETER", message: "Parameter 'url' harus link TikTok (contoh: https://vt.tiktok.com/...)." });
    }

    try {
      const result = await tiktokDl(url);
      return res.status(200).json({
        status: true,
        result
      });
    } catch (error) {
      // Upstream (tikwm) failure: a stable code for clients; the gateway refunds the quota.
      return res.status(502).json({
        status: false,
        error: "UPSTREAM_FAILED",
        message: "Layanan sumber TikTok sedang bermasalah. Coba lagi nanti."
      });
    }
  }
};
