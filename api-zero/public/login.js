(() => {
  'use strict';
  const { $, api, busy, toast } = Z;
  const next = new URLSearchParams(location.search).get('next') || '/home';
  const forms = { login: $('#loginForm'), register: $('#registerForm'), forgot: $('#forgotForm') };
  function show(mode) {
    Object.entries(forms).forEach(([k, f]) => f.classList.toggle('hidden', k !== mode));
    document.querySelectorAll('.seg button').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
    $('.seg').classList.toggle('hidden', mode === 'forgot');
  }
  document.querySelectorAll('.seg button').forEach(b => b.onclick = () => show(b.dataset.mode));
  $('#forgotLink').onclick = () => show('forgot');
  $('#backLogin').onclick = () => show('login');

  const go = d => { location.href = d.redirect || next; };
  forms.login.onsubmit = e => { e.preventDefault(); busy(e.submitter, async () => go(await api('/auth/login', { method: 'POST', body: { username: $('#lUser').value, password: $('#lPass').value, next } }))); };
  forms.register.onsubmit = e => {
    e.preventDefault();
    busy(e.submitter, async () => go(await api('/auth/register', { method: 'POST', body: { username: $('#rUser').value.trim().toLowerCase(), password: $('#rPass').value, phone: $('#rPhone').value, email: $('#rEmail').value, next } })));
  };
  forms.forgot.onsubmit = e => {
    e.preventDefault();
    busy($('#sendCode'), async () => {
      const d = await api('/auth/forgot', { method: 'POST', body: { email: $('#fEmail').value } });
      toast(d.message); $('#resetPart').classList.remove('hidden'); $('#fCode').focus();
    });
  };
  $('#doReset').onclick = e => busy(e.currentTarget, async () => {
    const d = await api('/auth/reset', { method: 'POST', body: { email: $('#fEmail').value, code: $('#fCode').value, password: $('#fPass').value } });
    toast(d.message); show('login'); $('#lUser').value = $('#fEmail').value;
  });

  // Google Sign-In (muncul kalau GOOGLE_CLIENT_ID diisi).
  api('/auth/config').then(cfg => {
    if (!cfg.googleClientId) return;
    $('#googleArea').classList.remove('hidden');
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
    s.onload = () => {
      google.accounts.id.initialize({
        client_id: cfg.googleClientId,
        callback: r => busy(null, async () => go(await api('/auth/google', { method: 'POST', body: { credential: r.credential, next } })))
      });
      google.accounts.id.renderButton($('#googleBtn'), { theme: Z.isDark() ? 'filled_black' : 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: 300 });
    };
    document.head.appendChild(s);
  }).catch(() => {});

  Z.maintenanceBubble();
})();
