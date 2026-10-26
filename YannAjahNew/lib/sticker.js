'use strict';
// Stiker WhatsApp (webp 512x512 + metadata pack/author). Butuh ffmpeg dengan libwebp.
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

const S = f => feature({ category: 'sticker', cooldown: 5, dependencies: { bins: ['ffmpeg'] }, ...f });
const meta = (ctx, txt) => { const [p, a] = String(txt || '').split('|').map(s => s && s.trim()); return { packname: p || ctx.config.bot.packname, author: a || ctx.config.bot.author }; };

module.exports = { S, meta };
