'use strict';
const axios=require('axios');
const METHODS=['payment_link','qris','bri_va','bni_va','cimb_niaga_va','permata_va','maybank_va','bnc_va','artha_graha_va','sampoerna_va'];
const MINIMUM={payment_link:500,qris:500,bri_va:10000,bni_va:10000,cimb_niaga_va:10000,permata_va:10000,maybank_va:10000,bnc_va:10000,artha_graha_va:10000,sampoerna_va:10000};
async function createTransaction(orderCode,method,amount){
 if(!METHODS.includes(method))throw Object.assign(new Error('Metode pembayaran ini nggak didukung.'),{code:'INVALID_PAYMENT_METHOD'});
 if(!Number.isInteger(Number(amount))||Number(amount)<MINIMUM[method])throw Object.assign(new Error('Nominalnya belum nyampe minimum metode pembayaran ini.'),{code:'INVALID_PAYMENT_AMOUNT'});
 if(!process.env.PAKASIR_PROJECT||!process.env.PAKASIR_API_KEY)throw Object.assign(new Error('Payment gateway belum diatur.'),{code:'PAYMENT_NOT_CONFIGURED'});
 const url=`https://app.pakasir.com/api/v2/create-transaction/${encodeURIComponent(process.env.PAKASIR_PROJECT)}/${encodeURIComponent(orderCode)}`;
 const {data}=await axios.post(url,{method,amount:Number(amount)},{headers:{'X-Api-Key':process.env.PAKASIR_API_KEY},timeout:15000});return data;
}
async function verifyTransaction(orderCode,amount){
 // Fail closed: Pakasir's published V2 create guide is clear, but no V2 detail/verification route is established here.
 // Do not silently fall back to the deprecated V1 transaction-detail API or trust webhook body alone.
 if(!process.env.PAKASIR_V2_VERIFY_URL)return false;
 const template=process.env.PAKASIR_V2_VERIFY_URL;
 if(!/^https:\/\//i.test(template))return false;
 // {api_key} lets the owner opt into a lookup API that takes the key as a query parameter
 // (e.g. Pakasir's transactiondetail). The URL is never logged.
 const url=template.replaceAll('{order_id}',encodeURIComponent(orderCode)).replaceAll('{amount}',encodeURIComponent(String(amount))).replaceAll('{project}',encodeURIComponent(process.env.PAKASIR_PROJECT||'')).replaceAll('{api_key}',encodeURIComponent(process.env.PAKASIR_API_KEY||''));
 const {data}=await axios.get(url,{headers:{'X-Api-Key':process.env.PAKASIR_API_KEY||''},timeout:15000});
 const t=data?.transaction||data?.data||data;
 return Boolean(t&&String(t.order_id||orderCode)===String(orderCode)&&Number(t.amount)===Number(amount)&&String(t.status||'').toLowerCase()==='completed');
}
function isConfigured(){return Boolean(process.env.PAKASIR_PROJECT&&process.env.PAKASIR_API_KEY);}
// The gateway is off ("maintenance") until PAYMENT_GATEWAY=on is set, even with the keys present;
// manual payments (QRIS image, DANA, GoPay + proof) keep working.
function isEnabled(){return isConfigured()&&/^(on|true|1)$/i.test(String(process.env.PAYMENT_GATEWAY||'').trim());}
function isVerificationConfigured(){return isConfigured()&&/^https:\/\//i.test(process.env.PAKASIR_V2_VERIFY_URL||'');}
module.exports={METHODS,createTransaction,verifyTransaction,isConfigured,isEnabled,isVerificationConfigured};
