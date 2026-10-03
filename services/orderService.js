'use strict';
const {query}=require('../lib/db');
async function expirePendingOrders(){return query(`WITH expired AS (UPDATE orders SET status='expired',updated_at=now() WHERE status='pending' AND expires_at<=now() RETURNING id), expired_payments AS (UPDATE payments p SET status='expired',updated_at=now() WHERE p.status='pending' AND p.order_id IN (SELECT id FROM expired) RETURNING p.id) SELECT (SELECT count(*)::int FROM expired) AS orders_expired,(SELECT count(*)::int FROM expired_payments) AS payments_expired`);}
module.exports={expirePendingOrders};
