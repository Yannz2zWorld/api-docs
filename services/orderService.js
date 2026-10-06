'use strict';
const {query}=require('../lib/db');
const {rankSql}=require('./tierService');
// Orders expire after their window unless a manual payment proof is already waiting for owner
// review; expiring those would make an honest, submitted payment impossible to approve.
async function expirePendingOrders(){return query(`WITH expired AS (UPDATE orders o SET status='expired',updated_at=now() WHERE o.status='pending' AND o.expires_at<=now() AND NOT EXISTS (SELECT 1 FROM payments mp WHERE mp.order_id=o.id AND mp.provider='manual' AND mp.status='pending') RETURNING o.id), expired_payments AS (UPDATE payments p SET status='expired',updated_at=now() WHERE p.status='pending' AND p.order_id IN (SELECT id FROM expired) RETURNING p.id) SELECT (SELECT count(*)::int FROM expired) AS orders_expired,(SELECT count(*)::int FROM expired_payments) AS payments_expired`);}

// CTE fragment applying a paid order (CTE `paidCte` exposing user_id, tier, duration_days)
// to its user:
// - higher than the user's current (unexpired) tier: switch, expiry = now + duration;
// - same tier with an expiry: extend from max(expiry, now); same tier without expiry: unchanged;
// - lower than the current tier: nothing changes (a stale cheaper order cannot downgrade).
function applyPaidOrderSql(paidCte){
 const current=`(CASE WHEN u.tier_expires_at IS NOT NULL AND u.tier_expires_at<=now() THEN 0 ELSE ${rankSql('u.tier')} END)`;
 const bought=rankSql(`${paidCte}.tier`);
 return `UPDATE users u SET
   tier=CASE WHEN ${current}<${bought} THEN ${paidCte}.tier ELSE u.tier END,
   tier_expires_at=CASE
     WHEN ${current}<${bought} THEN now()+make_interval(days=>${paidCte}.duration_days)
     WHEN ${current}=${bought} AND u.tier=${paidCte}.tier AND u.tier_expires_at IS NOT NULL THEN GREATEST(u.tier_expires_at,now())+make_interval(days=>${paidCte}.duration_days)
     ELSE u.tier_expires_at END,
   updated_at=now()
  FROM ${paidCte} WHERE u.id=${paidCte}.user_id RETURNING u.id,u.tier,u.tier_expires_at`;
}
// Expiry is housekeeping: a failure (e.g. a legacy CHECK constraint on a pre-existing table)
// must not take down order listing, checkout or the owner panel. Logged with its SQLSTATE only.
async function expirePendingOrdersSafe(){
 try{return await expirePendingOrders();}
 catch(e){console.error('Order expiry skipped:',{code:e?.code||null,constraint:e?.cause?.constraint||null});return null;}
}
module.exports={expirePendingOrders,expirePendingOrdersSafe,applyPaidOrderSql};
