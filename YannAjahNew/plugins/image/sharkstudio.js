'use strict';
// Shark Studio (V15: .sharkstudio) — gabungkan 2 foto (cowok+cewek) jadi 1 foto studio pakai kostum hiu,
// lewat APIZ2Z nano-banana. Dua langkah: foto 1 disimpan, lalu reply foto 2 dengan .sharkstudio lagi.
// Premium. .batalkostum untuk membatalkan sesi.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { sendResult } = require('../../lib/apiz2z-kit');

const PROMPT = 'Cowok dan cewek pada dua foto berdiri berhadapan di depan studio polos ungu pastel. Wajah, rambut, ekspresi, dan pakaian tetap persis seperti foto asli. Cowok pakai topi kostum hiu biru, cewek topi kostum hiu pink. Pencahayaan soft studio, portrait 9:16, realistic studio photography.';
const sessions = new Map();   // key -> Buffer foto pertama

async function merge(buf1, buf2) {
  const [a, b] = await Promise.all([loadImage(buf1), loadImage(buf2)]);
  const W = 576, H = 1024, gap = 16;
  const c = createCanvas(W * 2 + gap, H);
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height);
  const cover = (img, x) => { const s = Math.max(W / img.width, H / img.height); const w = img.width * s, h = img.height * s; g.drawImage(img, x + (W - w) / 2, (H - h) / 2, w, h); };
  cover(a, 0); cover(b, W + gap);
  return c.encode('jpeg', 90);
}

module.exports = [
  feature({
    id: 'image.sharkstudio', name: 'sharkstudio', category: 'image', permission: 'premium', cooldown: 10, limit: 1,
    description: 'Gabung 2 foto jadi foto studio kostum hiu (AI, 2 langkah)', usage: '(reply foto 1, lalu foto 2)',
    dependencies: { apiz2z: '/api/ai/nano-banana' },
    async run(ctx) {
      const md = ctx.media();
      if (!md || !/^image\//.test(md.mime)) throw new UsageError('Reply foto (langkah 1 lalu langkah 2) dengan caption .sharkstudio');
      const key = `${ctx.m.chat}:${ctx.m.sender}`;
      const buf = await md.download();
      if (!sessions.has(key)) {
        sessions.set(key, buf);
        setTimeout(() => sessions.delete(key), 5 * 60 * 1000).unref?.();
        return ctx.reply('✅ Foto pertama disimpan.\nSekarang reply *foto kedua* dengan caption *.sharkstudio* lagi.\nBatalkan: *.batalkostum*');
      }
      const first = sessions.get(key); sessions.delete(key);
      await ctx.react('⏳');
      const merged = await merge(first, buf);
      const result = await ctx.api.post('/api/ai/nano-banana', { prompt: PROMPT, mode: 'edit' }, { buffer: merged, mime: 'image/jpeg' });
      await sendResult(ctx, result, { title: 'Shark Studio', category: 'image', caption: ctx.config.mess.done });
      await ctx.react('✅');
    }
  }),
  feature({
    id: 'image.batalkostum', name: 'batalkostum', category: 'image', cooldown: 2,
    description: 'Batalkan sesi .sharkstudio',
    async run(ctx) {
      const key = `${ctx.m.chat}:${ctx.m.sender}`;
      if (sessions.delete(key)) await ctx.reply('✅ Sesi shark studio dibatalkan.');
      else await ctx.reply('Tidak ada sesi shark studio yang aktif.');
    }
  })
];
