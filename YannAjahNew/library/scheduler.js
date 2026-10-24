'use strict';
// Satu timer untuk semua tugas berkala fitur (absen harian, buka/tutup grup terjadwal, jadwal pesan,
// ucapan ulang tahun, ...). Tiap tugas terisolasi: error satu tugas tidak menghentikan yang lain.
// Tugas hanya jalan saat lisensi aktif dan WhatsApp terhubung.

const tasks = new Map();
let timer = null;

function localNow(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date()).map(x => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, hhmm: `${p.hour}:${p.minute}`, day: Number(p.day), month: Number(p.month), year: Number(p.year), hour: Number(p.hour), minute: Number(p.minute) };
}

function register(name, fn) {
  tasks.set(name, fn);
}

function start(yannajah, config, { intervalMs = 30000 } = {}) {
  if (timer) return;
  let running = false;
  timer = setInterval(async () => {
    if (running || !yannajah.auth?.isActive?.() || !yannajah.socket) return;
    running = true;
    const now = localNow(config.bot.timezone);
    for (const [name, fn] of tasks) {
      try { await fn(yannajah, now, config); } catch (e) { yannajah.logger?.warn?.(`tugas ${name} gagal`, e.message); }
    }
    running = false;
  }, intervalMs);
  timer.unref?.();
}

// Untuk test: jalankan semua tugas sekali dengan waktu tertentu.
async function runOnce(yannajah, now, config) {
  for (const fn of tasks.values()) await fn(yannajah, now, config);
}

module.exports = { register, start, runOnce, localNow };
