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

const STATUS_CATALOG_KEYS = [
  'statusHeading',
  'statusBody',
  'checkStatus',
  'statusChecking',
  'statusPrivacyNote',
  'statusEmptyHeading',
  'statusEmptyBody',
  'statusHistoryEmpty',
  'statusHistoryHeading',
  'statusCurrentLabel',
  'statusSummaryLabel',
  'statusVerifyFailed',
  'statusRateLimited',
  'statusNetworkError',
];

test('locale status page exists under app/[locale]/status (CIT-01 / D-03)', () => {
  assert.ok(
    fs.existsSync(src('app', '[locale]', 'status', 'page.tsx')),
    'expected frontend/src/app/[locale]/status/page.tsx'
  );
});

test('unprefixed /status redirects to /en/status preserving query (D-03)', () => {
  const page = read(src('app', 'status', 'page.tsx'));
  assert.match(page, /redirect\(/);
  assert.match(page, /\/en\/status/);
  assert.match(page, /searchParams|reportId|token/);
});

test('public status BFF delegates to local Next.js citizen status handler (D-17)', () => {
  const route = read(src('app', 'api', 'public', 'reports', 'status', 'route.ts'));
  assert.match(route, /handleCitizenStatusRequest/);
  assert.doesNotMatch(route, /backendEndpoint/);
  assert.doesNotMatch(route, /from ["']@\/lib\/backend["']/);
});

test('compatibility status route exists without FastAPI proxy (SELFHOST-01)', () => {
  const route = read(src('app', 'api', 'v1', 'reports', 'status', 'route.ts'));
  assert.match(route, /handleCitizenStatusRequest/);
  assert.doesNotMatch(route, /backendEndpoint/);
});

test('public.status* catalog keys exist with identical EN/VI trees (UI-SPEC)', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const vi = JSON.parse(read(path.join(messagesDir, 'vi.json')));
  assert.deepEqual(walkKeys(en), walkKeys(vi));

  for (const key of STATUS_CATALOG_KEYS) {
    assert.equal(typeof en.public[key], 'string', `missing en public.${key}`);
    assert.ok(en.public[key].length > 0, `empty en public.${key}`);
    assert.equal(typeof vi.public[key], 'string', `missing vi public.${key}`);
    assert.ok(vi.public[key].length > 0, `empty vi public.${key}`);
  }

  assert.equal(en.public.statusHeading, 'Check report status');
  assert.equal(
    en.public.statusVerifyFailed,
    'We couldn’t verify that report and token. Check both and try again.'
  );
  assert.equal(
    en.public.statusRateLimited,
    'Too many attempts — try again shortly.'
  );
  assert.equal(
    en.public.statusNetworkError,
    'Could not check status. Check your connection and try again.'
  );
  assert.equal(en.public.statusHistoryEmpty, 'No updates yet.');
  assert.equal(
    en.public.statusLinkPrep,
    'Status link — copy to check updates'
  );
  assert.doesNotMatch(en.public.statusLinkPrep, /coming soon/i);
});

test('success page builds locale-prefixed status prep URL (D-03 / D-09)', () => {
  const page = read(src('app', '[locale]', 'report', 'success', 'page.tsx'));
  assert.match(page, /useLocale/);
  assert.match(page, /\/\$\{locale\}\/status\?reportId=/);
  assert.doesNotMatch(page, /`\/status\?reportId=/);
});

const DASHBOARD_COPY_KEYS = [
  'copyStatusLink',
  'statusLinkCopied',
  'statusLinkRecoveryHint',
];

test('CopyStatusLink builds reportId-only status URL without token (DASH-08 / D-13 / D-14a)', () => {
  const componentPath = src('components', 'CopyStatusLink.tsx');
  assert.ok(
    fs.existsSync(componentPath),
    'expected frontend/src/components/CopyStatusLink.tsx'
  );
  const source = read(componentPath);
  // Absolute /{locale}/status?reportId=… — never append token= (D-14a / T-04-10)
  assert.match(
    source,
    /status\?reportId=\$\{encodeURIComponent\([^)]+\)\}/
  );
  assert.doesNotMatch(
    source,
    /status\?reportId=[^`'"]*token=/
  );
  assert.doesNotMatch(source, /[?&]token=/);
  assert.match(source, /statusLinkRecoveryHint/);
  assert.match(source, /navigator\.clipboard\.writeText/);
});

test('dashboard detail page wires CopyStatusLink in header/meta (D-13)', () => {
  const page = read(src('app', 'dashboard', 'reports', '[reportId]', 'page.tsx'));
  assert.match(page, /CopyStatusLink/);
});

test('dashboard.copyStatus* catalog keys exist with identical EN/VI trees (D-15 / UI-SPEC)', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const vi = JSON.parse(read(path.join(messagesDir, 'vi.json')));
  assert.deepEqual(walkKeys(en), walkKeys(vi));

  for (const key of DASHBOARD_COPY_KEYS) {
    assert.equal(typeof en.dashboard[key], 'string', `missing en dashboard.${key}`);
    assert.ok(en.dashboard[key].length > 0, `empty en dashboard.${key}`);
    assert.equal(typeof vi.dashboard[key], 'string', `missing vi dashboard.${key}`);
    assert.ok(vi.dashboard[key].length > 0, `empty vi dashboard.${key}`);
  }

  assert.equal(en.dashboard.copyStatusLink, 'Copy status link');
  assert.equal(en.dashboard.statusLinkCopied, 'Link copied');
  assert.equal(
    en.dashboard.statusLinkRecoveryHint,
    'Citizens need the access token from their submission page. The full link can’t be recovered here.'
  );
  assert.equal(vi.dashboard.copyStatusLink, 'Sao chép liên kết trạng thái');
  assert.equal(vi.dashboard.statusLinkCopied, 'Đã sao chép liên kết');
});
