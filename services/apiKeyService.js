'use strict';
const crypto=require('crypto'); const {query,transaction}=require('../lib/db'); const {getTier}=require('./tierService'); const {digest}=require('../lib/keyCrypto');
async function createKey(user,name,idempotencyKey=null){
 const cap=getTier(user.tier).keys;if(cap===0) throw Object.assign(new Error('Tier ini belum mendapat kuota API key.'),{code:'KEYS_NOT_INCLUDED'});
 const plain='yannz_live_'+crypto.randomBytes(32).toString('base64url');
 // The per-user advisory lock is taken in its own statement, so the INSERT's count (a new
 // READ COMMITTED snapshot) sees keys committed by concurrent requests: the cap cannot be overrun.
 const [,saved]=await transaction([
  {text:'SELECT pg_advisory_xact_lock(hashtext($1::text))',params:[String(user.id)]},
  {text:`INSERT INTO api_keys(user_id,name,key_hash,key_prefix,idempotency_key)
   SELECT $1::uuid,$2::text,$3::text,$4::text,$5::text
    WHERE $6::boolean OR (SELECT count(*) FROM api_keys WHERE user_id=$1::uuid AND status='active')<$7::int
   ON CONFLICT(user_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
   RETURNING id,name,key_prefix,status,created_at,last_used_at`,
   params:[user.id,String(name||'My API Key').trim().slice(0,80)||'My API Key',digest(plain),plain.slice(0,19),idempotencyKey,!Number.isFinite(cap),Number.isFinite(cap)?cap:0]}
 ]);
 if(!saved.length){
  if(idempotencyKey){const prior=await query('SELECT id FROM api_keys WHERE user_id=$1 AND idempotency_key=$2',[user.id,idempotencyKey]);if(prior.length)throw Object.assign(new Error('Permintaan key ini sudah diproses. Muat ulang daftar key; secret hanya ditampilkan saat pertama dibuat.'),{code:'IDEMPOTENCY_REPLAY'});}
  throw Object.assign(new Error('Batas API key tier kamu tercapai.'),{code:'KEY_LIMIT'});
 }
 return {key:plain,record:saved[0]};
}
async function listKeys(userId){return query('SELECT id,name,key_prefix,status,created_at,last_used_at,revoked_at FROM api_keys WHERE user_id=$1 ORDER BY created_at DESC',[userId]);}
async function revokeKey(userId,id){const r=await query("UPDATE api_keys SET status='revoked',revoked_at=now() WHERE id=$1 AND user_id=$2 AND status='active' RETURNING id",[id,userId]);return !!r.length;}
async function findKey(plain){if(!plain)return null;const rows=await query("SELECT k.id AS key_id,k.user_id,k.status AS key_status,u.email,CASE WHEN lower(u.email)=lower($2) THEN 'OWNER' WHEN u.tier='OWNER' THEN 'FREE' ELSE u.tier END AS tier,u.status AS user_status,u.id AS uid FROM api_keys k JOIN users u ON u.id=k.user_id WHERE k.key_hash=$1 LIMIT 1",[digest(plain),process.env.OWNER_EMAIL||'']);return rows[0]||null;}
module.exports={createKey,listKeys,revokeKey,findKey,digest};
