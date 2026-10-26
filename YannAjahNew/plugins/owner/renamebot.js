'use strict';
const { O, RENAME, applyOverrides, scheduleBackup, scheduleRestart } = require('../../lib/owner-settings');

let applied = false;   // override tersimpan diterapkan sekali setelah bot start

module.exports = O({ id: 'owner.renamebot', name: 'renamebot', aliases: ['setconfig'], description: 'Ubah identitas bot: .renamebot <kunci> <nilai>', usage: '<kunci> <nilai>',
  async run(ctx) {
    const key = (ctx.args[0] || '').toLowerCase(); const val = ctx.args.slice(1).join(' ').trim();
    if (!RENAME[key] || !val) return ctx.reply(`╭一緒 *Rename Bot*\n${Object.keys(RENAME).map((k, i) => `│୭ ˚.ᵎᵎ ${i + 1}. ${k} = ${ctx.config[RENAME[k][0]][RENAME[k][1]]}`).join('\n')}\n╰─────────一緒\nContoh: ${ctx.prefix}renamebot botname Yann Bot\nNomor owner utama diatur di settingsbot.js/.env.`);
    const st = ctx.db.settings(); st.configOverrides = { ...(st.configOverrides || {}), [key]: val.slice(0, 200) };
    ctx.db.touch(); applyOverrides(ctx.config, st);
    await ctx.reply(`✅ ${key} diubah menjadi: ${val}`);
  },
  // Terapkan override yang tersimpan sekali saat pesan pertama setelah start.
  async onMessage(ctx) { if (!applied) { applied = true; applyOverrides(ctx.config, ctx.db.settings()); const st = ctx.db.settings(); scheduleRestart(st.autoRestartHours, ctx.logger); scheduleBackup(ctx.yannajah, ctx.config, st.autoBackupHours); } return false; } });
