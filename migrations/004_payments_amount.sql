-- payments existed in an older shape without `amount` (002 skipped the existing table; 003 missed this column).
-- Safe to re-run; additive only. Existing payments take the amount of their order.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS amount integer;
UPDATE payments p SET amount = o.amount FROM orders o WHERE p.amount IS NULL AND o.id = p.order_id;
UPDATE payments SET amount = 0 WHERE amount IS NULL;
ALTER TABLE payments ALTER COLUMN amount SET NOT NULL;
