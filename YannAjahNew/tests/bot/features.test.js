'use strict';
// Menjalankan kasus uji yang dideklarasikan setiap fitur (field `tests`) dan menulis hasilnya ke
// reports/feature-tests.json (dibaca tools/feature-report.js untuk status "tested").
// Fitur dengan `pure` diuji langsung; selainnya lewat run(ctx) dengan konteks tiruan.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadRegistry, mockCtx, check, freshStore } = require('./feature-harness');

const { registry } = loadRegistry();
const results = {};

test('registry memuat plugin tanpa error validasi', () => {
  assert.deepEqual(registry.loadErrors, [], JSON.stringify(registry.loadErrors, null, 1));
  assert.ok(registry.features.size > 0);
});

for (const f of registry.features.values()) {
  if (!Array.isArray(f.tests) || !f.tests.length) continue;
  test(`fitur ${f.id}`, async () => {
    const r = results[f.id] = { passed: 0, failed: 0, cases: f.tests.length };
    for (const tc of f.tests) {
      let out;
      if (typeof f.pure === 'function') out = await f.pure(tc.input, {});
      else {
        const { ctx, replies } = mockCtx({ feature: f, text: tc.input || '', store: freshStore(), ...(tc.ctx || {}), extra: { registry, ...(tc.ctx?.extra || {}) } });
        try { await f.run(ctx); }
        catch (e) { if (e.name !== 'UsageError') throw e; replies.push(e.userMessage); }   // sama seperti router
        out = replies.join('\n');
      }
      const ok = check(tc.expect, out);
      ok ? r.passed++ : r.failed++;
      assert.ok(ok, `input=${JSON.stringify(tc.input)} output=${JSON.stringify(String(out).slice(0, 300))}`);
    }
  });
}

after(() => {
  const dir = path.join(__dirname, '..', '..', 'reports');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'feature-tests.json');
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(file, 'utf8')).results || {}; } catch {}
  fs.writeFileSync(file, JSON.stringify({ generatedAt: new Date().toISOString(), results: { ...prev, ...results } }, null, 1));
});
