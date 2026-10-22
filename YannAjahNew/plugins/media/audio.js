'use strict';
// Konversi & efek audio/video (butuh ffmpeg). Input: kirim atau reply media.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const media = require('../../library/media');

const M = f => feature({ category: 'media', cooldown: 10, limit: 1, dependencies: { bins: ['ffmpeg'] }, ...f });
async function needMedia(ctx, re, label) {
  const md = ctx.media();
  if (!md || !re.test(md.mime)) throw new UsageError(`Kirim atau reply ${label} dengan caption ${ctx.prefix}${ctx.command}`);
  const buf = await md.download();
  if (buf.length > ctx.config.media.maxDownloadBytes) throw new UsageError('File terlalu besar.');
  return buf;
}
const AV = /^(audio|video)\//;

module.exports = [
  ...Object.entries(media.AUDIO_FILTERS).map(([name, [desc, filter]]) => M({
    id: `media.audio.${name}`, name: name === 'reverse' ? 'reverseaudio' : name, category: 'media', description: `Efek audio: ${desc} (reply audio/video)`,
    aliases: name === 'chipmunk' ? ['tupai'] : name === '8d' ? ['audio8d'] : [],
    async run(ctx) { const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.react('⏳'); await ctx.sendFile({ buffer: await media.toMp3(buf, filter), mime: 'audio/mpeg' }); }
  })),
  M({ id: 'media.tomp3', name: 'tomp3', aliases: ['toaudio'], description: 'Ubah video/audio jadi MP3', async run(ctx) { const buf = await needMedia(ctx, AV, 'video/audio'); await ctx.sendFile({ buffer: await media.toMp3(buf), mime: 'audio/mpeg' }, { fileName: 'audio.mp3' }); } }),
  M({ id: 'media.tovn', name: 'tovn', aliases: ['toptt', 'vn'], description: 'Ubah audio/video jadi voice note', async run(ctx) { const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await media.toOpus(buf), mime: 'audio/ogg' }, { ptt: true }); } }),
  M({ id: 'media.volume', name: 'volumeaudio', aliases: ['setvolume'], description: 'Atur volume audio: .volumeaudio 1.5 (0.1 - 10)', usage: '<faktor>', async run(ctx) { const f = Number(ctx.args[0]); if (!(f > 0 && f <= 10)) throw new UsageError(ctx.usage()); const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await media.setVolume(buf, f), mime: 'audio/mpeg' }); } }),
  M({ id: 'media.trim', name: 'potongaudio', aliases: ['trimaudio', 'cut'], description: 'Potong audio: .potongaudio <mulai detik> <durasi detik>', usage: '<mulai> <durasi>', async run(ctx) { const [s, d] = ctx.args.map(Number); if (!(s >= 0 && d > 0)) throw new UsageError(ctx.usage()); const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.sendFile({ buffer: await media.trimAudio(buf, s, d), mime: 'audio/mpeg' }); } }),
  M({ id: 'media.togif', name: 'togif', description: 'Ubah video (maks 8 detik) jadi GIF', async run(ctx) { const buf = await needMedia(ctx, /^video\/|image\/webp/, 'video/stiker animasi'); const gif = await media.toGif(buf); await ctx.sendFile({ buffer: await media.toMp4(gif), mime: 'video/mp4' }, { gif: true, caption: 'GIF' }); } }),
  M({ id: 'media.tovideo', name: 'tovideo', aliases: ['tomp4'], description: 'Ubah stiker animasi/GIF jadi video MP4', async run(ctx) { const buf = await needMedia(ctx, /image\/(webp|gif)|video\//, 'stiker animasi/GIF'); await ctx.sendFile({ buffer: await media.toMp4(buf), mime: 'video/mp4' }); } }),
  M({ id: 'media.toimg', name: 'toimg', aliases: ['topng'], description: 'Ubah stiker jadi gambar PNG', async run(ctx) { const buf = await needMedia(ctx, /image\/webp/, 'stiker'); await ctx.sendFile({ buffer: await media.toPng(buf), mime: 'image/png' }); } })
];
