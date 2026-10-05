DEPLOY CLUTCH API - VERCEL ATAU VPS

================================================================================
DEPLOY KE VERCEL (GRATIS)
================================================================================

CARA 1 - VIA GITHUB:

1. Push project ke GitHub

2. Login ke vercel.com pakai akun GitHub

3. Klik Add New > Project

4. Pilih repository, klik Import

5. Biarkan semua pengaturan default:
   - Framework Preset: Other
   - Root Directory: ./
   - Build settings: kosong

6. Klik Deploy

Selesai. Dapat domain gratis seperti: clutch-api.vercel.app
Setiap git push otomatis deploy ulang.

CARA 2 - VIA TERMINAL:

npm install -g vercel
vercel login
vercel
vercel --prod

================================================================================
DEPLOY KE VPS (UBUNTU/DEBIAN)
================================================================================

STEP 1 - PERSIAPAN SERVER:

sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git software-properties-common
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

STEP 2 - CLONE PROJECT:

cd /var/www
git clone <URL_REPO_ANDA> clutch-api
cd clutch-api
npm install

STEP 3 - PM2 (AGAR APLIKASI TETAP JALAN):

sudo npm install pm2 -g
pm2 start index.js --name "clutch-api"
pm2 startup
pm2 save

STEP 4 - NGINX REVERSE PROXY:

sudo apt install nginx -y
sudo nano /etc/nginx/sites-available/clutch-api

Copy-paste ini (ganti domain_anda.com):

server {
    listen 80;
    server_name domain_anda.com www.domain_anda.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}

sudo ln -s /etc/nginx/sites-available/clutch-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

STEP 5 - SSL GRATIS:

sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d domain_anda.com -d www.domain_anda.com

Ikuti instruksi, pilih redirect HTTP ke HTTPS.

================================================================================
CATATAN PENTING
================================================================================

- Jangan hardcode API key di file HTML atau client-side
- Selalu gunakan route /ai/gemini sebagai proxy server-side
- Untuk local testing: node index.js lalu buka http://localhost:3000

================================================================================
YANNZ API PLATFORM - DATABASE, AUTH, ENVIRONMENT
================================================================================

Database driver: @neondatabase/serverless (Neon PostgreSQL HTTP driver).

Required server environment variables (names only; see .env.example):
- DATABASE_URL (Neon pooled connection string; private)
- GOOGLE_CLIENT_ID (Web OAuth client ID; must be the same client the login page uses)
- GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL (only for the /auth/google redirect fallback)
- AUTH_SECRET (long random value, >= 32 characters; encrypts the session cookie)
- OWNER_EMAIL

Set these in Vercel Project Settings > Environment Variables for the Production
environment (and Preview if you test previews), then REDEPLOY: Vercel only applies
environment changes to new deployments. For local development copy .env.example to
.env. Never commit .env or send credentials in chat.

Missing variable NAMES are logged once at cold start:
`Server configuration incomplete; missing environment variables: ...`

## Authentication flow

Google Identity Services (views/login.html) -> `POST /auth/google/credential`
-> server verifies the ID token (signature, audience = GOOGLE_CLIENT_ID, issuer,
expiry) -> upsert `users` row -> AES-256-GCM encrypted `yannz_session` cookie
(HttpOnly, Secure, SameSite=Lax, 7 days) -> `/home`.

The server-side cookie is the only source of truth for login state; the login page
no longer has a client-side email/password form or sessionStorage flag. Protected
pages (`/home`, `/keys`, `/billing`, `/owner`) and `/auth/me` re-read the user
from PostgreSQL on each request, so banned/deleted users lose access immediately.
`POST /auth/logout` clears the cookie. `GET /auth/google` is a redirect-based
fallback when the Google button script cannot load.

## Google Login troubleshooting

Every failure of `POST /auth/google/credential` returns a stable `error` code in
the JSON body (visible in the browser DevTools Network tab) and logs one line
`Google credential/login failed: {stage, ...}` in Vercel runtime logs. Tokens,
emails, and secrets are never logged.

