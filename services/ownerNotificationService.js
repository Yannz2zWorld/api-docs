'use strict';
// Tells the owner about a manual payment. Telegram is sent automatically when a bot is
// configured (TELEGRAM_BOT_TOKEN + TELEGRAM_OWNER_CHAT_ID); WhatsApp has no automated
// provider here, so buyers get a wa.me link with the message prefilled instead.
// Never claims delivery that did not happen, and never logs the bot token.
const settings = require('../settings');

const TELEGRAM_TIMEOUT_MS = 8000;

function telegramConfigured() {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_OWNER_CHAT_ID);
}

function ownerWaNumber() {
  const configured = String(process.env.OWNER_WA || '').replace(/\D/g, '');
  if (configured) return configured;
  return (/wa\.me\/(\d+)/.exec(settings.whatsappLink || '') || [])[1] || '';
}

function status() {
  return {
    telegram: telegramConfigured(),
    whatsapp: { automated: false, link: Boolean(ownerWaNumber()) },
    // Kept for the owner status panel.
    provider: telegramConfigured() ? 'telegram' : 'none',
    configured: telegramConfigured()
  };
}

const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');

function messageText(p) {
  return [
    'Pembayaran manual baru — Yannz API',
    `Order: ${p.orderCode}`,
    `Paket: ${p.tier} · ${p.days} hari`,
    `Nominal: ${rupiah(p.amount)}`,
    `Metode: ${p.method}`,
    `Akun: ${p.email}`,
    p.panelUrl ? `Cek & approve: ${p.panelUrl}` : null
  ].filter(Boolean).join('\n');
}

// Prefilled chat links the buyer can tap; WhatsApp cannot attach the image automatically.
function contactLinks(p) {
  const text = messageText({ ...p, panelUrl: null }) + '\n\nBukti transfer saya lampirkan di chat ini.';
  const wa = ownerWaNumber();
  return {
    whatsapp: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null,
    telegram: settings.telegramLink || null
  };
}

async function sendTelegram(p) {
  const base = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
  const caption = messageText(p).slice(0, 1000);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TELEGRAM_TIMEOUT_MS);
  try {
    let r;
    if (p.proof) {
      const form = new FormData();
      form.append('chat_id', process.env.TELEGRAM_OWNER_CHAT_ID);
      form.append('caption', caption);
      form.append('photo', new Blob([p.proof.buffer], { type: p.proof.mime }), 'bukti.' + p.proof.mime.split('/')[1]);
      r = await fetch(`${base}/sendPhoto`, { method: 'POST', body: form, signal: controller.signal });
    } else {
      r = await fetch(`${base}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: process.env.TELEGRAM_OWNER_CHAT_ID, text: caption, disable_web_page_preview: true }),
        signal: controller.signal
      });
    }
    const body = await r.json().catch(() => ({}));
    if (!r.ok || body.ok !== true) return { sent: false, channel: 'telegram', reason: 'TELEGRAM_REJECTED', status: r.status };
    return { sent: true, channel: 'telegram' };
  } catch (e) {
    return { sent: false, channel: 'telegram', reason: e.name === 'AbortError' ? 'TELEGRAM_TIMEOUT' : 'TELEGRAM_UNREACHABLE' };
  } finally {
    clearTimeout(timer);
  }
}

async function notifyManualPayment(p) {
  const links = contactLinks(p);
  if (!telegramConfigured()) return { sent: false, reason: 'TELEGRAM_NOT_CONFIGURED', links };
  const result = await sendTelegram(p);
  if (!result.sent) console.error('Owner notification failed:', { channel: 'telegram', reason: result.reason, status: result.status || null });
  return { ...result, links };
}

module.exports = { notifyManualPayment, contactLinks, status, telegramConfigured };
