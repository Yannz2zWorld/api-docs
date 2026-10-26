'use strict';
// Website jadi APK (V15: .web2apk / .webtoapk / .convertweb) lewat webtonative.com (publik).
// STATUS: IMPLEMENTED — NOT TESTED (layanan pihak ketiga, build bisa lama/gagal). Premium.
const { feature } = require('../../library/plugin-kit');
const { UsageError } = require('../../library/errors');
const { request } = require('../../library/net');
const { sleep } = require('../../library/function');

const HOST = 'www.webtonative.com';
const BASE = `https://${HOST}/api/v1`;
const HEADERS = { 'content-type': 'application/json', origin: `https://${HOST}`, referer: `https://${HOST}/`, 'user-agent': 'Mozilla/5.0 (Linux; Android 10) Chrome/127 Mobile' };
const randomEmail = () => Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('') + '@gmail.com';

module.exports = feature({
  id: 'tools.web2apk', name: 'web2apk', aliases: ['webtoapk', 'convertweb'], category: 'tools', permission: 'premium', cooldown: 30, limit: 1,
  description: 'Ubah website jadi APK (webtonative)', usage: '<NamaApp>|<https://website>',
  dependencies: { apis: ['webtonative'] },
  async run(ctx) {
    const [appName, websiteUrl] = (ctx.text || '').split('|').map(s => s && s.trim());
    if (!appName || !/^https?:\/\//.test(websiteUrl || '')) throw new UsageError('Contoh: .web2apk TokoKu|https://tokoku.com');
    await ctx.react('⏳'); await ctx.reply(ctx.config.mess.wait);
    const post = async (p, body) => { const r = await request(`${BASE}${p}`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body), allowHosts: [HOST], timeoutMs: 30000 }); return JSON.parse(r.body.toString('utf8')); };
    const build = await post('/build-app-request', { appName, emailId: randomEmail(), packageId: 'WEBTONATIVE_STARTER', websiteUrl, referralCode: '', utmInfo: {}, device_type: 'website', browser: 'chrome' });
    if (!build?.requestId) throw new UsageError('Gagal memulai build APK.');
    let done = null;
    for (let i = 0; i < 60 && !done; i++) {
      await sleep(5000);
      const r = await request(`${BASE}/check-app-status?requestId=${encodeURIComponent(build.requestId)}`, { headers: HEADERS, allowHosts: [HOST], timeoutMs: 30000 });
      const st = JSON.parse(r.body.toString('utf8'));
      if (st.android_status === 'DONE' || st.ios_status === 'DONE') done = st;
    }
    if (!done) throw new UsageError('Build APK timeout / gagal, coba lagi nanti.');
    await ctx.reply(`✅ *Web to APK*\nApp: ${appName}\nWebsite: ${websiteUrl}\nRequest ID: ${build.requestId}\n\nAndroid: ${BASE}/demo/download/${build.requestId}/ANDROID\nStatus Android: ${done.android_status}`);
  }
});
