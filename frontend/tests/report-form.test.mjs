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
  assert.ok(fs.existsSync(src('app', '[locale]', 'report', 'page.tsx')));
  assert.ok(fs.existsSync(src('app', '[locale]', 'report', 'success', 'page.tsx')));
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
  assert.match(form, /8\s*\*\s*1024\s*\*\s*1024/);
  assert.match(form, /image\/jpeg|image\/png|image\/webp/);
  assert.match(form, /\/api\/public\/reports\/analyze/);
  assert.match(form, /FormData/);
  assert.match(form, /citymind:report-success/);
  assert.match(form, /reportId/);
  assert.match(form, /accessToken/);
  assert.match(form, /access_token/);
  assert.match(form, /report\/success/);
  assert.match(form, /Analyzing your report…|analyzing/);
  assert.match(form, /disabled=\{.*(?:isSubmitting|loading)/);
  assert.doesNotMatch(form, /access_token=|\?token=/);
  assert.doesNotMatch(form, /slate-950/);
  assert.match(form, /geolocation|useMyLocation/);
});

test('success page one-shot flash, redirect, copy live region, status prep (D-11/D-18)', () => {
  const success = read(src('app', '[locale]', 'report', 'success', 'page.tsx'));

  assert.match(success, /citymind:report-success/);
  assert.match(success, /sessionStorage/);
  assert.match(success, /removeItem/);
  assert.match(success, /reportId|report_id/);
  assert.match(success, /accessToken|access_token/);
  assert.match(success, /aria-live|live/);
  assert.match(success, /statusLinkPrep|coming soon|\/status/);
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
    imageHelper: 'Optional photo — JPEG, PNG, or WebP. Keep it under the size limit shown.',
    formErrorClient: 'Fix the highlighted fields, then try again.',
    formErrorNetwork: 'Could not send your report. Check your connection and try again.',
    successHeading: 'Report received',
    successBody: 'Save your report ID and access token. You’ll need them to check status later.',
    copyReportId: 'Copy report ID',
    copyAccessToken: 'Copy access token',
    tokenWarning: 'This token is shown once. We can’t show it again.',
    statusLinkPrep: 'Status link (coming soon) — copy for later',
  };

  for (const [key, expected] of Object.entries(required)) {
    assert.equal(typeof en.public[key], 'string', `missing public.${key}`);
    assert.equal(en.public[key], expected, `public.${key} copy mismatch`);
    assert.equal(typeof vi.public[key], 'string', `missing vi public.${key}`);
    assert.ok(vi.public[key].length > 0, `empty vi public.${key}`);
  }

  // Preserve Home keys from Plan 02-02
  assert.equal(en.public.reportCTA, 'Report an issue');
  assert.equal(
    en.public.heroAdvisory,
    'AI helps organize reports. Officers review and decide.'
  );
});

test('locale report page wires ReportForm without dashboard chrome', () => {
  const page = read(src('app', '[locale]', 'report', 'page.tsx'));
  assert.match(page, /ReportForm/);
  assert.match(page, /reportPageTitle|reportCTA/);
  assert.doesNotMatch(page, /slate-950/);
});
