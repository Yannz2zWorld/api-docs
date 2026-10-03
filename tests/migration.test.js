'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,'../migrations/002_platform.sql'),'utf8').toLowerCase();
test('platform migration is additive and contains required persistent tables',()=>{assert.doesNotMatch(sql,/\bdrop\s+table\b/);for(const t of ['api_keys','api_usage','daily_quota_counters','endpoints','orders','payments','audit_logs','server_settings'])assert.match(sql,new RegExp(`create table if not exists ${t}`));assert.match(sql,/add column if not exists banned_at/);assert.match(sql,/add column if not exists ban_reason/);});
test('API key and order idempotency indexes are present',()=>{assert.match(sql,/api_keys_idempotency_uidx/);assert.match(sql,/orders_idempotency_uidx/);});
