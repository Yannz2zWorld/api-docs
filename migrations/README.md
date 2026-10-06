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

All files are additive/idempotent (`CREATE ... IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`) and never drop data. The application does not run DDL at request time.

If an existing `users` table predates these files, inspect it first: `users.id` must be `uuid` because `002_platform.sql` references it from foreign keys. Every row's `google_id` and `lower(email)` must be unique, or the unique indexes in 002 will fail to build.

After migrating, `GET /health/database` must return `{"database":"connected","schema":"ok"}`. A `"schema":"migration_required"` response lists the missing `table.column` names. Google login answers `503 DATABASE_SCHEMA_OUTDATED` until the schema is complete.

For deploy: take a Neon backup/branch, inspect schema, run migrations, then deploy the app. Rollback should be a forward corrective migration; do not drop production tables.
