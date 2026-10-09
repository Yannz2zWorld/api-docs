'use strict';
// Transactional email (verification and password-reset codes) sent as "YannApi".
// Providers, chosen by environment (values are never logged):
//   RESEND_API_KEY                         -> Resend HTTP API
//   SMTP_HOST [+ SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE] -> SMTP (e.g. Gmail with an App Password)
// EMAIL_FROM is the sender address (for Gmail SMTP: the Gmail address itself).
// Nothing is faked: without a provider, isConfigured() is false and callers must say so.
const SENDER_NAME = 'YannApi';

function provider() {
  if (!process.env.EMAIL_FROM) return null;
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.SMTP_HOST) return 'smtp';
  return null;
}

function isConfigured() {
  return provider() !== null;
}

function status() {
  return { configured: isConfigured(), provider: provider() || 'none', senderName: SENDER_NAME };
}

const COPY = {
  verify: {
    subject: 'Kode verifikasi akun YannApi',
    title: 'Verifikasi email kamu',
    body: 'Masukin kode ini buat ngaktifin akun Yannz API kamu.'
  },
  reset: {
    subject: 'Kode reset sandi YannApi',
    title: 'Reset sandi',
    body: 'Masukin kode ini buat bikin sandi baru akun Yannz API kamu.'
  }
};

function render(purpose, name, code, minutes) {
  const c = COPY[purpose];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const text = `${c.title}\n\nHalo ${name || ''},\n${c.body}\n\nKode: ${code}\nBerlaku ${minutes} menit. Kalau kamu nggak minta kode ini, cuekin aja email ini; akun kamu tetap aman.\n\n— YannApi`;
  const html = `<!doctype html><html><body style="margin:0;background:#0b0b0c;font-family:Arial,Helvetica,sans-serif;color:#f4f4f5">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#141416;border:2px solid #d4d4d8;border-radius:12px" cellpadding="0" cellspacing="0"><tr><td style="padding:28px">
<div style="font-weight:700;font-size:15px;letter-spacing:-.02em">YannApi</div>
<h1 style="font-size:26px;margin:18px 0 8px;letter-spacing:-.03em">${esc(c.title)}</h1>
<p style="color:#a1a1aa;margin:0 0 20px;line-height:1.55">Halo ${esc(name)},<br>${esc(c.body)}</p>
<div style="background:#fafafa;color:#0b0b0c;border-radius:10px;padding:16px;text-align:center;font:700 32px/1 'Courier New',monospace;letter-spacing:10px">${esc(code)}</div>
<p style="color:#a1a1aa;font-size:13px;line-height:1.55;margin:20px 0 0">Kode ini berlaku ${minutes} menit dan cuma bisa dipakai sekali. Kalau kamu nggak minta kode ini, cuekin aja email ini; akun kamu tetap aman. Jangan kasih kode ini ke siapa pun ya.</p>
</td></tr></table></td></tr></table></body></html>`;
  return { subject: c.subject, text, html };
}

async function sendViaResend(message) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });
  if (!r.ok) throw Object.assign(new Error('Email provider rejected the message.'), { code: 'EMAIL_SEND_FAILED', status: r.status });
}

let transporter;
async function sendViaSmtp(message) {
  if (!transporter) {
    const nodemailer = require('nodemailer');
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    });
  }
  await transporter.sendMail(message);
}

async function sendCode({ to, name, code, purpose, minutes }) {
  const kind = provider();
  if (!kind) throw Object.assign(new Error('Email belum diatur.'), { code: 'EMAIL_NOT_CONFIGURED' });
  const { subject, text, html } = render(purpose, name, code, minutes);
  const from = `${SENDER_NAME} <${process.env.EMAIL_FROM}>`;
  try {
    if (kind === 'resend') await sendViaResend({ from, to: [to], subject, text, html });
    else await sendViaSmtp({ from, to, subject, text, html });
  } catch (err) {
    // Provider status/code only: never the recipient, the code, or credentials.
    console.error('Email send failed:', { provider: kind, code: err?.code || null, status: err?.status || err?.responseCode || null });
    throw Object.assign(new Error('Email gagal dikirim.'), { code: 'EMAIL_SEND_FAILED' });
  }
}

// Any other email from the site (e.g. backups for the developer), with optional attachments:
// [{ filename, content: Buffer, contentType }].
async function sendMail({ to, subject, text, html, attachments = [] }) {
  const kind = provider();
  if (!kind) throw Object.assign(new Error('Email belum diatur.'), { code: 'EMAIL_NOT_CONFIGURED' });
  const from = `${SENDER_NAME} <${process.env.EMAIL_FROM}>`;
  try {
    if (kind === 'resend') {
      await sendViaResend({ from, to: [to], subject, text, html, attachments: attachments.map(a => ({ filename: a.filename, content: Buffer.from(a.content).toString('base64'), content_type: a.contentType })) });
    } else {
      await sendViaSmtp({ from, to, subject, text, html, attachments: attachments.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })) });
    }
  } catch (err) {
    console.error('Email send failed:', { provider: kind, code: err?.code || null, status: err?.status || err?.responseCode || null });
    throw Object.assign(new Error('Email gagal dikirim.'), { code: 'EMAIL_SEND_FAILED' });
  }
}

module.exports = { sendCode, sendMail, isConfigured, status, SENDER_NAME };
