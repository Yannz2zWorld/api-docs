'use strict';
// price is per 30 days; orders scale it by the chosen duration (see priceFor).
const TIERS = Object.freeze({
 FREE:{price:0,limit:100,keys:0,rank:0}, SULTAN:{price:5000,limit:1000,keys:2,rank:1},
 SEPUH:{price:10000,limit:10000,keys:3,rank:2}, DEWA:{price:25000,limit:100000,keys:Infinity,rank:3}, OWNER:{price:null,limit:Infinity,keys:Infinity,rank:4}
});
const purchasable = ['SULTAN','SEPUH','DEWA'];
const DURATION = Object.freeze({ min: 7, max: 365, default: 30 });
function getTier(tier){return TIERS[TIERS[tier] ? tier : 'FREE'];}
function canAccess(userTier, minimum='FREE', locked=false){return userTier==='OWNER'||(!locked&&getTier(userTier).rank>=getTier(minimum).rank);}
// Proportional to the 30-day price, rounded up to the next Rp100.
function priceFor(tier, days){return Math.ceil((TIERS[tier].price*days/30)/100)*100;}
// SQL rank of a tier name, for settlement statements.
const rankSql = col => `(CASE ${col} WHEN 'OWNER' THEN 4 WHEN 'DEWA' THEN 3 WHEN 'SEPUH' THEN 2 WHEN 'SULTAN' THEN 1 ELSE 0 END)`;
module.exports={TIERS,purchasable,DURATION,getTier,canAccess,priceFor,rankSql};
