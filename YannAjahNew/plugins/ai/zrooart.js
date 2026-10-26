'use strict';
// Zroo Art (V15: .zrooart) — text-to-image dengan pilihan style & rasio. Provider: aiart-zroo.onrender.com.
// STATUS: IMPLEMENTED — NOT TESTED (provider pihak ketiga, bisa berubah/mati). Tidak pakai key.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { request } = require('../../library/net');

const STYLES = ['None', '3D Model', 'Analog Film', 'Anime', 'Cinematic', 'Comic Book', 'Digital Art', 'Enhance', 'Fantasy Art', 'Isometric', 'Line Art', 'Low Poly', 'Neon Punk', 'Origami', 'Photographic', 'Pixel Art', 'Tile Texture'];
const RATIOS = ['16:9', '1:1', '9:16', '4:5', '5:4', '2:3', '3:2', '21:9', '9:21'];
const HOST = 'aiart-zroo.onrender.com';
const pick = a => a[Math.floor(Math.random() * a.length)];

module.exports = feature({
  id: 'ai.zrooart', name: 'zrooart', category: 'ai', cooldown: 10, limit: 1,
  description: 'Text-to-image dengan pilihan style & rasio', usage: '<prompt>|<style?>|<ratio?>',
  params: [{ name: 'prompt', required: true }], dependencies: { apis: ['zroo'] },
  async run(ctx) {
    const input = (ctx.text || '').split('|').map(s => s.trim());
    const prompt = input[0];
    if (!prompt) throw new UsageError(`*Format:* ${ctx.prefix}${ctx.command} <prompt> | <style?> | <ratio?>\nStyle: ${STYLES.join(', ')}\nRasio: ${RATIOS.join(', ')}`);
    let style = input[1] || 'Fantasy Art'; if (style.toLowerCase() === 'random') style = pick(STYLES);
    let ratio = input[2] || '16:9'; if (ratio.toLowerCase() === 'random') ratio = pick(RATIOS);
    await ctx.react('⏳');
    const body = new URLSearchParams({ video_description: prompt, test_mode: 'false', negative_prompt: 'blurry, distorted, bad quality', aspect_ratio: ratio, style, output_format: 'png', seed: '0' }).toString();
    const r = await request(`https://${HOST}/generate`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', accept: '*/*' }, body, allowHosts: [HOST], timeoutMs: 120000 });
    let json; try { json = JSON.parse(r.body.toString('utf8')); } catch { json = null; }
    if (!json?.success || !json.image_path) throw new UsageError('Gagal membuat gambar, coba lagi nanti.');
    await ctx.sendFile(`https://${HOST}${json.image_path}`, { caption: `🎨 *Zroo Art*\nPrompt: ${prompt}\nStyle: ${style} · Rasio: ${ratio}` });
  }
});
