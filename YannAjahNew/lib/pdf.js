'use strict';
// PDF sederhana dari gambar (1 gambar = 1 halaman A4, gambar JPEG dipasang utuh, tanpa library tambahan).
const { Jimp } = require('jimp');

const A4 = [595.28, 841.89];

async function toJpeg(buf) {
  const img = await Jimp.read(buf);
  if (Math.max(img.bitmap.width, img.bitmap.height) > 2480) img.scaleToFit({ w: 2480, h: 2480 });
  return { data: await img.getBuffer('image/jpeg', { quality: 85 }), w: img.bitmap.width, h: img.bitmap.height };
}

// images: [{ data: Buffer JPEG, w, h }] -> Buffer PDF
function buildPdf(images) {
  const objs = [];
  const add = body => { objs.push(body); return objs.length; };
  const catalog = add(null), pages = add(null);
  const kids = [];
  for (const im of images) {
    const scale = Math.min((A4[0] - 40) / im.w, (A4[1] - 40) / im.h);
    const dw = im.w * scale, dh = im.h * scale, x = (A4[0] - dw) / 2, y = (A4[1] - dh) / 2;
    const imgId = add([`<< /Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.data.length} >>\nstream\n`, im.data, '\nendstream']);
    const content = `q ${dw.toFixed(2)} 0 0 ${dh.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im0 Do Q`;
    const contentId = add([`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
    kids.push(add([`<< /Type /Page /Parent ${pages} 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>`]));
  }
  objs[catalog - 1] = [`<< /Type /Catalog /Pages ${pages} 0 R >>`];
  objs[pages - 1] = [`<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`];
  const chunks = [Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n', 'latin1')];
  let offset = chunks[0].length;
  const xref = [];
  objs.forEach((parts, i) => {
    xref.push(offset);
    const bufs = [Buffer.from(`${i + 1} 0 obj\n`), ...parts.map(p => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'latin1'))), Buffer.from('\nendobj\n')];
    for (const b of bufs) { chunks.push(b); offset += b.length; }
  });
  const xrefStart = offset;
  chunks.push(Buffer.from(`xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${xref.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`, 'latin1'));
  return Buffer.concat(chunks);
}

module.exports = { toJpeg, buildPdf };
