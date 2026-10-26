'use strict';
// Balasan AI otomatis (V15: .autoai on/off, .aimention on/off) lewat APIZ2Z (/api/ai/chatgpt, cadangan gemini).
//   autoai    : semua pesan teks (bukan command) di chat itu dibalas AI
//   aimention : di grup, AI membalas hanya saat bot di-tag atau pesan bot di-reply
// Ada jeda per chat supaya tidak boros kuota API dan tidak spam.
const { feature } = require('../library/plugin-kit');
const { jidUser } = require('../library/function');
const { callFirst, dataOf } = require('./apiz2z-kit');
const { primaryText, payloadOf } = require('../library/apiz2z-render');

const COOLDOWN_MS = 6000;
const last = new Map();
const store = (ctx, key) => { const s = ctx.db.settings(); s[key] = s[key] || {}; return s[key]; };

async function answer(ctx, prompt) {
  const persona = `Kamu adalah ${ctx.config.bot.name}, asisten WhatsApp yang ramah. Jawab singkat dalam bahasa yang dipakai pengguna.`;
  const { result } = await callFirst(ctx, [['/api/ai/chatgpt', { prompt: `${persona}\n\n${prompt}`, chatId: `yannajah-${jidUser(ctx.m.chat)}` }], ['/api/ai/gemini', { prompt: `${persona}\n\n${prompt}` }]]);
  const text = result.kind === 'text' ? result.text : primaryText(payloadOf(result.data)) || (typeof dataOf(result) === 'string' ? dataOf(result) : null);
  if (text) await ctx.reply(String(text).slice(0, 4000));
}

function botMentioned(ctx) {
  const me = ctx.yannajah.socket?.user;
  if (!me) return false;
  const ids = new Set([`${jidUser(me.id)}@s.whatsapp.net`, me.lid ? `${jidUser(me.lid)}@lid` : null].filter(Boolean));
  return ctx.m.mentionedJid.some(j => ids.has(j)) || Boolean(ctx.m.quoted?.key?.fromMe);
}

function autoAiFeature(kind) {
  const key = kind === 'autoai' ? 'autoAi' : 'aiMention';
  const label = kind === 'autoai' ? 'Auto AI (semua pesan dibalas AI)' : 'AI saat bot di-tag/di-reply';
  return feature({
    id: `ai.${kind}`, name: kind, category: 'ai', description: `${label}: .${kind} on/off (di grup: admin)`, usage: 'on/off', cooldown: 2,
    dependencies: { apiz2z: '/api/ai/chatgpt' },
    async run(ctx) {
      if (ctx.m.isGroup && !ctx.isAdmin && !ctx.isOwner) return ctx.reply(ctx.config.mess.admin || 'Khusus admin grup.');
      if (!ctx.m.isGroup && !ctx.isOwner && kind === 'aimention') return ctx.reply('Fitur ini untuk grup.');
      const s = store(ctx, key);
      const v = (ctx.args[0] || '').toLowerCase();
      if (!['on', 'off'].includes(v)) return ctx.reply(`${label}: *${s[ctx.m.chat] ? 'ON' : 'OFF'}*\n${ctx.usage()}`);
      if (v === 'on') s[ctx.m.chat] = true; else delete s[ctx.m.chat];
      ctx.db.touch();
      await ctx.reply(`✅ ${label} ${v === 'on' ? 'dinyalakan' : 'dimatikan'} di chat ini.`);
    },
    async onMessage(ctx) {
      const m = ctx.m;
      if (m.fromMe || m.isCmd || !m.text || m.text.length < 2) return false;
      if (!ctx.db.settings()[key]?.[m.chat]) return false;
      if (kind === 'aimention' && !botMentioned(ctx)) return false;
      if (kind === 'autoai' && ctx.db.settings().aiMention?.[m.chat] && botMentioned(ctx)) return false;   // dijawab aimention
      const now = Date.now();
      if (now - (last.get(m.chat) || 0) < COOLDOWN_MS) return false;
      last.set(m.chat, now);
      await answer(ctx, m.text.slice(0, 2000)).catch(e => ctx.logger.warn('auto AI gagal', e.code || e.message));
      return false;
    }
  });
}

module.exports = { autoAiFeature, botMentioned };
