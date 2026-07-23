import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

// Branch table: 13-UI-SPEC.md — CitizenTriageOutcome service_step branches (SHELP-01)
// self_help_guidance → CoachPanel embed; officer_review → government Alert, no CoachPanel

test('success page imports SuccessTriagePanel for guidance and chat (D-13-02)', () => {
  const success = read(src('app', '[locale]', 'report', 'success', 'page.tsx'));
  const panel = read(src('components', 'coach', 'SuccessTriagePanel.tsx'));

  assert.match(success, /import SuccessTriagePanel/);
  assert.match(success, /initialOutcome=\{outcome\}/);
  assert.match(panel, /CitizenTriageOutcome/);
  assert.match(panel, /isOutcomeReady/);
  assert.match(panel, /\/api\/public\/reports\/status/);
  assert.match(panel, /60_000/);
});

test('CitizenTriageOutcome embeds CoachPanel only on self_help_guidance (SHELP-01)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));

  assert.match(outcome, /service_step === "self_help_guidance"/);
  assert.match(
    outcome,
    /isSelfHelp\s*\?\s*\([\s\S]*<CoachPanel[\s\S]*\)\s*:\s*\([\s\S]*<Alert/,
    'CoachPanel conditional on self_help; government path uses Alert',
  );
  assert.match(outcome, /useTranslations\("public\.successOutcome"\)/);
  assert.match(outcome, /useTranslations\("public\.triage"\)/);
  assert.match(outcome, /calmNoticeTitle/);
  assert.match(outcome, /pathGovernment/);
  assert.match(outcome, /pathSelfHelp/);
});

test('CitizenTriageOutcome government path exposes escalate CTA without CoachPanel (SHELP-04)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));

  assert.match(outcome, /tr\("escalateTitle"\)/);
  assert.match(outcome, /coach\.governmentPathBody/);
  assert.match(outcome, /coach\.openStatusPage/);
  assert.doesNotMatch(
    outcome,
    /isSelfHelp\s*\?\s*null\s*:\s*<CoachPanel/,
    'CoachPanel must not render on government branch',
  );
});

test('CoachPanel self-help path includes escalate CTA (SHELP-04)', () => {
  const coach = read(src('components', 'coach', 'CoachPanel.tsx'));

  assert.match(coach, /tr\("escalateCta"\)/);
  assert.match(coach, /onEscalate/);
});

test('calm copy paths forbid provider name leakage (T-13-01)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));
  const en = JSON.parse(read(path.join(root, 'messages', 'en.json')));

  assert.ok(!outcome.match(/openai|gemini|anthropic|api[_-]?key|stack trace/i));
  assert.ok(!en.public.triage.calmNoticeBody.match(/openai|gemini|api key/i));
  assert.ok(!en.public.successOutcome.advisoryNote.match(/openai|gemini|api key/i));
});

test('ReportForm flash stores nested outcome with service_step and triage_status (PUB-04)', () => {
  const form = read(src('components', 'ReportForm.tsx'));

  assert.match(form, /writeReportSuccessFlash/);
  assert.match(form, /outcome:\s*\{/);
  assert.match(form, /service_step:/);
  assert.match(form, /triage_status:/);
  assert.match(form, /can_escalate:/);
});

test('SuccessTriagePanel polls status endpoint and renders CitizenTriageOutcome (D-13-02)', () => {
  const panel = read(src('components', 'coach', 'SuccessTriagePanel.tsx'));

  assert.match(panel, /\/api\/public\/reports\/status/);
  assert.match(panel, /60_000/);
  assert.match(panel, /method:\s*"POST"/);
  assert.match(panel, /coach\.pollTimeout/);
  assert.match(panel, /<CitizenTriageOutcome/);
});
