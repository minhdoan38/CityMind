import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), 'utf8');
}

test('failed triage copy avoids provider names and stack traces', () => {
  const src = read('src/server/services/citizen-status.ts');

  assert.match(
    src,
    /row\.triage_status === "failed" \|\| row\.triage_status === "manual_review"/,
    'failed/manual_review branch must exist',
  );
  assert.match(src, /service_step: "automated_review_unavailable"/);
  assert.match(src, /summary: null/);
  assert.match(src, /recommendation: null/);
  assert.ok(!src.includes('triage_error'));
  assert.ok(!src.match(/openai|gemini|anthropic|api[_-]?key|stack trace/i));
});

test('EN/VI calm notice copy exists for automated_review_unavailable', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  assert.ok(en.public.triage.calmNoticeTitle);
  assert.ok(en.public.triage.calmNoticeBody);
  assert.ok(vi.public.triage.calmNoticeTitle);
  assert.ok(vi.public.triage.calmNoticeBody);
  assert.ok(!en.public.triage.calmNoticeBody.match(/openai|gemini|api key/i));
});

test('officer default sort elevates failed and manual_review triage bucket', () => {
  const filters = read('src/server/officer/filters.ts');
  assert.match(filters, /manual_review|failed/);
  assert.match(filters, /triage_bucket/);
});
