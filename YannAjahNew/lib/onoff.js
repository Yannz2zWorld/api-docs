'use strict';
// .on <fitur> / .off <fitur> (V15): satu pintu untuk semua pengaturan on/off grup (antilink, welcome,
// mute, antibot, ...). Menjalankan command pengaturannya dengan argumen on/off, izin tetap dicek.
const { feature } = require('../library/plugin-kit');

const isToggle = f => ['group', 'owner'].includes(f.category) && /\bon\s*[/|]\s*off\b/i.test(`${f.usage || ''} ${f.description || ''}`);

function onOff(mode) {
  return feature({
    id: `group.${mode}`, name: mode, category: 'group', scope: 'group', permission: 'admin', description: `${mode === 'on' ? 'Nyalakan' : 'Matikan'} fitur grup: .${mode} <fitur> (tanpa nama fitur = daftar)`, usage: '<fitur>', cooldown: 2,
    async run(ctx) {
      const all = ctx.yannajah.plugins.list().filter(isToggle).filter(f => f.category === 'group' || ctx.isOwner);
      const name = (ctx.args[0] || '').toLowerCase();
      const target = name && ctx.yannajah.plugins.get(name);
      if (!target || !isToggle(target) || (target.category === 'owner' && !ctx.isOwner)) {
        const rows = all.map(f => `◦ ${f.name}`).sort().join('\n');
        return ctx.reply(`⚙️ *Fitur yang bisa di-${mode}*\n${rows}\n\nContoh: ${ctx.prefix}${mode} antilink`);
      }
      if (target.botAdmin && !ctx.m.isBotAdmin) return ctx.reply('Bot harus jadi admin grup untuk fitur ini.');
      const sub = Object.create(ctx);
      // Pengaturan berbentuk "<pilihan> <on|off>" (mis. antibot delete on): on/off di belakang.
      const rest = ctx.args.slice(1);
      sub.args = /^<[^>]+>\s+<on\|off>/.test(target.usage || '') ? [...(rest.length ? rest : ['delete']), mode] : [mode, ...rest];
      sub.text = sub.args.join(' ');
      sub.usage = () => `${ctx.prefix}${target.name} ${target.usage || ''}`.trim();
      await target.run(sub);
    }
  });
}

module.exports = { onOff, isToggle };
