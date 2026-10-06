const axios = require("axios");

const TIKWM = "https://www.tikwm.com";
// Only TikTok links are forwarded upstream (www/m/vm/vt.tiktok.com and similar). Accepts what people
// actually paste: long share links full of tracking parameters, the app's share text with the link
// inside it, a missing "https://", or trailing punctuation. Returns a clean https link without the
// query string or fragment (TikTok identifies the video by its path), or null if there is no TikTok
// link in the input.
const MAX_INPUT = 4096;
function isTiktokHost(hostname) {
  return hostname === "tiktok.com" || hostname.endsWith(".tiktok.com");
}
function normalizeTiktokUrl(raw) {
  if (typeof raw !== "string" || !raw.trim() || raw.length > MAX_INPUT) return null;
  const candidates = raw.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  if (!candidates.length && /^(?:[\w-]+\.)*tiktok\.com\//i.test(raw.trim())) candidates.push("https://" + raw.trim());
  for (const candidate of candidates) {
    try {
      const u = new URL(candidate.replace(/[),.;!?\]]+$/, ""));
      if ((u.protocol !== "https:" && u.protocol !== "http:") || !isTiktokHost(u.hostname.toLowerCase())) continue;
      u.protocol = "https:";
      u.search = "";
      u.hash = "";
      return u.toString();
    } catch {
      // not a URL; try the next candidate
    }
  }
  return null;
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
  normalizeTiktokUrl,
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
    const link = normalizeTiktokUrl(url);
    if (!link) {
      return res.status(400).json({ status: false, error: "INVALID_PARAMETER", message: "Parameter 'url' harus link TikTok (contoh: https://vt.tiktok.com/... atau https://www.tiktok.com/@user/video/...)." });
    }

    try {
      const result = await tiktokDl(link);
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
