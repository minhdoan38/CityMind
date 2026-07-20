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

test('public status BFF forwards X-Forwarded-For to FastAPI (D-17)', () => {
  const route = read(src('app', 'api', 'public', 'reports', 'status', 'route.ts'));
  assert.match(route, /backendEndpoint\(\s*["']\/api\/v1\/reports\/status["']\s*\)/);
  assert.match(route, /X-Forwarded-For/);
  assert.match(route, /x-forwarded-for|x-real-ip/i);
  assert.match(route, /Content-Type.*application\/json|application\/json/);
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
