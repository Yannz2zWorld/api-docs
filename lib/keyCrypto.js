'use strict';
const crypto=require('crypto');
function digest(key){return crypto.createHash('sha256').update(String(key)).digest('hex');}
module.exports={digest};
