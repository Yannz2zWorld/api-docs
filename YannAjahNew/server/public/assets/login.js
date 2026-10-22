'use strict';
(function () {
  const MESSAGES = {
    denied: 'Login dibatalkan.',
    restricted: 'Akun kamu sedang tidak aktif atau email Google belum terverifikasi.',
    closed: 'Pendaftaran ditutup. Minta admin membuatkan akun untuk email kamu.',
    error: 'Login gagal. Coba lagi beberapa saat lagi.'
  };
  const code = new URLSearchParams(location.search).get('auth');
  if (code && MESSAGES[code]) {
    const n = document.getElementById('notice');
    n.textContent = MESSAGES[code];
    n.classList.remove('hidden');
  }
  fetch('/auth/config').then(r => r.json()).then(c => {
    if (!c.google) {
      document.getElementById('google').classList.add('hidden');
      document.getElementById('nogoogle').classList.remove('hidden');
    }
  }).catch(() => {});
  // Sudah login? langsung ke dashboard.
  fetch('/api/dash/me', { credentials: 'same-origin' }).then(r => { if (r.ok) location.replace('/dashboard'); }).catch(() => {});
})();
