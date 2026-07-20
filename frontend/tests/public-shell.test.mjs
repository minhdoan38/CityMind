import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');
const src = (...parts) => path.join(root, 'src', ...parts);
const read = (filePath) => fs.readFileSync(filePath, 'utf8');

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

test('proxy.ts is locale-only next-intl seam (D-17 / Plan 02-03 auth later)', () => {
  const proxy = read(src('proxy.ts'));
  assert.match(proxy, /createMiddleware/);
  assert.match(proxy, /from ['"]next-intl\/middleware['"]/);
  assert.match(proxy, /intlMiddleware/);
  // Must not gate public Home/report in this plan
  assert.doesNotMatch(proxy, /getClaims|getSession|getUser/);
  assert.doesNotMatch(
    proxy,
    /pathname\.startsWith\(['"]\/(en|vi)['"]\).*redirect/s
  );
  // login + dashboard bypass intl so they stay outside [locale]
  assert.match(proxy, /startsWith\(['"]\/login['"]\)/);
  assert.match(proxy, /startsWith\(['"]\/dashboard['"]\)/);
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
