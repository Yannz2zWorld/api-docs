-- Tier durations, manual payment proofs, owner payment settings, custom API key values
-- and invalid-key throttling. Safe to re-run; additive only; existing rows keep their
-- meaning (tiers already granted have no expiry, existing orders count as 30 days).

-- A paid tier lasts until tier_expires_at; NULL means no expiry (tiers granted before
-- this migration, or set by the owner).
ALTER TABLE users ADD COLUMN IF NOT EXISTS tier_expires_at timestamptz;

-- Purchased duration in days (7..365). Prices are per 30 days, scaled by duration.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS duration_days integer NOT NULL DEFAULT 30;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_duration_days_check' AND conrelid = 'orders'::regclass) THEN
    IF EXISTS (SELECT 1 FROM orders WHERE duration_days NOT BETWEEN 7 AND 365) THEN
      RAISE WARNING 'orders_duration_days_check skipped: rows outside 7..365 exist';
    ELSE
      ALTER TABLE orders ADD CONSTRAINT orders_duration_days_check CHECK (duration_days BETWEEN 7 AND 365);
    END IF;
  END IF;
END $$;

-- Uploaded payment proof images (JPEG/PNG/WebP, validated by the server). Kept out of
-- the payments row so listing payments never loads image bytes.
CREATE TABLE IF NOT EXISTS payment_proofs (
 payment_id uuid PRIMARY KEY REFERENCES payments(id) ON DELETE CASCADE,
 mime text NOT NULL CHECK (mime IN ('image/jpeg', 'image/png', 'image/webp')),
 size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 2097152),
 sha256 text NOT NULL,
 data bytea NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
-- How the owner was told about a manual payment ('telegram' or NULL when not sent).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS owner_notified text;

-- Destination accounts shown to buyers for manual DANA / GoPay transfers (owner panel).
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS payment_dana_number text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS payment_dana_name text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS payment_gopay_number text;
ALTER TABLE server_settings ADD COLUMN IF NOT EXISTS payment_gopay_name text;

-- Keys whose value was chosen by the user (e.g. "Yannz2z") instead of generated.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS custom boolean NOT NULL DEFAULT false;

-- Invalid API key attempts per client IP per 15-minute bucket (guessing protection).
CREATE TABLE IF NOT EXISTS api_key_failures (
 ip text NOT NULL,
 bucket timestamptz NOT NULL,
 count integer NOT NULL DEFAULT 0,
 PRIMARY KEY (ip, bucket)
);
