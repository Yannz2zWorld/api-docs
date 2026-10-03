'use strict';
async function notifyManualPayment(payload){
 // Provider adapter intentionally has no fake transport. Configure a real approved provider here.
 if(!process.env.OWNER_WA)return {sent:false,reason:'OWNER_WA_NOT_CONFIGURED'};
 return {sent:false,reason:'WHATSAPP_PROVIDER_NOT_CONFIGURED',recipientConfigured:true,payload};
}
module.exports={notifyManualPayment};
