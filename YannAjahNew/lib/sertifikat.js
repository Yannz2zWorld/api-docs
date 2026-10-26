'use strict';
// Sertifikat lucu V15 (.stkbaik, .stkganteng, ..., .sertifikat): kertas perkamen, bingkai emas, nama penerima.
const { canvas, fit, font, png } = require('../library/canvas');
const { feature } = require('../library/plugin-kit');
const { UsageError } = require('../library/errors');

function drawCertificate(name, achievement, { title = 'SERTIFIKAT', subtitle = 'Certificate of Achievement', botName = 'YannAjah AI', date = new Date() } = {}) {
  const W = 1400, H = 1000;
  const { c, g } = canvas(W, H);
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#fbf6e5'); bg.addColorStop(0.5, '#f6eed2'); bg.addColorStop(1, '#f2e4bf');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(200,180,140,0.12)';
  for (let i = 0; i < 400; i++) { g.beginPath(); g.arc((i * 7919) % W, (i * 104729) % H, (i % 4) + 1, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#8B4513'; g.lineWidth = 8; g.strokeRect(30, 30, W - 60, H - 60);
  g.strokeStyle = '#D4AF37'; g.lineWidth = 3; g.strokeRect(52, 52, W - 104, H - 104);
  g.textAlign = 'center'; g.textBaseline = 'alphabetic';
  g.fillStyle = '#8B4513'; g.font = font(96, true); g.fillText(title, W / 2, 210);
  g.fillStyle = '#654321'; g.font = font(36); g.fillText(subtitle, W / 2, 265);
  g.strokeStyle = '#D4AF37'; g.lineWidth = 3; g.beginPath(); g.moveTo(W / 2 - 180, 300); g.lineTo(W / 2 + 180, 300); g.stroke();
  g.font = font(32); g.fillText('Dengan ini menyatakan bahwa', W / 2, 380);
  const n = fit(g, name, 900, 90, { start: 76, min: 30, bold: true });
  g.font = font(n.size, true); g.fillStyle = '#8B4513'; g.fillText(n.lines[0], W / 2, 480);
  g.strokeStyle = '#D4AF37'; g.beginPath(); g.moveTo(W / 2 - 300, 505); g.lineTo(W / 2 + 300, 505); g.stroke();
  const a = fit(g, achievement, 900, 170, { start: 48, min: 24, bold: true });
  g.font = font(a.size, true); g.fillStyle = '#654321';
  a.lines.slice(0, 3).forEach((l, i) => g.fillText(l, W / 2, 600 + i * a.size * 1.25));
  g.font = font(26); g.fillStyle = '#654321';
  g.fillText(new Intl.DateTimeFormat('id-ID', { dateStyle: 'long', timeZone: 'Asia/Jakarta' }).format(date), 330, 880);
  g.fillText(botName, W - 330, 880);
  g.strokeStyle = '#8B4513'; g.lineWidth = 2;
  for (const x of [330, W - 330]) { g.beginPath(); g.moveTo(x - 150, 845); g.lineTo(x + 150, 845); g.stroke(); }
  g.fillStyle = '#D4AF37'; g.beginPath(); g.arc(W / 2, 860, 55, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#8B4513'; g.font = font(30, true); g.fillText('★', W / 2, 872);
  return png(c);
}

// Command sertifikat: .stkbaik <nama> (atau reply/tag -> nama orang itu).
function certificate(name, achievement, { aliases = [], description } = {}) {
  return feature({
    id: `fun.${name}`, name, aliases, category: 'fun', description: description || `Sertifikat: "${achievement}"`, usage: '<nama>', cooldown: 5, limit: 1,
    async run(ctx) {
      const who = (ctx.text || ctx.m.quoted?.pushName || '').trim().slice(0, 40);
      if (!who) throw new UsageError(`Nama tidak ada! Contoh: ${ctx.prefix}${ctx.command} Budi`);
      const text = typeof achievement === 'function' ? achievement(who) : achievement;
      await ctx.sendFile({ buffer: drawCertificate(who, text, { botName: ctx.config.bot.name }), mime: 'image/png' }, { caption: `📜 ${text}` });
    }
  });
}

module.exports = { drawCertificate, certificate };
