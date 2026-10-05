-- Yannz API data-integrity hardening. Safe to re-run; additive only; never rewrites data.
-- Production tables may predate 002 in an older shape, so every constraint is added only when
-- the existing rows already satisfy it. Anything skipped is reported as a WARNING (not an error)
-- and still shows up in GET /health/database or the owner status page where relevant.

-- 1. Pakasir gateway details, kept so the billing page can show them again after a reload.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS payment_url text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS qr_string text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS va_number text;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS gateway_expires_at timestamptz;

-- Server-side session revocation: logout/ban increments this; cookies carrying an older value stop working.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- 2. Unique indexes that ON CONFLICT clauses rely on (created only when none exists yet).
DO $$
DECLARE spec record; present boolean;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('users', 'google_id', 'users_google_id_uidx'),
    ('api_keys', 'key_hash', 'api_keys_key_hash_uidx'),
    ('endpoints', 'path', 'endpoints_path_uidx'),
    ('daily_quota_counters', 'user_id,usage_date', 'daily_quota_counters_user_date_uidx'),
    ('api_usage', 'user_id,endpoint_id,usage_date', 'api_usage_user_endpoint_date_uidx'),
    ('orders', 'order_code', 'orders_order_code_uidx'),
    ('server_settings', 'id', 'server_settings_id_uidx')
  ) AS v(tbl, cols, idx) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_index i
       WHERE i.indrelid = to_regclass(spec.tbl) AND i.indisunique AND i.indpred IS NULL
         AND (SELECT string_agg(a.attname::text, ',' ORDER BY a.attname)
                FROM unnest(i.indkey) AS k(attnum) JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum)
           = (SELECT string_agg(x, ',' ORDER BY x) FROM unnest(string_to_array(spec.cols, ',')) AS x)
    ) INTO present;
    IF NOT present THEN
      BEGIN
        EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I (%s)', spec.idx, spec.tbl,
          (SELECT string_agg(quote_ident(x), ',') FROM unnest(string_to_array(spec.cols, ',')) AS x));
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Yannz 005: unique index %(%) not created: %', spec.tbl, spec.cols, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 3. At most one manual payment proof waiting for review per order (makes the check atomic).
DO $$
BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS payments_one_pending_manual_uidx ON payments(order_id) WHERE provider = 'manual' AND status = 'pending';
EXCEPTION WHEN others THEN
  RAISE WARNING 'Yannz 005: payments_one_pending_manual_uidx not created (duplicate pending manual payments exist?): %', SQLERRM;
END $$;

-- 4. Value constraints, added only when every existing row already complies.
DO $$
DECLARE c record; violations bigint;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('users', 'users_tier_chk', $q$tier IN ('FREE','SULTAN','SEPUH','DEWA','OWNER')$q$),
    ('users', 'users_status_chk', $q$status IN ('active','banned','pending')$q$),
    ('api_keys', 'api_keys_status_chk', $q$status IN ('active','revoked')$q$),
    ('endpoints', 'endpoints_status_chk', $q$status IN ('active','disabled')$q$),
    ('endpoints', 'endpoints_minimum_tier_chk', $q$minimum_tier IN ('FREE','SULTAN','SEPUH','DEWA','OWNER')$q$),
    ('orders', 'orders_tier_chk', $q$tier IN ('SULTAN','SEPUH','DEWA')$q$),
    ('orders', 'orders_status_chk', $q$status IN ('pending','paid','rejected','cancelled','expired')$q$),
    ('orders', 'orders_amount_chk', $q$amount > 0$q$),
    ('payments', 'payments_status_chk', $q$status IN ('pending','paid','rejected','expired')$q$),
    ('payments', 'payments_amount_chk', $q$amount >= 0$q$),
    ('daily_quota_counters', 'daily_quota_counters_nonneg_chk', $q$request_count >= 0$q$),
    ('api_usage', 'api_usage_nonneg_chk', $q$request_count >= 0$q$)
  ) AS v(tbl, name, expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name AND conrelid = to_regclass(c.tbl)) THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM %I WHERE NOT (%s)', c.tbl, c.expr) INTO violations;
        IF violations = 0 THEN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)', c.tbl, c.name, c.expr);
        ELSE
          RAISE WARNING 'Yannz 005: % row(s) in % violate %; constraint skipped (data left unchanged)', violations, c.tbl, c.name;
        END IF;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Yannz 005: constraint % not added: %', c.name, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 5. Foreign keys for columns that have none (legacy tables), only when no orphan rows exist.
DO $$
DECLARE f record; has_fk boolean; orphans bigint;
BEGIN
  FOR f IN SELECT * FROM (VALUES
    ('api_keys', 'user_id', 'users', 'CASCADE'),
    ('api_usage', 'user_id', 'users', 'CASCADE'),
    ('api_usage', 'api_key_id', 'api_keys', 'SET NULL'),
    ('api_usage', 'endpoint_id', 'endpoints', 'SET NULL'),
    ('daily_quota_counters', 'user_id', 'users', 'CASCADE'),
    ('orders', 'user_id', 'users', 'CASCADE'),
    ('payments', 'order_id', 'orders', 'CASCADE'),
    ('payments', 'user_id', 'users', 'CASCADE'),
    ('audit_logs', 'actor_user_id', 'users', 'SET NULL'),
    ('server_settings', 'updated_by', 'users', 'SET NULL')
  ) AS v(tbl, col, ref, on_delete) LOOP
    SELECT EXISTS (
      SELECT 1 FROM pg_constraint con
        JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
       WHERE con.contype = 'f' AND con.conrelid = to_regclass(f.tbl) AND a.attname = f.col
    ) INTO has_fk;
    IF NOT has_fk THEN
      BEGIN
        EXECUTE format('SELECT count(*) FROM %I t WHERE t.%I IS NOT NULL AND NOT EXISTS (SELECT 1 FROM %I r WHERE r.id = t.%I)', f.tbl, f.col, f.ref, f.col) INTO orphans;
        IF orphans = 0 THEN
          EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %I(id) ON DELETE %s', f.tbl, f.tbl || '_' || f.col || '_fkey', f.col, f.ref, f.on_delete);
        ELSE
          RAISE WARNING 'Yannz 005: % orphan row(s) in %.%; foreign key skipped (data left unchanged)', orphans, f.tbl, f.col;
        END IF;
      EXCEPTION WHEN others THEN
        RAISE WARNING 'Yannz 005: foreign key %.% not added: %', f.tbl, f.col, SQLERRM;
      END;
    END IF;
  END LOOP;
END $$;

-- 6. Lookup indexes for the dashboard, billing, owner panel, and audit views.
CREATE INDEX IF NOT EXISTS orders_user_created_idx ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_order_created_idx ON payments(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS daily_quota_counters_date_idx ON daily_quota_counters(usage_date);
CREATE INDEX IF NOT EXISTS api_usage_date_idx ON api_usage(usage_date);
