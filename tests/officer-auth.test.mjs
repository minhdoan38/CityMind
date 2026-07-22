import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

test('auth helpers exist and use supabase getClaims (not getUser alone)', () => {
  const authContent = read(src('lib', 'auth.ts'));
  assert.match(authContent, /getClaims/);
  assert.match(authContent, /getSessionToken/);
  assert.match(authContent, /requireOfficerSession/);
  assert.match(authContent, /\.auth\.getClaims\s*\(/);
  assert.doesNotMatch(authContent, /citymind_officer_session|createHmac|HMAC/);
});

test('supabase client configs exist with SSR helpers', () => {
  assert.ok(fs.existsSync(src('lib', 'supabase', 'client.ts')), 'client.ts must exist');
  assert.ok(fs.existsSync(src('lib', 'supabase', 'server.ts')), 'server.ts must exist');
  const browser = read(src('lib', 'supabase', 'client.ts'));
  const server = read(src('lib', 'supabase', 'server.ts'));
  assert.match(browser, /createBrowserClient/);
  assert.match(server, /createServerClient/);
});

test('login route uses signInWithPassword and safe returnUrl (D-15)', () => {
  const loginRoute = read(src('app', 'api', 'session', 'login', 'route.ts'));
  assert.match(loginRoute, /signInWithPassword/);
  assert.match(loginRoute, /returnUrl/);
  assert.match(loginRoute, /safeReturnUrl/);
  assert.doesNotMatch(loginRoute, /citymind_officer_session|createHmac|createSessionToken/);

  const helper = read(src('lib', 'safe-return-url.ts'));
  assert.match(helper, /\/dashboard/);
});

test('logout route clears Supabase session', () => {
  const logoutRoute = read(src('app', 'api', 'session', 'logout', 'route.ts'));
  assert.match(logoutRoute, /signOut/);
  assert.doesNotMatch(logoutRoute, /citymind_officer_session/);
});

test('login page honors returnUrl and stays outside [locale]', () => {
  assert.ok(fs.existsSync(src('app', 'login', 'page.tsx')));
  assert.equal(fs.existsSync(src('app', '[locale]', 'login', 'page.tsx')), false);
  const loginPage = read(src('app', 'login', 'page.tsx'));
  assert.match(loginPage, /returnUrl/);
  assert.match(loginPage, /type=["']email["']/);
  assert.match(loginPage, /type=["']password["']/);
  assert.doesNotMatch(loginPage, /getTranslations|LocaleSwitcher/);
});

test('safeReturnUrl rejects open redirects (T-02-09)', async () => {
  const helperPath = src('lib', 'safe-return-url.ts');
  assert.ok(fs.existsSync(helperPath), 'safe-return-url.ts must exist');
  const helper = read(helperPath);
  assert.match(helper, /export function safeReturnUrl/);

  const { safeReturnUrl } = await import(pathToFileURL(helperPath).href);
  assert.equal(safeReturnUrl('/dashboard/reports/1'), '/dashboard/reports/1');
  assert.equal(safeReturnUrl('/dashboard?tab=open'), '/dashboard?tab=open');
  assert.equal(safeReturnUrl(null), '/dashboard');
  assert.equal(safeReturnUrl('https://evil.example/phish'), '/dashboard');
  assert.equal(safeReturnUrl('//evil.example'), '/dashboard');
  assert.equal(safeReturnUrl('/\\evil'), '/dashboard');
});

test('api routes use getClaims for validation', () => {
  const statusRoute = read(src('app', 'api', 'officer', 'reports', '[reportId]', 'status', 'route.ts'));
  assert.match(statusRoute, /handleUpdateReportStatusRequest/);
  const guard = read(src('server', 'officer', 'guard.ts'));
  assert.match(guard, /getClaims/);

  const imageRoute = read(src('app', 'api', 'officer', 'reports', '[reportId]', 'image', 'route.ts'));
  assert.match(imageRoute, /handleReportImageRequest/);
});

test('officer image route uses direct evidence handler without FastAPI proxy', () => {
  const imageRoute = read(src('app', 'api', 'officer', 'reports', '[reportId]', 'image', 'route.ts'));
  assert.match(imageRoute, /handleReportImageRequest/);
  assert.doesNotMatch(imageRoute, /officerFetch|backendEndpoint|BACKEND_API_URL/);
});

test('officer-read streams evidence from Supabase Storage directly (SELFHOST-01)', () => {
  const officerRead = read(src('server', 'services', 'officer-read.ts'));
  assert.match(officerRead, /downloadEvidenceLocation/);
  assert.doesNotMatch(officerRead, /officerFetch|backendEndpoint|BACKEND_API_URL/);
});

test('dashboard lists recent reports as ReportCard list (D-16)', () => {
  const reportCardPath = src('components', 'dashboard', 'ReportCard.tsx');
  assert.ok(fs.existsSync(reportCardPath), 'ReportCard.tsx must exist');

  const reportCard = read(reportCardPath);
  assert.match(reportCard, /category/);
  assert.match(reportCard, /priority/);
  assert.match(reportCard, /status/);
  assert.match(reportCard, /summary/);
  assert.match(reportCard, /\/dashboard\/reports\//);
  // Badge text labels — not color-only
  assert.match(reportCard, /Priority:|priority/i);
  assert.match(reportCard, /Status:|status/i);

  const dashboard = read(src('app', 'dashboard', 'page.tsx'));
  assert.match(dashboard, /ReportsTable/);
  assert.match(dashboard, /loadDashboardBundle/);
  assert.doesNotMatch(dashboard, /officerFetch/);
  assert.doesNotMatch(dashboard, /DataTable|<table|KPI|export.*csv|resolve.?note/i);
  assert.equal(fs.existsSync(src('app', '[locale]', 'dashboard', 'page.tsx')), false);
});

test('proxy.ts gates /dashboard with getClaims + returnUrl (AUTH-04 / D-15 / D-17)', () => {
  assert.ok(fs.existsSync(src('proxy.ts')), 'proxy.ts must exist (not middleware.ts)');
  assert.equal(fs.existsSync(path.join(root, 'src', 'middleware.ts')), false);
  assert.equal(fs.existsSync(path.join(root, 'middleware.ts')), false);

  const proxy = read(src('proxy.ts'));
  assert.match(proxy, /createMiddleware/);
  assert.match(proxy, /from ['"]next-intl\/middleware['"]/);
  assert.match(proxy, /createServerClient/);
  assert.match(proxy, /\.auth\.getClaims\s*\(/);
  assert.match(proxy, /returnUrl/);
  assert.match(proxy, /\/login/);
  assert.match(proxy, /startsWith\(['"]\/dashboard['"]\)/);
  assert.doesNotMatch(proxy, /getSession\s*\(/);
  // AUTH-04 path correction: never gate public Home as officer root
  assert.doesNotMatch(proxy, /pathname\s*===\s*['"]\/['"]/);
  assert.doesNotMatch(proxy, /citymind_officer_session/);
});

test('dashboard stays outside [locale] while public locale Home remains ungated', () => {
  assert.ok(fs.existsSync(src('app', 'dashboard', 'page.tsx')));
  assert.equal(fs.existsSync(src('app', '[locale]', 'dashboard', 'page.tsx')), false);
  assert.ok(fs.existsSync(src('app', '[locale]', 'page.tsx')));
  const proxy = read(src('proxy.ts'));
  // Public locale routes still go through next-intl, not the auth redirect path alone
  assert.match(proxy, /intlMiddleware/);
});

test('report detail lives under /dashboard/reports so proxy matcher covers it', () => {
  const detailPath = src('app', 'dashboard', 'reports', '[reportId]', 'page.tsx');
  assert.ok(fs.existsSync(detailPath), 'detail must live under /dashboard/reports/[reportId]');
  const detail = read(detailPath);
  assert.match(detail, /loadOfficerReportDetail/);
  assert.match(detail, /requireOfficerSession/);
  assert.doesNotMatch(detail, /officerFetch/);

  const reportCard = read(src('components', 'dashboard', 'ReportCard.tsx'));
  assert.match(reportCard, /\/dashboard\/reports\/\$\{|`\/dashboard\/reports\//);

  // Legacy public-ish officer detail must redirect into the gated path
  const legacyPath = src('app', 'reports', '[reportId]', 'page.tsx');
  assert.ok(fs.existsSync(legacyPath), 'legacy /reports/[reportId] redirect page must exist');
  const legacy = read(legacyPath);
  assert.match(legacy, /redirect\s*\(/);
  assert.match(legacy, /\/dashboard\/reports\//);
  assert.doesNotMatch(legacy, /officerFetch|StatusActions|DataTable/);
});
