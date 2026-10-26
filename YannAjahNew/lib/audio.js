'use strict';
// Konversi & efek audio/video (butuh ffmpeg). Input: kirim atau reply converter.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');
const converter = require('../library/converter');

const M = f => feature({ category: 'media', cooldown: 10, limit: 1, dependencies: { bins: ['ffmpeg'] }, ...f });
async function needMedia(ctx, re, label) {
  const md = ctx.media();
  if (!md || !re.test(md.mime)) throw new UsageError(`Kirim atau reply ${label} dengan caption ${ctx.prefix}${ctx.command}`);
  const buf = await md.download();
  if (buf.length > ctx.config.media.maxDownloadBytes) throw new UsageError('File terlalu besar.');
  return buf;
}
const AV = /^(audio|video)\//;

// Satu efek audio per filter di converter.AUDIO_FILTERS (plugins/media/<nama>.js).
function audioFilter(name) {
  if (!converter.AUDIO_FILTERS[name]) throw new Error(`Filter audio '${name}' tidak ada`);
  const [desc, filter] = converter.AUDIO_FILTERS[name];
  return M({
    id: `media.audio.${name}`, name: name === 'reverse' ? 'reverseaudio' : name === 'sad' ? 'sadaudio' : name, category: 'media', description: `Efek audio: ${desc} (reply audio/video)`,
    aliases: name === 'chipmunk' ? ['tupai'] : name === '8d' ? ['audio8d'] : [],
    async run(ctx) { const buf = await needMedia(ctx, AV, 'audio/video'); await ctx.react('⏳'); await ctx.sendFile({ buffer: await converter.toMp3(buf, filter), mime: 'audio/mpeg' }); }
  });
}

module.exports = { M, needMedia, AV, audioFilter };
