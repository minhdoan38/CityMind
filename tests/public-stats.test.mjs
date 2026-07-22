import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('PublicStatsStrip loads stats from Postgres-backed server module', () => {
  const stripPath = path.resolve(root, 'src/components/analytics/PublicStatsStrip.tsx');
  assert.ok(fs.existsSync(stripPath), 'PublicStatsStrip must exist');
  const strip = fs.readFileSync(stripPath, 'utf8');
  assert.ok(
    strip.includes('loadPublicStats'),
    'PublicStatsStrip must load public stats from server module',
  );
});

test('Home page inserts PublicStatsStrip after instructions before contact', () => {
  const page = fs.readFileSync(
    path.resolve(root, 'src/app/[locale]/page.tsx'),
    'utf8',
  );
  assert.ok(page.includes('PublicStatsStrip'), 'Home must render PublicStatsStrip');
  const instructionsIdx = page.indexOf('id="instructions"');
  const contactIdx = page.indexOf('id="contact"');
  const stripIdx = page.indexOf('<PublicStatsStrip');
  assert.ok(instructionsIdx >= 0, 'instructions section required');
  assert.ok(contactIdx > instructionsIdx, 'contact must follow instructions');
  assert.ok(
    stripIdx > instructionsIdx && stripIdx < contactIdx,
    'PublicStatsStrip must sit after instructions and before contact (D-11)',
  );
});

test('BFF GET /api/public/stats delegates to local Postgres handler', () => {
  const routePath = path.resolve(root, 'src/app/api/public/stats/route.ts');
  assert.ok(fs.existsSync(routePath), 'public stats BFF route must exist');
  const route = fs.readFileSync(routePath, 'utf8');
  assert.ok(route.includes('GET'), 'BFF must export GET handler');
  assert.ok(
    route.includes('handlePublicStatsRequest'),
    'BFF must delegate to local public stats handler',
  );
  assert.ok(
    !route.includes('backendEndpoint'),
    'BFF must not proxy to FastAPI for public stats',
  );
});

test('message catalogs include public.stats keys EN/VI', () => {
  const required = [
    'sectionTitle',
    'sectionBody',
    'totalLabel',
    'categoriesLabel',
    'unavailable',
  ];
  for (const locale of ['en', 'vi']) {
    const messages = JSON.parse(
      fs.readFileSync(path.resolve(root, `messages/${locale}.json`), 'utf8'),
    );
    for (const key of required) {
      assert.ok(
        messages.public?.stats?.[key],
        `${locale} public.stats.${key} required`,
      );
    }
  }
});
