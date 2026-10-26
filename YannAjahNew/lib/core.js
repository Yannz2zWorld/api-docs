'use strict';
// Command inti: menu (dibangun dari registry), info bot, status lisensi/API, bantuan per command.
const { feature } = require('../library/plugin-kit');
const { buildMenu, buildAllMenu } = require('../source/yannai-menu');
const { runtime, bytesToSize } = require('../library/function');
const media = require('../library/mediastore');

const statusOpts = ctx => ({ apiKey: ctx.api?.hasKey?.() ?? true, disabledList: ctx.config.plugin.disabled });

// Gaya menu dari .setmenu (text/image/video/document); media dari .setimg, audio dari .setaudiomenu.
async function sendMenu(ctx, text) {
  const st = ctx.db.settings(); const style = st.menuStyle || 'text'; const imgs = st.images || {};
  const image = media.load(imgs.menu?.name) || ctx.config.image.menu;
  if (style === 'image' && image) await ctx.sendFile(image, { caption: text });
  else if (style === 'video' && media.load(imgs.menuvideo?.name)) await ctx.sendFile(media.load(imgs.menuvideo.name), { caption: text, gif: true });
  else if (style === 'document') await ctx.sendFile({ buffer: Buffer.from(text), mime: 'text/plain' }, { asDocument: true, fileName: `${ctx.config.bot.name}-menu.txt`, caption: text.slice(0, 1000) });
  else await ctx.reply(text);
  const audio = media.load(st.menuAudio?.name);
  if (audio) await ctx.sendFile(audio, { mimetype: st.menuAudio.mime || 'audio/mpeg' });
}

module.exports = { statusOpts, sendMenu };
