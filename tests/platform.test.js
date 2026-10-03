'use strict';
const test=require('node:test');const assert=require('node:assert/strict');
const {TIERS,getTier,canAccess}=require('../services/tierService');const {digest}=require('../lib/keyCrypto');
test('tier limits and key allowances match product policy',()=>{assert.equal(TIERS.FREE.limit,100);assert.equal(TIERS.SULTAN.limit,1000);assert.equal(TIERS.SEPUH.limit,10000);assert.equal(TIERS.DEWA.limit,100000);assert.equal(TIERS.OWNER.limit,Infinity);assert.equal(getTier('OWNER').keys,Infinity);});
test('tier authorization honors minimum and owner bypass',()=>{assert.equal(canAccess('FREE','SULTAN',false),false);assert.equal(canAccess('SULTAN','SULTAN',false),true);assert.equal(canAccess('DEWA','SEPUH',true),false);assert.equal(canAccess('OWNER','OWNER',true),true);});
test('API key hashing is deterministic and not plaintext',()=>{const key='test-only-key-material';const h=digest(key);assert.equal(h,digest(key));assert.notEqual(h,key);assert.match(h,/^[a-f0-9]{64}$/);});
test('FREE has no custom keys while paid plans have defined caps',()=>{assert.equal(TIERS.FREE.keys,0);assert.equal(TIERS.SULTAN.keys,2);assert.equal(TIERS.SEPUH.keys,3);assert.equal(TIERS.DEWA.keys,Infinity);});
