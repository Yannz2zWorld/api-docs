-- Databases whose orders/payments tables existed before 002 may still carry the old
-- application's CHECK constraints, e.g. status IN ('pending','paid','failed'). Those reject
-- values this application writes ('expired', 'QRIS', 'pakasir', ...) and make order expiry,
-- checkout or approval fail with SQLSTATE 23514.
--
-- For every single-column CHECK constraint on the columns below, this evaluates the
-- constraint against each value the application needs and drops it only if it rejects one.
-- The application's own constraints (005) are then (re)added, NOT VALID when old rows would
-- violate them (new writes are still checked). Safe to re-run; no rows are changed.
DO $$
DECLARE
  needed jsonb := jsonb_build_object(
    'orders.status',          jsonb_build_array('pending','paid','rejected','cancelled','expired'),
    'orders.tier',            jsonb_build_array('SULTAN','SEPUH','DEWA'),
    'payments.status',        jsonb_build_array('pending','paid','rejected','expired'),
    'payments.provider',      jsonb_build_array('manual','pakasir'),
    'payments.payment_method',jsonb_build_array('QRIS','DANA','GOPAY','BANK_TRANSFER','payment_link','qris','bri_va','bni_va','cimb_niaga_va','permata_va','maybank_va','bnc_va','artha_graha_va','sampoerna_va')
  );
  c record;
  expr text;
  val text;
  ok boolean;
BEGIN
  FOR c IN
    SELECT con.oid, con.conname, rel.relname AS tbl, att.attname AS col, pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace AND ns.nspname = current_schema()
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = con.conkey[1]
     WHERE con.contype = 'c' AND array_length(con.conkey, 1) = 1
       AND rel.relname IN ('orders', 'payments')
       AND needed ? (rel.relname || '.' || att.attname)
  LOOP
    expr := regexp_replace(c.def, '^CHECK \((.*)\)( NOT VALID)?$', '\1');
    FOR val IN SELECT jsonb_array_elements_text(needed -> (c.tbl || '.' || c.col)) LOOP
      BEGIN
        EXECUTE format('SELECT (%s) FROM (SELECT %L::text AS %I) AS t', expr, val, c.col) INTO ok;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Yannz 008: could not evaluate %.% (%): %', c.tbl, c.conname, c.def, SQLERRM;
        ok := true; -- leave constraints we cannot evaluate alone
        EXIT;
      END;
      IF ok = false THEN
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', c.tbl, c.conname);
        RAISE NOTICE 'Yannz 008: dropped legacy constraint %.% (%) - it rejected %', c.tbl, c.conname, c.def, val;
        EXIT;
      END IF;
    END LOOP;
  END LOOP;

  -- The application's own status constraints.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_status_chk' AND conrelid = 'orders'::regclass) THEN
    IF EXISTS (SELECT 1 FROM orders WHERE status NOT IN ('pending','paid','rejected','cancelled','expired')) THEN
      ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (status IN ('pending','paid','rejected','cancelled','expired')) NOT VALID;
      RAISE WARNING 'Yannz 008: orders_status_chk added NOT VALID (old rows have other status values)';
    ELSE
      ALTER TABLE orders ADD CONSTRAINT orders_status_chk CHECK (status IN ('pending','paid','rejected','cancelled','expired'));
    END IF;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_status_chk' AND conrelid = 'payments'::regclass) THEN
    IF EXISTS (SELECT 1 FROM payments WHERE status NOT IN ('pending','paid','rejected','expired')) THEN
      ALTER TABLE payments ADD CONSTRAINT payments_status_chk CHECK (status IN ('pending','paid','rejected','expired')) NOT VALID;
      RAISE WARNING 'Yannz 008: payments_status_chk added NOT VALID (old rows have other status values)';
    ELSE
      ALTER TABLE payments ADD CONSTRAINT payments_status_chk CHECK (status IN ('pending','paid','rejected','expired'));
    END IF;
  END IF;
END $$;
