'use strict';
const {query}=require('../lib/db');
async function writeAudit({actorUserId=null,action,targetType=null,targetId=null,metadata={},ipAddress=null}){
 await query('INSERT INTO audit_logs(actor_user_id,action,target_type,target_id,metadata,ip_address) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[actorUserId,action,targetType,targetId,JSON.stringify(metadata),ipAddress]);
}
module.exports={writeAudit};
