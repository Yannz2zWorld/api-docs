'use strict';
// Manual payments: the proof is stored and shown in the developer panel (Payments tab). Nothing is
// sent automatically; the buyer gets chat links (WhatsApp with the order details prefilled, and
// Telegram) to confirm with the developer directly.
const settings = require('../settings');

function ownerWaNumber() {
  const configured = String(process.env.OWNER_WA || '').replace(/\D/g, '');
  if (configured) return configured;
  return (/wa\.me\/(\d+)/.exec(settings.whatsappLink || '') || [])[1] || '';
}

function status() {
  return {
    whatsapp: { automated: false, link: Boolean(ownerWaNumber()) },
    telegram: { automated: false, link: Boolean(settings.telegramLink) }
  };
}

const rupiah = n => 'Rp' + Number(n).toLocaleString('id-ID');

function messageText(p) {
  return [
    'Pembayaran manual — Yannz API',
    `Order: ${p.orderCode}`,
    `Paket: ${p.tier} · ${p.days} hari`,
    `Nominal: ${rupiah(p.amount)}`,
    `Metode: ${p.method}`,
    `Akun: ${p.email}`
  ].join('\n');
}

// Prefilled chat links the buyer can tap; the image cannot be attached automatically.
function contactLinks(p) {
  const text = messageText(p) + '\n\nBukti transfer saya lampirkan di chat ini.';
  const wa = ownerWaNumber();
  return {
    whatsapp: wa ? `https://wa.me/${wa}?text=${encodeURIComponent(text)}` : null,
    telegram: settings.telegramLink || null
  };
}

module.exports = { contactLinks, status };
