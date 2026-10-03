'use strict';
const {query}=require('../lib/db');const {getTier}=require('./tierService');
async function consume({userId,keyId,endpointId,tier}){
 const limit=getTier(tier).limit;
 if(!Number.isFinite(limit)){const rows=await query(`WITH reserved AS (INSERT INTO daily_quota_counters(user_id,usage_date,request_count) VALUES($1,(now() AT TIME ZONE 'UTC')::date,1) ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count=daily_quota_counters.request_count+1,updated_at=now() RETURNING request_count), logged AS (INSERT INTO api_usage(user_id,api_key_id,endpoint_id,usage_date,request_count) VALUES($1,$2,$3,(now() AT TIME ZONE 'UTC')::date,1) ON CONFLICT(user_id,endpoint_id,usage_date) DO UPDATE SET request_count=api_usage.request_count+1,updated_at=now() RETURNING request_count) SELECT reserved.request_count AS used FROM reserved JOIN logged ON true`,[userId,keyId,endpointId]);return {allowed:true,used:Number(rows[0]?.used||0),limit:null,remaining:null,resetAt:nextUtcMidnight()};}
 // A per-user/day atomic reservation serializes quota decisions across endpoint paths.
 const rows=await query(`WITH reserve AS (
   INSERT INTO daily_quota_counters(user_id,usage_date,request_count)
   VALUES($1,(now() AT TIME ZONE 'UTC')::date,1)
   ON CONFLICT(user_id,usage_date) DO UPDATE SET request_count=daily_quota_counters.request_count+1,updated_at=now()
   WHERE daily_quota_counters.request_count < $4 RETURNING request_count
 ), logged AS (
   INSERT INTO api_usage(user_id,api_key_id,endpoint_id,usage_date,request_count)
   SELECT $1,$2,$3,(now() AT TIME ZONE 'UTC')::date,1 FROM reserve
   ON CONFLICT(user_id,endpoint_id,usage_date) DO UPDATE SET request_count=api_usage.request_count+1,updated_at=now()
   RETURNING request_count
 ) SELECT reserve.request_count AS used FROM reserve JOIN logged ON true`,[userId,keyId,endpointId,limit]);
 if(!rows.length){const cur=await query("SELECT COALESCE(request_count,0)::int AS used FROM daily_quota_counters WHERE user_id=$1 AND usage_date=(now() AT TIME ZONE 'UTC')::date",[userId]);const used=cur[0]?.used||0;return {allowed:false,used,limit,remaining:0,resetAt:nextUtcMidnight()};}
 const used=Number(rows[0].used);
 return {allowed:true,used,limit,remaining:Math.max(0,limit-used),resetAt:nextUtcMidnight()};
}
function nextUtcMidnight(){const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)).toISOString();}
async function usageToday(userId){const r=await query("SELECT COALESCE(request_count,0)::int AS used FROM daily_quota_counters WHERE user_id=$1 AND usage_date=(now() AT TIME ZONE 'UTC')::date",[userId]);return r[0]?.used||0;}
module.exports={consume,usageToday,nextUtcMidnight};
