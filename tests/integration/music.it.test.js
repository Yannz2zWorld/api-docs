'use strict';
// Website background music (services/siteMusicService.js + views/music.js). By default the full song
// bundled with the site is played; with SITE_MUSIC_URL set to a TikTok link it is looked up through the
// AIO downloader (api.theresav.eu) and tikwm, which are never contacted here: fetch is stubbed.
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');
const music = require('../../services/siteMusicService');

const KEY = 'theresav-test-key';
const AUDIO = 'https://sf16-music.tiktokcdn.com/obj/song-abc.mp3';
const realFetch = global.fetch;
let calls = [];
let aio = () => ({ status: 200, json: { status: true, result: { title: 'video caption', medias: [{ type: 'video', quality: 'hd', url: 'https://cdn.example/v.mp4' }, { type: 'audio', url: AUDIO }], music: { title: 'Lagu Galau', author: 'Penyanyi' } } } });
let tikwm = () => ({ status: 200, json: { code: 0, data: { music: 'https://www.tikwm.com/fallback.mp3', music_info: { title: 'Dari tikwm', author: 'tikwm author' } } } });

let app;
before(async () => {
  if (h.skip) return;
  global.fetch = async (input, init = {}) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url);
    const u = new URL(url);
    if (u.hostname === 'api.theresav.eu') {
      calls.push({ host: 'aio', path: u.pathname, url: u.searchParams.get('url'), key: new Headers(init.headers || {}).get('x-apikey') });
      const r = aio(); return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    if (u.hostname === 'www.tikwm.com') {
      calls.push({ host: 'tikwm', url: u.searchParams.get('url') });
      const r = tikwm(); return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'content-type': 'application/json' } });
    }
    return realFetch(input, init);
  };
  await h.setupDatabase();
  app = await h.startApp({ THERESAV_API_KEY: KEY });
});
after(async () => { global.fetch = realFetch; if (h.skip) return; await app?.close(); await h.teardownDatabase(); });
beforeEach(() => { calls = []; music.reset(); delete process.env.SITE_MUSIC_URL; delete process.env.SITE_MUSIC_TITLE; delete process.env.SITE_MUSIC_ARTIST; });
const useTiktok = () => { process.env.SITE_MUSIC_URL = music.DEFAULT_URL; };
const it = (name, fn) => test(name, { skip: h.skip }, fn);

test('findAudio understands the usual downloader shapes', () => {
  assert.equal(music.findAudio({ data: { music: 'https://a/x.mp3', play: 'https://a/v.mp4' } }), 'https://a/x.mp3');
  assert.equal(music.findAudio({ result: { medias: [{ type: 'video', url: 'https://a/v.mp4' }, { type: 'audio', url: 'https://a/s.m4a' }] } }), 'https://a/s.m4a');
  assert.equal(music.findAudio({ result: { music: { url: 'https://a/m.mp3', title: 't' } } }), 'https://a/m.mp3');
  assert.equal(music.findAudio({ result: { links: [{ quality: 'mp3 128kbps', link: 'https://a/q.mp3' }] } }), 'https://a/q.mp3');
  assert.equal(music.findAudio({ result: { video: 'https://a/v.mp4' } }), null);
  assert.deepEqual(music.findMeta({ data: { music_info: { title: 'Judul', author: 'Artis' } } }), { title: 'Judul', author: 'Artis' });
});

