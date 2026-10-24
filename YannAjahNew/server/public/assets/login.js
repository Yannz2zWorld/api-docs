'use strict';
(function () {
  const MESSAGES = {
    denied: 'Login dibatalkan.',
    restricted: 'Akun kamu sedang tidak aktif. Hubungi atasanmu.',
    member: 'Akun MEMBER tidak punya akses website. Website khusus reseller ke atas.',
    closed: 'Email Google ini belum terdaftar. Minta developer/atasan membuatkan akun.',
    error: 'Login gagal. Coba lagi beberapa saat lagi.'
  };
  const notice = document.getElementById('notice');
  const show = text => { notice.textContent = text; notice.classList.remove('hidden'); };
  const code = new URLSearchParams(location.search).get('auth');
  if (code && MESSAGES[code]) show(MESSAGES[code]);

  const form = document.getElementById('login');
  const btn = document.getElementById('submit');
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    const email = form.email.value.trim();
    const password = form.password.value;
    if (!email || !password) return show('Isi email dan password.');
    btn.disabled = true; btn.textContent = 'Memeriksa...';
    try {
      const r = await fetch('/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.success) return location.replace(data.redirect || '/dashboard');
      show(data.message || 'Login gagal. Coba lagi.');
      form.password.value = '';
      form.password.focus();
    } catch { show('Server tidak bisa dihubungi. Coba lagi.'); }
    btn.disabled = false; btn.textContent = 'Masuk';
  });

  fetch('/auth/config').then(r => r.json()).then(c => { if (c.google) document.getElementById('google-box').classList.remove('hidden'); }).catch(() => {});
  // Sudah login? langsung ke dashboard.
  fetch('/api/dash/me', { credentials: 'same-origin' }).then(r => { if (r.ok) location.replace('/dashboard'); }).catch(() => {});
})();
