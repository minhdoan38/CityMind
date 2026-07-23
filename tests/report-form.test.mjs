import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const messagesDir = path.join(root, 'messages');
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

const walkKeys = (o) =>
  Object.entries(o)
    .flatMap(([k, v]) =>
      v && typeof v === 'object' ? walkKeys(v).map((x) => `${k}.${x}`) : [k]
    )
    .sort();

test('exact RHF stack pins are installed (Task 1 approved)', () => {
  const pkg = JSON.parse(read(path.join(root, 'package.json')));
  assert.equal(pkg.dependencies['react-hook-form'], '7.82.0');
  assert.equal(pkg.dependencies.zod, '4.4.3');
  assert.equal(pkg.dependencies['@hookform/resolvers'], '5.4.0');
  assert.equal(pkg.dependencies['next-intl'], '4.13.2');
});

test('report form + success pages and shadcn form pieces exist', () => {
  assert.ok(fs.existsSync(src('components', 'ReportForm.tsx')));
  assert.ok(fs.existsSync(src('components', 'ReportAnalyzingState.tsx')));
  assert.ok(fs.existsSync(src('app', '[locale]', 'report', 'page.tsx')));
  assert.ok(fs.existsSync(src('app', '[locale]', 'report', 'success', 'page.tsx')));
  assert.ok(fs.existsSync(src('app', '[locale]', 'report', 'failed', 'page.tsx')));
  assert.ok(fs.existsSync(src('components', 'ui', 'form.tsx')));
  assert.ok(fs.existsSync(src('components', 'ui', 'textarea.tsx')));
  assert.ok(fs.existsSync(src('components', 'ui', 'badge.tsx')));
});

test('ReportForm uses RHF+Zod, analyzing state, and sessionStorage flash (PUB-03/04)', () => {
  const form = read(src('components', 'ReportForm.tsx'));

  assert.match(form, /useForm/);
  assert.match(form, /zodResolver/);
  assert.match(form, /from ['"]zod['"]/);
  assert.match(form, /\.max\(\s*3000\s*\)/);
  assert.match(form, /evidence-limits/);
  assert.match(form, /DEFAULT_MAX_EVIDENCE_BYTES/);
  assert.doesNotMatch(form, /8\s*\*\s*1024\s*\*\s*1024/);
  assert.match(form, /evidence-input-types/);
  assert.match(form, /EVIDENCE_FILE_ACCEPT/);
  assert.match(form, /HEIC \(iPhone\)/);
  assert.match(form, /\/api\/public\/reports/);
  assert.doesNotMatch(form, /\/api\/public\/reports\/analyze/);
  assert.match(form, /FormData/);
  assert.match(form, /writeReportSuccessFlash/);
  assert.match(form, /reportId/);
  assert.match(form, /accessToken/);
  assert.match(form, /access_token/);
  assert.match(form, /report\/success/);
  assert.match(form, /report\/failed/);
  assert.match(form, /writeReportFailedFlash/);
  assert.match(form, /ReportAnalyzingState/);
  assert.match(form, /isAnalyzing/);
  assert.match(form, /analyzeStep/);
  assert.match(form, /formAnalyzing/);
  assert.match(form, /outcome:\s*\{/);
  assert.match(form, /service_step:/);
  assert.match(form, /disabled=\{.*(?:isSubmitting|loading)/);
  assert.doesNotMatch(form, /access_token=|\?token=/);
  assert.doesNotMatch(form, /slate-950/);
  assert.match(form, /geolocation|useMyLocation/);
});

test('failed page one-shot flash and retry actions (PUB-06)', () => {
  const failed = read(src('app', '[locale]', 'report', 'failed', 'page.tsx'));

  assert.match(failed, /readReportFailedFlash/);
  assert.match(failed, /replace\(|redirect\(/);
  assert.match(failed, /\/report/);
  assert.match(failed, /failedTryAgain/);
});

test('success page one-shot flash, redirect, and guidance panel (D-11/D-18)', () => {
  const success = read(src('app', '[locale]', 'report', 'success', 'page.tsx'));
  const flashLib = read(src('lib', 'report-outcome-flash.ts'));

  assert.match(success, /readReportSuccessFlash/);
  assert.match(flashLib, /sessionStorage/);
  assert.match(flashLib, /removeItem/);
  assert.match(success, /SuccessTriagePanel/);
  assert.match(success, /hideStatusLinks/);
  assert.doesNotMatch(success, /accessTokenLabel|copyAccessToken|statusLinkPrep/);
  assert.match(success, /replace\(|redirect\(/);
  assert.match(success, /\/report/);
  assert.doesNotMatch(success, /useSearchParams|searchParams\.get/);
  assert.doesNotMatch(success, /router\.(push|replace)\([^)]*[?&](access_)?token=/);
  assert.doesNotMatch(success, /slate-950/);
});

test('Report/Success catalog strings match UI-SPEC (PUB-06)', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const vi = JSON.parse(read(path.join(messagesDir, 'vi.json')));
  assert.deepEqual(walkKeys(en), walkKeys(vi));

  const required = {
    reportPageTitle: 'Report an issue',
    submitReport: 'Submit report',
    analyzing: 'Analyzing your report…',
    locationHelper: 'Location helps officers respond faster. You can still submit without it.',
    imageHelper: 'Optional photo — JPEG, PNG, WebP, HEIC (iPhone), or TIFF. We optimize it to WebP on upload.',
    formErrorClient: 'Fix the highlighted fields, then try again.',
    formErrorNetwork: 'Could not send your report. Check your connection and try again.',
    successHeading: "Here's what you can do",
    successBody:
      'We reviewed what you reported. Follow the steps below, then use chat if you need more help.',
    copyReportId: 'Copy report ID',
    copyAccessToken: 'Copy access token',
    tokenWarning: 'This token is shown once. We can’t show it again.',
    statusLinkPrep: 'Status link — copy to check updates',
  };

  for (const [key, expected] of Object.entries(required)) {
    assert.equal(typeof en.public[key], 'string', `missing public.${key}`);
    assert.equal(en.public[key], expected, `public.${key} copy mismatch`);
    assert.equal(typeof vi.public[key], 'string', `missing vi public.${key}`);
    assert.ok(vi.public[key].length > 0, `empty vi public.${key}`);
  }

  const successOutcomeKeys = walkKeys(en.public.successOutcome);
  assert.deepEqual(successOutcomeKeys, walkKeys(vi.public.successOutcome));
  for (const key of successOutcomeKeys) {
    assert.ok(en.public.successOutcome[key].length > 0, `empty en successOutcome.${key}`);
    assert.ok(vi.public.successOutcome[key].length > 0, `empty vi successOutcome.${key}`);
  }

  assert.equal(en.public.formAnalyzing, 'Reviewing your report…');
  assert.equal(vi.public.formAnalyzing, 'Đang xem xét báo cáo của bạn…');

  // Preserve Home keys from Plan 02-02
  assert.equal(en.public.reportCTA, 'Report an issue');
  assert.equal(
    en.public.heroAdvisory,
    'AI helps organize reports. Officers review and decide.'
  );
});

test('locale report page wires classic ReportForm without dashboard chrome', () => {
  const page = read(src('app', '[locale]', 'report', 'page.tsx'));
  assert.match(page, /ReportForm/);
  assert.match(page, /reportPageTitle|CityMindLogo/);
  assert.doesNotMatch(page, /slate-950/);
});
