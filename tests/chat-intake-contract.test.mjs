import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

// Phase 15 contract: chat-first intake (PUB-07), guidance scripts (SHELP-06),
// SHELP-04/SHELP-05 regression wiring. Officer/agent-console scope excluded.

test('report page uses ReportForm as primary submit surface (PUB-07)', () => {
  const page = read(src('app', '[locale]', 'report', 'page.tsx'));

  assert.match(page, /import ReportForm/);
  assert.match(page, /<ReportForm\s*\/>/);
  assert.doesNotMatch(page, /ChatIntakePanel/, 'intake chat is not the primary report surface');
});

test('ChatIntakePanel wires intake start, messages, and submit APIs (PUB-07)', () => {
  const panel = read(src('components', 'coach', 'ChatIntakePanel.tsx'));

  assert.match(panel, /\/api\/public\/reports\/intake\/start/);
  assert.match(panel, /\/api\/public\/reports\/intake\/messages/);
  assert.match(panel, /\/api\/public\/reports\/intake\/submit/);
  assert.match(panel, /writeReportSuccessFlash/);
  assert.match(panel, /router\.push\("\/report\/success"\)/);
});

test('success page self_help path promotes post-submit chat for next steps (PUB-07)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));

  assert.match(outcome, /tw\("chatHeading"\)/);
  assert.match(outcome, /tw\("chatIntro"\)/);
  assert.match(
    outcome,
    /isSelfHelp\s*\?\s*\([\s\S]*<CoachPanel/,
    'CoachPanel renders on self_help success path after guidance',
  );
});

test('CitizenTriageOutcome imports GuidanceScriptCard on self_help path (SHELP-06)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));

  assert.match(outcome, /import GuidanceScriptCard/);
  assert.match(outcome, /service_step === "self_help_guidance"/);
  assert.match(
    outcome,
    /showGuidanceScript\s*=[\s\S]*guidance_status === "script_ready"/,
    'GuidanceScriptCard gated on script_ready self_help path',
  );
  assert.match(
    outcome,
    /showGuidanceScript\s*\?\s*\([\s\S]*<GuidanceScriptCard/,
    'GuidanceScriptCard renders when showGuidanceScript is true',
  );
});

test('government path keeps escalate CTA without GuidanceScriptCard (SHELP-04 / SHELP-06)', () => {
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));

  assert.match(outcome, /tr\("escalateTitle"\)/);
  assert.match(outcome, /guidance_status === "generate_later"/);
  assert.match(
    outcome,
    /isSelfHelp\s*\?\s*\([\s\S]*\)\s*:\s*\([\s\S]*<Alert/,
    'government branch uses Alert, not GuidanceScriptCard',
  );
});

test('Hanoi classifier references v5.2 prompt path (TRIAGE-15)', () => {
  const hanoi = read(src('server', 'ai', 'hanoi.ts'));
  const openai = read(src('server', 'ai', 'openai-compatible.ts'));

  assert.match(hanoi, /HANOI_PROMPT_PATH/);
  assert.match(hanoi, /citymind_ai_hanoi_triage_guidance_v5_2/);
  assert.match(hanoi, /buildHanoiSystemPrompt/);
  assert.match(openai, /buildHanoiSystemPrompt/);
});

test('chat intake contract excludes officer agent-console scope', () => {
  const panel = read(src('components', 'coach', 'ChatIntakePanel.tsx'));
  const outcome = read(src('components', 'coach', 'CitizenTriageOutcome.tsx'));
  const page = read(src('app', '[locale]', 'report', 'page.tsx'));

  for (const srcText of [panel, outcome, page]) {
    assert.doesNotMatch(srcText, /\/api\/officer\/assistant/);
    assert.doesNotMatch(srcText, /agent-console/);
    assert.doesNotMatch(srcText, /triage-console/);
  }
});

test('SHELP-05 regression wiring remains on classic form and poll fallback', () => {
  const form = read(src('components', 'ReportForm.tsx'));
  const panel = read(src('components', 'coach', 'SuccessTriagePanel.tsx'));
  const success = read(src('app', '[locale]', 'report', 'success', 'page.tsx'));

  assert.match(form, /formAnalyzing/);
  assert.match(panel, /\/api\/public\/reports\/status/);
  assert.match(panel, /120_000/);
  assert.match(success, /SuccessTriagePanel/);
});
