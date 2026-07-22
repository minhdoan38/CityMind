import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

test('analytics route and chart primitive exist', () => {
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/app/dashboard/analytics/page.tsx')),
    'analytics page must exist',
  );
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/ui/chart.tsx')),
    'shadcn chart primitive must exist',
  );
});

test('package.json lists recharts dependency', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.resolve(root, 'package.json'), 'utf8'),
  );
  assert.ok(pkg.dependencies?.recharts, 'recharts must be installed');
});

test('sidebar links Analytics after Reports', () => {
  const sidebar = fs.readFileSync(
    path.resolve(root, 'src/components/DashboardSidebar.tsx'),
    'utf8',
  );
  assert.ok(sidebar.includes('/dashboard/analytics'), 'sidebar must link to analytics');
  assert.ok(
    sidebar.includes('BarChart3') || sidebar.includes('analytics'),
    'sidebar must include Analytics nav item',
  );
  const reportsIdx = sidebar.indexOf('/dashboard');
  const analyticsIdx = sidebar.indexOf('/dashboard/analytics');
  assert.ok(reportsIdx >= 0 && analyticsIdx > reportsIdx, 'Analytics must follow Reports');
});

test('analytics page uses direct Postgres loader and URL date keys', () => {
  const page = fs.readFileSync(
    path.resolve(root, 'src/app/dashboard/analytics/page.tsx'),
    'utf8',
  );
  assert.ok(
    page.includes('loadOfficerAnalytics'),
    'analytics page must load analytics directly from Postgres modules',
  );
  assert.ok(page.includes('range'), 'analytics page must handle range searchParam');
  assert.ok(page.includes('from'), 'analytics page must handle from searchParam');
  assert.ok(page.includes('to'), 'analytics page must handle to searchParam');
});

test('DateRangeToolbar documents URL keys range|from|to', () => {
  const toolbar = fs.readFileSync(
    path.resolve(root, 'src/components/analytics/DateRangeToolbar.tsx'),
    'utf8',
  );
  assert.ok(toolbar.includes('range'), 'toolbar must sync range param');
  assert.ok(toolbar.includes('from'), 'toolbar must sync from param');
  assert.ok(toolbar.includes('to'), 'toolbar must sync to param');
});

test('chart components exist for volume, category, SLA, and hotspots', () => {
  for (const file of [
    'VolumeChart.tsx',
    'CategoryChart.tsx',
    'SlaChart.tsx',
    'HotspotTable.tsx',
  ]) {
    assert.ok(
      fs.existsSync(path.resolve(root, `src/components/analytics/${file}`)),
      `${file} must exist`,
    );
  }
});

test('message catalogs include dashboard.analytics keys', () => {
  for (const locale of ['en', 'vi']) {
    const messages = JSON.parse(
      fs.readFileSync(path.resolve(root, `messages/${locale}.json`), 'utf8'),
    );
    assert.ok(messages.dashboard?.analytics?.pageTitle, `${locale} analytics pageTitle required`);
    assert.ok(messages.dashboard?.analytics?.preset30, `${locale} analytics preset30 required`);
    assert.ok(messages.dashboard?.analytics?.freshnessNote, `${locale} analytics freshnessNote required`);
  }
});
