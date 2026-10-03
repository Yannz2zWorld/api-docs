'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const rows = [];
let nextId = 1;
const originalLoad = Module._load;

Module._load = function (request, parent, isMain) {
  if (request === '@neondatabase/serverless') {
    return {
      neon: () => ({
        query: async (text, params = []) => {
          const sql = String(text).replace(/\s+/g, ' ').trim().toLowerCase();
          if (sql.startsWith('select id, google_id, email, name, picture, tier, status') && sql.includes('where google_id = $1 or lower(email)')) {
            return rows.filter(r => r.google_id === params[0] || r.email.toLowerCase() === params[1].toLowerCase()).slice(0, 1);
          }
          if (sql.startsWith('select id, google_id, email, name, picture, tier, status') && sql.includes('where google_id = $1 or id::text = $1')) {
            return rows.filter(r => r.google_id === params[0] || String(r.id) === params[0]).slice(0, 1);
          }
          if (sql.startsWith('update users')) {
            const [googleId, email, name, picture, owner, id] = params;
            const row = rows.find(r => r.id === id);
            if (!row) return [];
            Object.assign(row, { google_id: googleId, email, name, picture, tier: owner ? 'OWNER' : (row.tier || 'FREE'), updated_at: new Date() });
            return [{ ...row }];
          }
          if (sql.startsWith('insert into users')) {
            const [googleId, email, name, picture, tier, status] = params;
            const row = { id: nextId++, google_id: googleId, email, name, picture, tier, status, daily_usage: 0, last_usage_reset: new Date().toISOString().slice(0, 10), created_at: new Date(), updated_at: new Date() };
            rows.push(row);
            return [{ ...row }];
          }
          throw new Error('Unexpected test SQL: ' + sql);
        }
      })
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};

process.env.DATABASE_URL = 'postgresql://test-only.invalid/db';
process.env.OWNER_EMAIL = 'owner@example.test';
const service = require('../services/userService');

 test('first Google login creates a FREE active user', async () => {
  rows.length = 0;
  nextId = 1;
  const user = await service.upsertGoogleUser({ googleId: 'google-101', email: 'person@example.test', name: 'Person', picture: 'https://example.test/p.png' });
  assert.equal(rows.length, 1);
  assert.equal(user.tier, 'FREE');
  assert.equal(user.status, 'active');
  assert.equal(user.dailyUsage, 0);
});

test('repeat Google login updates profile without duplicating user or resetting tier/status', async () => {
  rows.length = 0;
  nextId = 1;
  const first = await service.upsertGoogleUser({ googleId: 'google-202', email: 'person2@example.test', name: 'Old Name' });
  rows[0].tier = 'SEPUH';
  rows[0].status = 'banned';
  const second = await service.upsertGoogleUser({ googleId: 'google-202', email: 'person2@example.test', name: 'New Name', picture: 'https://example.test/new.png' });
  assert.equal(rows.length, 1);
  assert.equal(second.id, first.id);
  assert.equal(second.name, 'New Name');
  assert.equal(second.tier, 'SEPUH');
  assert.equal(second.status, 'banned');
});

test('OWNER_EMAIL overrides a changed database tier', async () => {
  rows.length = 0;
  nextId = 1;
  const user = await service.upsertGoogleUser({ googleId: 'google-owner', email: 'OWNER@example.test', name: 'Owner' });
  rows[0].tier = 'FREE';
  const mapped = service.mapUser(rows[0]);
  assert.equal(user.isOwner, true);
  assert.equal(mapped.tier, 'OWNER');
  assert.equal(mapped.isOwner, true);
});

Module._load = originalLoad;

test('banned status remains banned when mapping a database user',()=>{const mapped=service.mapUser({id:'u-banned',google_id:'g-banned',email:'banned@example.test',tier:'SULTAN',status:'banned'});assert.equal(mapped.status,'banned');assert.equal(mapped.tier,'SULTAN');});
test('stored OWNER tier does not grant owner privileges to a non-owner email',()=>{const mapped=service.mapUser({id:'u-stale',google_id:'g-stale',email:'other@example.test',tier:'OWNER',status:'active'});assert.equal(mapped.isOwner,false);assert.equal(mapped.tier,'FREE');});
