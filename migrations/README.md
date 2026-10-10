# Database migrations
Apply in order to the configured Neon database (Neon SQL editor or `psql "$DATABASE_URL" -f ...`):

1. `001_users.sql` — creates the base `users` table when it does not exist (no-op otherwise).
2. `002_platform.sql` — adds the remaining `users` columns (`banned_at`, `ban_reason`, `daily_usage`, `last_usage_reset`, ...) and the platform tables.
3. `003_backfill_columns.sql` — adds newer columns to platform tables that already existed in an older shape (002 skips existing tables). Existing `orders` rows get `order_code = 'LEGACY-<id>'`.
4. `004_payments_amount.sql` — adds `payments.amount` to a pre-existing `payments` table, filled from the linked order.
5. `005_integrity.sql` — `users.session_version` (server-side logout), Pakasir gateway columns, the unique indexes `ON CONFLICT` needs, one pending manual proof per order, and CHECK/foreign-key constraints. Constraints are added only when existing rows already comply; otherwise a WARNING is printed and the data is left unchanged. **Run before deploying the Part 2 code.**
6. `006_password_auth.sql` — email + password login: makes `users.google_id` nullable, adds `password_hash`, `email_verified`, lockout columns and the `auth_codes` table (hashed one-time codes). Run before deploying the email/password login code.
7. `007_billing_custom_keys.sql` — `users.tier_expires_at` (tier durations), `orders.duration_days` (7..365, existing orders = 30), `payment_proofs` (uploaded proof images), `payments.owner_notified`, DANA/GoPay account columns on `server_settings`, `api_keys.custom`, and `api_key_failures` (invalid-key throttling). Existing tiers keep no expiry. Login, sessions and existing keys keep working if the code is deployed first, but run it before using the new billing/custom-key features.
8. `008_legacy_constraints.sql` — for `orders`/`payments` tables that predate 002: evaluates each single-column CHECK constraint on `status`, `tier`, `provider`, `payment_method` against the values the application writes and drops only those that reject one (they cause SQLSTATE 23514, e.g. when expiring an order), then ensures `orders_status_chk` / `payments_status_chk` exist (NOT VALID if old rows have other values). No rows are changed.

9. `009_key_tiers_profile_chat.sql` — owner-issued API keys with their own tier and lifetime (`api_keys.tier`, `expires_at`, `issued_by`, per-key daily counters `key_quota_counters`), `users.display_name` / `last_seen_at` (profile name, live chat), the `chat_messages` table (live chat room) and `activity_log` (API calls and page visits for the owner panel). Existing keys are unchanged (no tier = follows the account, no expiry). The code runs before this migration too: the new features answer `MIGRATION_REQUIRED` (503) until it is applied, everything else keeps working.

10. `010_user_avatars.sql` — `user_avatars` (profile pictures: JPEG/PNG/WebP up to 512 KB, one per user, deleted with the user). Before it runs, profiles and the live chat keep working; uploading a picture answers `MIGRATION_REQUIRED`.

11. `011_public_ids_key_access.sql` — `users.public_id` (numeric user ID: a random unique number in 10100000–12345678 for every account, existing ones are filled in; the owner is shown as 10000000), `api_keys.visibility` (`public` / `private` / `owner` for keys the owner makes; existing keys stay NULL = unchanged), the `disabled` key status, and `api_key_access` (who may use a private key). Before it runs, profiles show the internal ID and the new key features answer `MIGRATION_REQUIRED`.

22. `022_announcements.sql` — `server_settings.maintenance_since` (when maintenance was turned on, shown on the maintenance announcement) and the Dev announcement from the Developer panel (`announce_message`, `announce_message2`, `announce_button_label`, `announce_button_url`, `announce_at`). Before it runs, maintenance keeps working without the start time and saving an announcement answers `MIGRATION_REQUIRED`.

23. `023_pakasir_v2.sql` — `payments.gateway_total` (amount plus gateway fee shown again when the buyer reopens the same QRIS). Optional: without it the page shows the order amount.
24. `024_endpoint_aliases.sql` — `endpoint_aliases` (Developer panel → Endpoints → "Tampilkan": a backup shown as a version, e.g. `/api/anime/anichin/detail-v2`). Optional: without it the button answers `MIGRATION_REQUIRED`.
25. `025_endpoint_edits.sql` — `endpoints.custom_name/custom_description/custom_path/custom_category` (Developer panel → Endpoints → "Edit"). Optional: without it the edit form answers `MIGRATION_REQUIRED`.

All files are additive/idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and never drop data. The application does not run DDL at request time.

If an existing `users` table predates these files, inspect it first: `users.id` must be `uuid` because `002_platform.sql` references it from foreign keys. Every row's `google_id` and `lower(email)` must be unique, or the unique indexes in 002 will fail to build.

After migrating, `GET /health/database` must return `{"database":"connected","schema":"ok"}`. A `"schema":"migration_required"` response lists the missing `table.column` names. Google login answers `503 DATABASE_SCHEMA_OUTDATED` until the schema is complete.

For deploy: take a Neon backup/branch, inspect schema, run migrations, then deploy the app. Rollback should be a forward corrective migration; do not drop production tables.
