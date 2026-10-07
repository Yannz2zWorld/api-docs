// Downloader endpoints served through api.theresav.eu (see lib/theresav.js). Needs THERESAV_API_KEY.
// Every endpoint takes the link to download as `url` (Play takes a song title as `query`).
const { makeEndpoint } = require('../lib/theresav');

const link = (example) => [{ name: 'url', required: true, max: 2048, aliases: ['link'], placeholder: example }];

const ENDPOINTS = [
  ['aio', 'AIO Downloader', 'Download videos and music from TikTok, YouTube, Facebook, Instagram and more in one endpoint.', 'https://youtube.com/shorts/…'],
  ['applemusic', 'Apple Music Downloader', 'Download Apple Music songs as MP3.', 'https://music.apple.com/…'],
  ['capcut', 'CapCut Template Downloader', 'Download the video and metadata of a CapCut template.', 'https://www.capcut.com/template-detail/…'],
  ['dailymotion', 'Dailymotion Downloader', 'Download Dailymotion videos with a choice of resolutions.', 'https://www.dailymotion.com/video/…'],
  ['douyin', 'Douyin Downloader', 'Download watermark-free videos or slide images from Douyin (TikTok China).', 'https://v.douyin.com/…'],
  ['facebook', 'Facebook Downloader', 'Download HD/SD videos or image posts from Facebook.', 'https://www.facebook.com/…'],
  ['getsticker', 'GetStickerPack Downloader', 'Get the sticker image links of a getstickerpack.com pack.', 'https://getstickerpack.com/stickers/…'],
  ['instagram', 'Instagram Downloader', 'Download videos and photos from Instagram Reels and posts.', 'https://www.instagram.com/reel/…'],
  ['kolid', 'Instagram Downloader (KOL.ID)', 'Download Instagram videos, photos, reels and stories via KOL.ID.', 'https://www.instagram.com/…'],
  ['likee', 'Likee Downloader', 'Download watermark-free videos from Likee.', 'https://likee.video/…'],
  ['mediafire', 'Mediafire Downloader', 'Get the file details and direct download link of a Mediafire file.', 'https://www.mediafire.com/file/…'],
  ['mixcloud', 'Mixcloud Downloader', 'Get the metadata and stream URLs of Mixcloud music and audio.', 'https://www.mixcloud.com/…'],
  ['pinterest', 'Pinterest Downloader', 'Download original-quality images and videos from Pinterest.', 'https://pin.it/…'],
  ['reddit', 'Reddit Downloader', 'Download videos and images from Reddit posts.', 'https://www.reddit.com/r/…'],
  ['scribd', 'Scribd Downloader', 'Get the image link of every page of a Scribd document.', 'https://www.scribd.com/document/…'],
  ['sfile', 'Sfile Downloader', 'Get the direct download link of an Sfile.co file.', 'https://sfile.co/…'],
  ['shopee', 'Shopee Video Downloader', 'Download videos and metadata from Shopee Video and shp.ee short links.', 'https://shp.ee/…'],
  ['spotify', 'Spotify Downloader', 'Download a Spotify track as MP3 320 kbps with lyrics (track links only, not albums or playlists).', 'https://open.spotify.com/track/…'],
  ['stickerly', 'Sticker.ly Downloader', 'Get the details and stickers of a Sticker.ly pack.', 'https://sticker.ly/s/…'],
  ['telestick', 'Telegram Sticker Downloader', 'Get the details and stickers of a Telegram sticker pack.', 'https://t.me/addstickers/…'],
  ['terabox', 'Terabox Downloader', 'Download files and videos from Terabox links.', 'https://www.terabox.com/s/…'],
  ['threads', 'Threads Downloader', 'Download videos and images from Threads posts.', 'https://www.threads.net/@…/post/…'],
  ['twitter', 'X (Twitter) Downloader', 'Download videos and images with metadata from X/Twitter posts.', 'https://x.com/…/status/…'],
  ['vdko', 'VDKO / VDY.TO Downloader', 'Get the direct MP4 link of a VDKO or VDY.TO video.', 'https://vdy.to/…'],
  ['weibo', 'Weibo Downloader', 'Download videos and photos from Weibo posts without logging in.', 'https://weibo.com/…'],
  ['xhs', 'Xiaohongshu Downloader', 'Download images and videos with metadata from Xiaohongshu (RED) posts.', 'https://www.xiaohongshu.com/…'],
  ['ytdl', 'YouTube Stream Extractor', 'Get the direct video and audio stream links with metadata of a YouTube video.', 'https://youtube.com/watch?v=…']
].map(([slug, name, desc, example]) => ({ name, desc, category: 'Downloader', path: `/api/download/${slug}`, upstream: `/api/download/${slug}`, params: link(example) }));

ENDPOINTS.push(
  { name: 'Play (Song Search & MP3)', desc: 'Search a song by title or keywords and download it as MP3 320 kbps with lyrics.', category: 'Downloader', path: '/api/download/play', upstream: '/api/download/play',
    params: [{ name: 'query', required: true, aliases: ['q', 'text'], max: 200, placeholder: 'jj epep' }] },
  { name: 'YouTube Audio Downloader', desc: 'Download YouTube audio in the format and bitrate you choose.', category: 'Downloader', path: '/api/download/ytmp3', upstream: '/api/download/ytmp3',
    params: [...link('https://youtube.com/watch?v=…'), { name: 'format', options: ['mp3', 'opus', 'ogg', 'm4a', 'flac', 'wav', 'aac'], default: 'mp3' }, { name: 'bitrate', options: ['64k', '128k', '192k', '256k', '320k'], default: '128k' }] },
  { name: 'YouTube Video Downloader', desc: 'Download a YouTube video in the resolution you choose.', category: 'Downloader', path: '/api/download/ytmp4', upstream: '/api/download/ytmp4',
    params: [...link('https://youtube.com/watch?v=…'), { name: 'resolution', options: ['360', '480', '720', '1080', '1440', '2160'], default: '720' }] }
);

module.exports = ENDPOINTS.map(makeEndpoint);
