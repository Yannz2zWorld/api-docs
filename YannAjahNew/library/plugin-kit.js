'use strict';
// Helper untuk menulis plugin dengan metadata lengkap tanpa mengulang boilerplate.
//
//   textTool({ id, name, category, description, fn, aliases, usage, tests })
//     -> fitur yang mengambil teks (argumen atau teks pesan yang di-reply) lalu membalas fn(teks).
//   feature({...}) -> isi default metadata (permission 'user', scope 'all', status 'implemented').
//
// `tests` = kasus uji murni [{ input, expect }] yang dijalankan tests/features.test.js
// (expect: string persis | RegExp | function(output) => boolean). Fitur yang lolos semua kasus
// dilaporkan berstatus "tested" oleh tools/feature-report.js.

const { UsageError } = require('./errors');

function feature(f) {
  return { aliases: [], params: [], dependencies: {}, permission: 'user', scope: 'all', status: 'implemented', source: 'internal', cooldown: 2, limit: 0, ...f };
}

// Teks input: argumen command, atau teks pesan yang di-reply.
function inputText(ctx) {
  return (ctx.text && ctx.text.trim()) || (ctx.m.quoted?.text || '').trim();
}

function textTool({ id, name, category, description, fn, aliases = [], usage = '<teks>', tests = [], maxInput = 4000, ...rest }) {
  return feature({
    id, name, category, description, aliases, usage, tests,
    params: [{ name: 'teks', required: true, description: 'teks input (atau reply pesan)' }],
    ...rest,
    pure: fn,
    async run(ctx) {
      const t = inputText(ctx);
      if (!t) throw new UsageError(`Teksnya mana? ${ctx.usage()}\n(bisa juga reply pesan)`);
      if (t.length > maxInput) throw new UsageError(`Teks maksimal ${maxInput} karakter.`);
      const out = await fn(t, ctx);
      await ctx.reply(String(out).slice(0, 60000) || '(kosong)');
    }
  });
}

module.exports = { feature, textTool, inputText };
