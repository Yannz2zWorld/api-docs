'use strict';
const {query}=require('../lib/db');
// Orders expire after their window unless a manual payment proof is already waiting for owner
// review; expiring those would make an honest, submitted payment impossible to approve.
async function expirePendingOrders(){return query(`WITH expired AS (UPDATE orders o SET status='expired',updated_at=now() WHERE o.status='pending' AND o.expires_at<=now() AND NOT EXISTS (SELECT 1 FROM payments mp WHERE mp.order_id=o.id AND mp.provider='manual' AND mp.status='pending') RETURNING o.id), expired_payments AS (UPDATE payments p SET status='expired',updated_at=now() WHERE p.status='pending' AND p.order_id IN (SELECT id FROM expired) RETURNING p.id) SELECT (SELECT count(*)::int FROM expired) AS orders_expired,(SELECT count(*)::int FROM expired_payments) AS payments_expired`);}
module.exports={expirePendingOrders};
