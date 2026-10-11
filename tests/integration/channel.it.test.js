'use strict';
// WhatsApp channel button (views/channel.js): a WhatsApp logo bottom-left on every page that opens
// settings.whatsappChannelLink in a new tab.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const h = require('./helpers');
const settings = require('../../settings');

const view = f => fs.readFileSync(path.join(__dirname, '..', '..', 'views', f), 'utf8');
let app;
before(async () => { if (h.skip) return; await h.setupDatabase(); app = await h.startApp(); });
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);

it('the button script carries the channel link from settings.js', async () => {
  const js = await app.request('GET', '/assets/channel.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  assert.ok(js.text.includes(JSON.stringify(settings.whatsappChannelLink)), 'link from settings');
  assert.ok(!js.text.includes('__CHANNEL_URL__'));
  assert.match(settings.whatsappChannelLink, /^https:\/\/whatsapp\.com\/channel\//);

  // Run it against a tiny DOM: it adds one link, bottom-left, opening in a new tab.
  const added = [];
  const el = () => ({ setAttribute(k, v) { this[k] = v; } });
  const document = { body: { appendChild: n => added.push(n) }, head: { appendChild: n => added.push(n) },
    createElement: el, querySelector: () => null, addEventListener() {} };
  vm.runInNewContext(js.text, { window: {}, document });
  const a = added.find(n => n.className === 'ych-btn');
  assert.equal(a.href, settings.whatsappChannelLink);
  assert.equal(a.target, '_blank');
  assert.equal(a['aria-label'], 'Saluran WhatsApp');
  assert.match(added.find(n => n.textContent).textContent, /\.ych-btn\{position:fixed;left:18px;bottom:18px/);
});

it('every page shows the button, except the 3D game (its joystick sits bottom-left)', async () => {
  for (const f of ['index.html', 'login.html', 'api.html', 'playground.html', 'keys.html', 'billing.html', 'pricing.html', 'profile.html', 'upload.html', 'owner.html', 'custom-ui.html', 'maintenance.html']) {
    assert.match(view(f), /<script src="\/assets\/channel\.js" defer><\/script>/, f);
  }
  assert.ok(!view('scythe.html').includes('channel.js'));
  assert.match((await app.request('GET', '/pricing')).text, /\/assets\/channel\.js/);
  assert.equal(JSON.parse(view('i18n-en.json')).exact['Saluran WhatsApp'], 'WhatsApp channel');
});
