'use strict';
// Kirim email lewat SMTP (mis. Gmail + App Password).
const nodemailer = require('nodemailer');
let transport = null;

const configured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transport;
}
async function sendResetCode(to, username, code) {
  if (!configured()) throw Object.assign(new Error('SMTP belum diatur.'), { code: 'SMTP_NOT_CONFIGURED' });
  const site = process.env.SITE_NAME || 'API Zero';
  await getTransport().sendMail({
    from: `"${site}" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`,
    to,
    subject: `${code} — kode reset sandi ${site}`,
    text: `Halo ${username},\n\nKode reset sandi kamu: ${code}\nKode berlaku 10 menit. Abaikan email ini kalau kamu tidak meminta reset sandi.\n\n${site}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:3px solid #1d1a2f;border-radius:16px;background:#fff6e0">
      <h2 style="margin:0 0 8px">Halo ${username.replace(/[<>&]/g, '')} 👋</h2>
      <p>Kode reset sandi ${site} kamu:</p>
      <div style="font-size:32px;font-weight:bold;letter-spacing:8px;background:#ffd84d;border:3px solid #1d1a2f;border-radius:12px;padding:12px;text-align:center">${code}</div>
      <p style="color:#5b5670">Berlaku 10 menit. Abaikan email ini kalau kamu tidak meminta reset sandi.</p></div>`
  });
}
module.exports = { sendResetCode, configured };
