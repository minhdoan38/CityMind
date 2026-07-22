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

test('routing uses en/vi with localePrefix always (D-13)', () => {
  const routing = read(src('i18n', 'routing.ts'));
  assert.match(routing, /locales:\s*\[\s*["']en["']\s*,\s*["']vi["']\s*\]/);
  assert.match(routing, /defaultLocale:\s*["']en["']/);
  assert.match(routing, /localePrefix:\s*["']always["']/);
  assert.doesNotMatch(routing, /localePrefix:\s*["']never["']/);
  assert.doesNotMatch(routing, /localeDetection:\s*false/);
});

test('createNavigation helpers are exported for prefixed Link/router', () => {
  const navigation = read(src('i18n', 'navigation.ts'));
  assert.match(navigation, /createNavigation/);
  assert.match(navigation, /\bLink\b/);
  assert.match(navigation, /\bredirect\b/);
  assert.match(navigation, /\busePathname\b/);
  assert.match(navigation, /\buseRouter\b/);
});

test('request config resolves locale from requestLocale segment', () => {
  const request = read(src('i18n', 'request.ts'));
  assert.match(request, /requestLocale/);
  assert.match(request, /getRequestConfig/);
  assert.doesNotMatch(request, /getUserLocale/);
});

test('proxy.ts composes next-intl with dashboard getClaims gate (D-17 / AUTH-04)', () => {
  const proxy = read(src('proxy.ts'));
  assert.match(proxy, /createMiddleware/);
  assert.match(proxy, /from ['"]next-intl\/middleware['"]/);
  assert.match(proxy, /intlMiddleware/);
  assert.match(proxy, /\.auth\.getClaims\s*\(/);
  assert.match(proxy, /startsWith\(['"]\/login['"]\)/);
  assert.match(proxy, /startsWith\(['"]\/dashboard['"]\)/);
  assert.match(proxy, /returnUrl/);
  // Public Home stays open — AUTH-04 path correction vs legacy root protection
  assert.doesNotMatch(proxy, /pathname\s*===\s*['"]\/['"]/);
  assert.doesNotMatch(proxy, /getSession\s*\(/);
});

test('login and dashboard stay outside app/[locale]', () => {
  assert.ok(fs.existsSync(src('app', 'login', 'page.tsx')));
  assert.ok(fs.existsSync(src('app', 'dashboard', 'page.tsx')));
  assert.equal(fs.existsSync(src('app', '[locale]', 'login', 'page.tsx')), false);
  assert.equal(fs.existsSync(src('app', '[locale]', 'dashboard', 'page.tsx')), false);
});

test('LocaleSwitcher uses createNavigation pathname/router', () => {
  const switcher = read(src('components', 'LocaleSwitcher.tsx'));
  assert.match(switcher, /@\/i18n\/navigation/);
  assert.match(switcher, /usePathname|useRouter/);
  assert.doesNotMatch(switcher, /setUserLocale/);
});

test('EN/VI catalogs share identical key trees', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const vi = JSON.parse(read(path.join(messagesDir, 'vi.json')));
  assert.deepEqual(walkKeys(en), walkKeys(vi));
});

test('Home catalogs include UI-SPEC public copy keys (PUB-01/02/06)', () => {
  const en = JSON.parse(read(path.join(messagesDir, 'en.json')));
  const required = [
    'reportCTA',
    'heroAdvisory',
    'howItWorksTitle',
    'instructionsTitle',
    'step1Title',
    'step2Title',
    'step3Title',
    'step4Title',
    'step5Title',
    'aboutTitle',
    'contactTitle',
    'contactFormSoon',
    'officerSignIn',
  ];
  for (const key of required) {
    assert.equal(typeof en.public[key], 'string', `missing public.${key}`);
    assert.ok(en.public[key].length > 0, `empty public.${key}`);
  }
  assert.equal(en.public.reportCTA, 'Report an issue');
  assert.equal(
    en.public.heroAdvisory,
    'AI helps organize reports. Officers review and decide.'
  );
  assert.equal(en.public.officerSignIn, 'Officer sign-in');
});

test('localized Home implements D-01–D-08 content contract', () => {
  const page = read(src('app', '[locale]', 'page.tsx'));
  assert.match(page, /href=["']\/report["']/);
  assert.match(page, /ReportStarterBar/);
  assert.ok(fs.existsSync(src('components', 'ReportStarterBar.tsx')));
  assert.match(page, /heroAdvisory|t\(["']heroAdvisory["']\)/);
  assert.match(page, /howItWorksTitle/);
  assert.match(page, /instructionsTitle/);
  assert.match(page, /aboutTitle/);
  assert.match(page, /contactTitle/);
  assert.match(page, /officerSignIn/);
  assert.match(page, /step5Title/);
  assert.match(page, /next\/image|Image from ["']next\/image["']/);
  // Officer sign-in must not use locale-prefixed Link (login is outside [locale])
  assert.match(page, /from ["']next\/link["']/);
  assert.match(page, /href=["']\/login["']/);

  // D-03: How it works → Instructions → About → Contact → Footer
  const howIdx = page.indexOf('id="how-it-works"');
  const instructionsIdx = page.indexOf('id="instructions"');
  const aboutIdx = page.indexOf('id="about"');
  const contactIdx = page.indexOf('id="contact"');
  const footerIdx = page.indexOf('<footer');
  assert.ok(howIdx > -1 && instructionsIdx > -1 && aboutIdx > -1 && contactIdx > -1 && footerIdx > -1);
  assert.ok(
    howIdx < instructionsIdx &&
      instructionsIdx < aboutIdx &&
      aboutIdx < contactIdx &&
      contactIdx < footerIdx,
    'Home section order must be how-it-works → instructions → about → contact → footer'
  );
});

test('unprefixed public pages redirect into locale prefixes', () => {
  const rootPage = read(src('app', 'page.tsx'));
  assert.match(rootPage, /redirect\(['"]\/en['"]\)/);
  const reportPage = read(src('app', 'report', 'page.tsx'));
  assert.match(reportPage, /redirect\(['"]\/en\/report['"]\)/);
});
