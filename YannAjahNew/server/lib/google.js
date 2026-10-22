'use strict';
// Adapter Google OAuth/OIDC (google-auth-library, sama seperti platform APIZ2Z).
// exchange(): tukar code -> id_token dari token endpoint Google, lalu verifyIdToken (signature,
// audience, issuer, expiry) dan cocokkan nonce. Payload yang dikembalikan sudah terverifikasi.

const { OAuth2Client } = require('google-auth-library');

function createGoogle({ clientId, clientSecret, callbackUrl }) {
  const client = () => new OAuth2Client(clientId, clientSecret, callbackUrl);
  return {
    enabled: Boolean(clientId && clientSecret),
    authUrl({ state, nonce }) {
      return client().generateAuthUrl({ access_type: 'online', scope: ['openid', 'email', 'profile'], state, nonce, prompt: 'select_account' });
    },
    async exchange(code, nonce) {
      const c = client();
      const { tokens } = await c.getToken(String(code));
      if (!tokens?.id_token) { const e = new Error('Google tidak mengirim id_token'); e.code = 'NO_ID_TOKEN'; throw e; }
      const ticket = await c.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      const p = ticket.getPayload();
      if (!p || typeof p.nonce !== 'string' || p.nonce !== nonce) { const e = new Error('Nonce tidak cocok'); e.code = 'NONCE_MISMATCH'; throw e; }
      return p;
    }
  };
}

module.exports = { createGoogle };
