'use strict';
// Media handler: ffmpeg via spawn (argumen array, TANPA shell; tidak ada input pengguna mentah di argumen),
// folder sementara per proses, timeout, batas ukuran. Stiker: webp 512x512 + metadata exif (node-webpmux).

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { err } = require('./errors');
const { sniffMime, Semaphore } = require('./function');

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
// Batas CPU (aturan VPS bersama): ffmpeg diantrikan (default 1 proses sekaligus) dan dibatasi thread-nya.
const intEnv = (k, d, lo, hi) => { const n = parseInt(process.env[k], 10); return Number.isInteger(n) && n >= lo && n <= hi ? n : d; };
const queue = new Semaphore(intEnv('MEDIA_MAX_CONCURRENT', 1, 1, 8));
const THREADS = String(intEnv('FFMPEG_THREADS', 1, 1, 16));
const MAX_OUT = 64 * 1024 * 1024;

function ffmpeg(input, args, opts = {}) {
  if (!Buffer.isBuffer(input) || !input.length) return Promise.reject(err('EMPTY_MEDIA', 'Media kosong', { userMessage: 'Media kosong atau gagal diunduh.' }));
  return queue.run(() => runFfmpeg(input, args, opts));
}

async function runFfmpeg(input, args, { inExt, outExt, timeoutMs = 90000 } = {}) {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'yan-'));
  const inFile = path.join(dir, `in.${inExt || sniffMime(input)?.ext || 'bin'}`);
  const outFile = path.join(dir, `out.${outExt}`);
  try {
    await fs.promises.writeFile(inFile, input);
    await new Promise((resolve, reject) => {
      const p = spawn(FFMPEG, ['-hide_banner', '-loglevel', 'error', '-y', '-threads', THREADS, '-i', inFile, ...args, '-threads', THREADS, outFile], { stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      p.stderr.on('data', d => { stderr = (stderr + d).slice(-2000); });
      const t = setTimeout(() => { p.kill('SIGKILL'); reject(err('MEDIA_TIMEOUT', 'ffmpeg timeout', { userMessage: 'Proses media terlalu lama.' })); }, timeoutMs);
      p.on('error', e => { clearTimeout(t); reject(err('FFMPEG_MISSING', `ffmpeg tidak bisa dijalankan: ${e.code}`, { userMessage: 'ffmpeg belum terpasang di server.' })); });
      p.on('close', code => { clearTimeout(t); code === 0 ? resolve() : reject(err('MEDIA_FAILED', `ffmpeg exit ${code}: ${stderr.split('\n').slice(-3).join(' ')}`, { userMessage: 'Gagal memproses media (format tidak didukung?).' })); });
    });
    const st = await fs.promises.stat(outFile);
    if (st.size > MAX_OUT) throw err('MEDIA_TOO_LARGE', 'Hasil terlalu besar', { userMessage: 'Hasil media terlalu besar.' });
    return await fs.promises.readFile(outFile);
  } finally {
    fs.promises.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

const AUDIO_FILTERS = {
  bass: ['Bass boost', 'bass=g=12,dynaudnorm=f=200'],
  blown: ['Suara pecah (blown)', 'acrusher=level_in=6:level_out=1:bits=8:mode=log:aa=1'],
  deep: ['Suara berat', 'asetrate=44100*0.75,aresample=44100,atempo=1.333'],
  earrape: ['Sangat keras (hati-hati)', 'volume=8,acrusher=level_in=4:bits=8'],
  fast: ['Dipercepat 1.5x', 'atempo=1.5'],
  slow: ['Diperlambat 0.75x', 'atempo=0.75'],
  nightcore: ['Nightcore', 'asetrate=44100*1.25,aresample=44100'],
  chipmunk: ['Suara tupai', 'asetrate=44100*1.6,aresample=44100,atempo=0.8'],
  robot: ['Suara robot', "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75"],
  reverse: ['Diputar terbalik', 'areverse'],
  echo: ['Gema', 'aecho=0.8:0.88:60:0.4'],
  vibrato: ['Vibrato', 'vibrato=f=6:d=0.6'],
  tremolo: ['Tremolo', 'tremolo=f=6:d=0.7'],
  '8d': ['Audio 8D (berputar kiri-kanan)', 'apulsator=hz=0.125'],
  chorus: ['Chorus', 'chorus=0.6:0.9:50|60:0.4|0.32:0.25|0.4:2|1.3'],
  flanger: ['Flanger', 'flanger=delay=5:depth=5'],
  smooth: ['Halus (lowpass)', 'lowpass=f=3000,volume=1.2'],
  radio: ['Efek radio jadul', 'highpass=f=300,lowpass=f=3400,acrusher=bits=12']
};

const toMp3 = (buf, filter) => ffmpeg(buf, ['-vn', ...(filter ? ['-af', filter] : []), '-ac', '2', '-ar', '44100', '-b:a', '128k', '-f', 'mp3'], { outExt: 'mp3' });
const toOpus = buf => ffmpeg(buf, ['-vn', '-ac', '1', '-c:a', 'libopus', '-b:a', '64k', '-vbr', 'on', '-f', 'ogg'], { outExt: 'ogg' });
const toGif = buf => ffmpeg(buf, ['-t', '8', '-vf', 'fps=12,scale=320:-1:flags=lanczos', '-loop', '0'], { outExt: 'gif' });
const toMp4 = buf => ffmpeg(buf, ['-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-an'], { outExt: 'mp4' });
const toPng = buf => ffmpeg(buf, ['-frames:v', '1'], { outExt: 'png' });
function setVolume(buf, factor) {
  if (!(factor > 0 && factor <= 10)) throw err('INVALID_VOLUME', 'volume', { userMessage: 'Volume 0.1 - 10.' });
  return ffmpeg(buf, ['-vn', '-af', `volume=${Number(factor).toFixed(2)}`, '-f', 'mp3'], { outExt: 'mp3' });
}
function trimAudio(buf, start, duration) {
  if (!(start >= 0 && duration > 0 && duration <= 600)) throw err('INVALID_RANGE', 'trim', { userMessage: 'Mulai ≥ 0 detik, durasi 1-600 detik.' });
  return ffmpeg(buf, ['-vn', '-ss', String(start), '-t', String(duration), '-f', 'mp3'], { outExt: 'mp3' });
}

async function toWebpSticker(buf, { animated = false } = {}) {
  const vf = 'scale=512:512:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x00000000' + (animated ? ',fps=15' : '');
  const args = animated
    ? ['-t', '8', '-vf', vf, '-c:v', 'libwebp_anim', '-lossless', '0', '-q:v', '50', '-loop', '0', '-an', '-fps_mode', 'passthrough']
    : ['-vf', vf, '-frames:v', '1', '-c:v', 'libwebp', '-lossless', '0', '-q:v', '80'];
  let out = await ffmpeg(buf, args, { outExt: 'webp' });
  if (animated && out.length > 1000 * 1024) out = await ffmpeg(buf, args.map(a => (a === '50' ? '25' : a === '-t' ? '-t' : a === '8' ? '5' : a)), { outExt: 'webp' });
  return out;
}

async function addExif(webp, { packname = '', author = '' } = {}) {
  const { Image } = require('node-webpmux');
  const img = new Image();
  await img.load(webp);
  const json = { 'sticker-pack-id': `yannajah-${crypto.randomBytes(6).toString('hex')}`, 'sticker-pack-name': String(packname).slice(0, 60), 'sticker-pack-publisher': String(author).slice(0, 60), emojis: ['✨'] };
  const head = Buffer.from([0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00]);
  const data = Buffer.from(JSON.stringify(json), 'utf8');
  const exif = Buffer.concat([head, data]);
  exif.writeUIntLE(data.length, 14, 4);
  img.exif = exif;
  return img.save(null);
}

async function readExif(webp) {
  const { Image } = require('node-webpmux');
  const img = new Image();
  await img.load(webp);
  if (!img.exif) return null;
  try { return JSON.parse(img.exif.subarray(22).toString('utf8')); } catch { return null; }
}

module.exports = { ffmpeg, AUDIO_FILTERS, toMp3, toOpus, toGif, toMp4, toPng, setVolume, trimAudio, toWebpSticker, addExif, readExif };
