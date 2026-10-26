'use strict';
// TikTok play (V15: .playtiktok / .tiktokplay / .ptv): cari video TikTok lalu kirim video pertama.
// .ptv mengirimnya sebagai video bulat (PTV), .ptvch ke saluran owner.
const crypto = require('crypto');
const { callFirst, dataOf } = require('./apiz2z-kit');
const { collectMedia, payloadOf } = require('../library/apiz2z-render');
const { UsageError } = require('../library/errors');

async function searchTiktok(ctx, q) {
  if (!q) throw new UsageError(`Mau cari video apa? Contoh: ${ctx.prefix}${ctx.command} jj luser`);
  const { result } = await callFirst(ctx, [['/api/search/tiktok', { q }], ['/api/search/tiktok-v2', { q }]]);
  let list = dataOf(result);
  if (!Array.isArray(list)) list = list?.videos || list?.data || list?.result || [];
  const videos = (Array.isArray(list) ? list : []).map(v => {
    const media = collectMedia(v).filter(x => x.kind === 'video');
    return { url: media[0]?.url, title: v?.title || v?.desc || '', author: v?.author?.nickname || v?.author?.unique_id || v?.author || '' };
  }).filter(v => v.url);
  if (!videos.length) {
    const any = collectMedia(payloadOf(result.data)).filter(x => x.kind === 'video');
    if (any.length) return [{ url: any[0].url, title: '', author: '' }];
    throw new UsageError('Video TikTok tidak ditemukan.');
  }
  return videos;
}

const pick = (videos, random) => (random ? videos[crypto.randomInt(0, Math.min(videos.length, 10))] : videos[0]);
const captionOf = v => `🎵 ${String(v.title || 'TikTok').slice(0, 200)}${v.author && typeof v.author === 'string' ? `\n👤 ${v.author}` : ''}`;

module.exports = { searchTiktok, pick, captionOf };