it('by default the full bundled song is played: no upstream call, served with range support', async () => {
  process.env.SITE_MUSIC_TITLE = 'Judul Lagu';
  process.env.SITE_MUSIC_ARTIST = 'Penyanyi';
  const fs = require('fs');
  const size = fs.statSync(music.LOCAL_FILE).size;
  assert.ok(size > 2_500_000, 'the whole song is bundled (about 3 MB for 3:03), not a clip');
  const info = await app.request('GET', '/api/site-music');
  assert.equal(info.status, 200, info.text);
  assert.deepEqual([info.json.enabled, info.json.title, info.json.author, info.json.src], [true, 'Judul Lagu', 'Penyanyi', `/assets/site-music.mp3?v=${size}`]);
  assert.equal(calls.length, 0, 'nothing is fetched from TikTok or the downloader');

  const full = await app.request('GET', '/assets/site-music.mp3');
  assert.equal(full.status, 200);
  assert.equal(full.headers['content-type'], 'audio/mpeg');
  assert.equal(Number(full.headers['content-length']), size);
  const part = await app.request('GET', '/assets/site-music.mp3', { headers: { range: 'bytes=1000-1999' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers['content-range'], `bytes 1000-1999/${size}`);

  const audio = await app.request('GET', '/api/site-music/audio');
  assert.equal(audio.status, 302);
  assert.equal(audio.headers.location, `/assets/site-music.mp3?v=${size}`);
});

it('with SITE_MUSIC_URL set to a TikTok link, song info comes from the AIO downloader (key in the header, never in the answer) and the audio link redirects', async () => {
  useTiktok();
  const info = await app.request('GET', '/api/site-music');
  assert.equal(info.status, 200, info.text);
  assert.deepEqual([info.json.enabled, info.json.title, info.json.author, info.json.src], [true, 'Lagu Galau', 'Penyanyi', '/api/site-music/audio']);
  assert.deepEqual(calls[0], { host: 'aio', path: '/api/download/aio', url: music.DEFAULT_URL, key: KEY });
  assert.ok(!info.text.includes(KEY) && !info.text.includes(AUDIO));

  const audio = await app.request('GET', '/api/site-music/audio');
  assert.equal(audio.status, 302);
  assert.equal(audio.headers.location, AUDIO);
  assert.equal(calls.length, 1, 'the lookup is cached');
});

it('falls back to tikwm when the AIO answer has no audio; 502 when nothing works', async () => {
  useTiktok();
  aio = () => ({ status: 200, json: { status: true, result: { video: 'https://cdn.example/v.mp4' } } });
  const info = await app.request('GET', '/api/site-music');
  assert.equal(info.json.title, 'Dari tikwm');
  assert.equal((await app.request('GET', '/api/site-music/audio')).headers.location, 'https://www.tikwm.com/fallback.mp3');
  assert.deepEqual(calls.map(c => c.host), ['aio', 'tikwm']);

  music.reset(); calls = []; useTiktok();
  aio = () => ({ status: 500, json: { status: false } });
  tikwm = () => ({ status: 200, json: { code: -1, msg: 'error' } });
  const down = await app.request('GET', '/api/site-music');
  assert.equal(down.status, 502);
  assert.equal(down.json.error, 'MUSIC_UNAVAILABLE');
  assert.equal((await app.request('GET', '/api/site-music/audio')).status, 502);
});

it('SITE_MUSIC_URL picks the video, "off" hides the player; the widget script is on the pages', async () => {
  aio = () => ({ status: 200, json: { status: true, result: { music: AUDIO } } });
  process.env.SITE_MUSIC_URL = 'https://vt.tiktok.com/LAINLAGI/';
  await app.request('GET', '/api/site-music');
  assert.equal(calls[0].url, 'https://vt.tiktok.com/LAINLAGI/');

  process.env.SITE_MUSIC_URL = 'off';
  music.reset();
  const off = await app.request('GET', '/api/site-music');
  assert.deepEqual([off.status, off.json.enabled], [200, false]);

  const js = await app.request('GET', '/assets/music.js');
  assert.equal(js.status, 200);
  assert.match(js.headers['content-type'], /javascript/);
  assert.match(js.text, /audio\.loop = true/);
  assert.match(js.text, /if \(!state\.paused\) start\(false\)/, 'tries to play automatically');
  const page = await app.request('GET', '/pricing');
  assert.match(page.text, /<script src="\/assets\/music\.js" defer><\/script>/);
});
