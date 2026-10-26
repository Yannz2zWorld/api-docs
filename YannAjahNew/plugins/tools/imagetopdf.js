'use strict';
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { toJpeg, buildPdf } = require('../../lib/pdf');

module.exports = feature({ id: 'tools.imagetopdf', name: 'imagetopdf', aliases: ['img2pdf', 'gambartopdf', 'topdf'], category: 'tools', description: 'Ubah gambar jadi file PDF (A4)', usage: '[nama file] (kirim/reply gambar)', cooldown: 5,
  async run(ctx) {
    const md = ctx.media();
    if (!md || !/^image\//.test(md.mime)) throw new UsageError(`Kirim atau reply gambar dengan caption ${ctx.prefix}${ctx.command}`);
    let buf = await md.download();
    if (md.mime === 'image/webp') buf = await require('../../library/converter').toPng(buf);
    const name = (ctx.text || 'gambar').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'gambar';
    await ctx.sendFile({ buffer: buildPdf([await toJpeg(buf)]), mime: 'application/pdf' }, { asDocument: true, fileName: `${name}.pdf`, caption: '📄 Gambar → PDF' });
  } });
