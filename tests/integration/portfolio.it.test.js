'use strict';
// Portfolio (/portfolio) and Diriku Panel (/portfolio/panel): the owner edits everything on the
// page, the page renders the saved document inline, and nothing unsafe gets through.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

let app, owner, user;
before(async () => {
  if (h.skip) return;
  await h.setupDatabase();
  app = await h.startApp();
  owner = await app.login(h.OWNER_EMAIL);
  user = await app.login('visitor@example.test');
});
after(async () => { if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
const it = (name, fn) => test(name, { skip: h.skip }, fn);
const o = (method, url, body) => app.request(method, url, { cookie: owner, headers: { origin: app.origin }, body });
const inline = html => JSON.parse(html.match(/const PROFILE = (.*?) \|\| \{/)[1]);

const PROFILE = {
  name: 'Yannz', username: '@yannz', verified: true, bio: 'Halo', banner: 'https://cdn.example/banner.mp4', bannerRatio: '4 / 3', avatar: '/views/assets/portfolio/me.jpg',
  stats: [{ value: '10', label: 'Proyek' }],
  stories: [{ media: 'https://cdn.example/s1.jpg', caption: 'Baru!' }, { media: '' }],
  highlights: [{ title: 'Trip', cover: '', items: [{ media: 'https://cdn.example/h1.mp4' }] }, { title: '', items: [] }],
  projects: [{ title: 'API', desc: 'Platform', media: 'https://youtu.be/dQw4w9WgXcQ', link: '/api', tags: ['Node', ''] }],
  skills: ['JS', ''], experience: [{ when: '2025', what: 'Dev', where: 'Freelance' }],
  contact: { email: 'me@example.test', phone: '+62 812' },
  socials: [{ platform: 'whatsapp', url: '+62 812-3456-7890' }, { platform: 'youtube', url: 'https://youtube.com/@yannz' }, { platform: 'myspace', url: 'https://x.test' }],
};

it('page shows the built-in example until the owner saves, then the saved profile inline', async () => {
  const first = await app.request('GET', '/portfolio');
  assert.equal(first.status, 200);
  assert.equal(inline(first.text).username, 'yannz2zworld');

  const saved = await o('PUT', '/owner/portfolio', { profile: PROFILE });
  assert.equal(saved.status, 200, saved.text);
  const p = saved.json.profile;
  assert.equal(p.username, 'yannz', 'leading @ dropped');
  assert.equal(p.stories.length, 1, 'empty story dropped');
  assert.equal(p.highlights.length, 1, 'empty highlight dropped');
  assert.deepEqual(p.projects[0].tags, ['Node']);
  assert.deepEqual(p.skills, ['JS']);
  assert.deepEqual(p.socials, [{ platform: 'whatsapp', url: 'https://wa.me/6281234567890' }, { platform: 'youtube', url: 'https://youtube.com/@yannz' }], 'number becomes a wa.me link, unknown platform dropped');

  const page = await app.request('GET', '/portfolio');
  const shown = inline(page.text);
  assert.equal(shown.bannerRatio, '4 / 3');
  assert.equal(shown.stories[0].caption, 'Baru!');
  assert.equal((await app.request('GET', '/api/portfolio')).json.profile.name, 'Yannz');
  assert.equal((await o('GET', '/owner/portfolio')).json.saved, true);
});

it('refuses script links and other junk, and text cannot close the inline script', async () => {
  for (const bad of ['javascript:alert(1)', '//evil.example/x.jpg', 'data:text/html,hi', 'evil.example/x.jpg']) {
    const r = await o('PUT', '/owner/portfolio', { profile: { ...PROFILE, projects: [{ title: 'x', media: bad }] } });
    assert.equal(r.status, 400, bad);
    assert.equal(r.json.error, 'INVALID_PORTFOLIO');
  }
  assert.equal((await o('PUT', '/owner/portfolio', { profile: { ...PROFILE, username: 'a b' } })).json.field, 'username');
  assert.equal((await o('PUT', '/owner/portfolio', { profile: { ...PROFILE, name: ' ' } })).json.field, 'name');

  const r = await o('PUT', '/owner/portfolio', { profile: { ...PROFILE, bio: '</script><script>alert(1)</script>' } });
  assert.equal(r.status, 200);
  const page = (await app.request('GET', '/portfolio')).text;
  assert.ok(!page.includes('</script><script>alert(1)'), 'no raw closing tag in the page');
  assert.equal(inline(page).bio, '</script><script>alert(1)</script>', 'the text itself survives');
});

it('only the owner, only from this site; the panel page is owner-only too', async () => {
  assert.equal((await app.request('PUT', '/owner/portfolio', { cookie: user, headers: { origin: app.origin }, body: { profile: PROFILE } })).status, 403);
  assert.equal((await app.request('PUT', '/owner/portfolio', { headers: { origin: app.origin }, body: { profile: PROFILE } })).status, 401);
  assert.equal((await app.request('PUT', '/owner/portfolio', { cookie: owner, headers: { origin: 'https://evil.example' }, body: { profile: PROFILE } })).status, 403);
  assert.equal((await app.request('GET', '/owner/portfolio', { cookie: user })).status, 403);

  const anon = await app.request('GET', '/portfolio/panel');
  assert.equal(anon.status, 302);
  assert.match(anon.headers.location, /next=%2Fportfolio%2Fpanel/);
  assert.equal((await app.request('GET', '/portfolio/panel', { cookie: user })).status, 403);
  const panel = await app.request('GET', '/diriku', { cookie: owner });
  assert.equal(panel.status, 200);
  assert.match(panel.text, /<title>Diriku Panel<\/title>/);
});

it('reset goes back to the built-in example', async () => {
  const r = await o('DELETE', '/owner/portfolio');
  assert.equal(r.status, 200);
  assert.equal(r.json.saved, false);
  assert.equal(inline((await app.request('GET', '/portfolio')).text).username, 'yannz2zworld');
});
