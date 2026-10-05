'use strict';
// Adapter for notifying the owner about manual payments. No WhatsApp provider is integrated:
// this never pretends a message was delivered. To add one, implement send() with an approved
// provider SDK/API and set its credentials as server-side environment variables.
const provider = null;

function status() {
  return { provider: provider ? provider.name : 'none', configured: Boolean(provider), ownerWaConfigured: Boolean(process.env.OWNER_WA) };
}

async function notifyManualPayment(payload) {
  if (!provider) return { sent: false, reason: process.env.OWNER_WA ? 'WHATSAPP_PROVIDER_NOT_CONFIGURED' : 'OWNER_WA_NOT_CONFIGURED' };
  return provider.send(process.env.OWNER_WA, payload);
}

module.exports = { notifyManualPayment, status };