| HTTP | error                     | stage    | Meaning / fix |
|------|---------------------------|----------|---------------|
| 503  | DATABASE_SCHEMA_OUTDATED  | database | Migrations not applied (log `code` 42703 = missing column, 42P01 = missing table). Run migrations/001 and 002. |
| 503  | DATABASE_NOT_CONFIGURED   | database | DATABASE_URL missing in this Vercel environment. Add it and redeploy. |
| 503  | DATABASE_UNAVAILABLE      | database | Neon unreachable / bad credentials / suspended project. Check Neon dashboard and the connection string. |
| 503  | AUTH_NOT_CONFIGURED       | config   | GOOGLE_CLIENT_ID or AUTH_SECRET missing (log lists which). |
| 503  | GOOGLE_UNAVAILABLE        | verify   | Server could not download Google signing certificates. Retry; check outbound network. |
| 401  | INVALID_CREDENTIAL        | verify   | Log `reason`: AUDIENCE_MISMATCH (GOOGLE_CLIENT_ID differs from the client the page used), TOKEN_EXPIRED / TOKEN_NOT_YET_VALID (clock), INVALID_SIGNATURE, ISSUER_MISMATCH, MALFORMED_TOKEN. |
| 403  | EMAIL_NOT_VERIFIED        | profile  | Google account email is not verified. |
| 403  | ACCOUNT_RESTRICTED        | -        | User is banned/pending in `users.status`. |
| 403  | CSRF_BLOCKED              | origin   | Request came from another origin. |

`GET /health/database` checks connectivity AND schema:
- 200 `{"database":"connected","schema":"ok"}`
- 503 `{"database":"connected","schema":"migration_required","missing":[...]}`
- 503 `{"database":"disconnected","error":"DATABASE_NOT_CONFIGURED|DATABASE_UNAVAILABLE"}`

Google Cloud Console checklist (OAuth 2.0 Client ID, type "Web application"):
- Authorized JavaScript origins: https://apiz2z.vercel.app (and http://localhost:3000 for local dev)
- Authorized redirect URIs: https://apiz2z.vercel.app/auth/google/callback
- The Client ID shown there must equal GOOGLE_CLIENT_ID in Vercel Production.

## Install and migration

1. `npm install`
2. Take a Neon backup/branch and inspect the existing `users` table (`users.id` must be uuid).
3. Apply `migrations/001_users.sql` then `migrations/002_platform.sql` (idempotent, additive, no DROP).
4. Configure secrets only in Vercel environment settings.
5. Deploy a preview first, verify `/health/database` and Google login, then promote.

Local commands:
  npm install
  npm run lint
  npm test
  npm start

## Routes

- `GET /health`, `GET /health/database`, `GET /auth/config`, `GET /auth/me`, `POST /auth/logout`
- `POST /auth/google/credential`, `GET /auth/google`, `GET /auth/google/callback`
- `GET /pricing`, authenticated `GET /keys`, `GET /billing`, `GET /usage`, `GET /api/dashboard`
- `GET|POST /api/keys`, `DELETE /api/keys/:id`, `POST /api/keys/:id/revoke`
- `GET|POST /api/orders`, `POST /api/orders/:id/pakasir`, `POST /api/orders/:id/manual`
- Owner routes under `/owner`: dashboard, users, endpoint metadata, payments, server maintenance, audit, and JSON backup.
- `POST /webhooks/pakasir` is fail-closed unless a verified V2 detail URL is configured.

Plugin API authentication is `Authorization: Bearer ...` (or `x-api-key`). Keys are
cryptographically random and SHA-256 hashed; plaintext is returned once. Revoked or
unknown keys are rejected with 401 (no fallback to the cookie session). Without a key,
a logged-in user can call FREE, unlocked endpoints through their session cookie.
Legacy query-string keys are not accepted.

## Known integration gates

- Pakasir V2 create is integrated; automatic settlement stays fail-closed until an officially supported V2 verification endpoint is configured (PAKASIR_V2_VERIFY_URL). See https://pakasir.com/p/create-transaction.
- Manual payment notification is an adapter stub (reports provider-not-configured; no fake delivery).
- Manual proof upload expects an HTTPS URL; no object-storage upload is implemented.
- Owner panel: some admin operations are API-only; the visual console is not complete CRUD.
- Adding a new executable endpoint requires deploying a plugin handler; DB metadata alone does not execute code.
- Production OAuth, Neon, Vercel build, live payment, webhook, and storage tests were not run from this environment.

## Smoke checks after deploy

- `GET https://apiz2z.vercel.app/health` -> `{"status":"ok"}`
- `GET https://apiz2z.vercel.app/health/database` -> 200 `{"database":"connected","schema":"ok"}`
- `GET https://apiz2z.vercel.app/auth/me` while signed out -> 401; after Google login -> user plus usage/key limits.
- Open `/pricing`, `/home`, `/keys`, `/billing`; `/owner` must reject non-owners.
- Create a paid-tier test user in a non-production database, create a key, call a plugin with `Authorization: Bearer <key>`, revoke it, confirm 401.
