'use strict';
const TIERS = Object.freeze({
 FREE:{price:0,limit:100,keys:0,rank:0}, SULTAN:{price:5000,limit:1000,keys:2,rank:1},
 SEPUH:{price:10000,limit:10000,keys:3,rank:2}, DEWA:{price:25000,limit:100000,keys:Infinity,rank:3}, OWNER:{price:null,limit:Infinity,keys:Infinity,rank:4}
});
const purchasable = ['SULTAN','SEPUH','DEWA'];
function getTier(tier){return TIERS[TIERS[tier] ? tier : 'FREE'];}
function canAccess(userTier, minimum='FREE', locked=false){return userTier==='OWNER'||(!locked&&getTier(userTier).rank>=getTier(minimum).rank);}
module.exports={TIERS,purchasable,getTier,canAccess};
