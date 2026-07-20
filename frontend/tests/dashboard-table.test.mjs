import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), 'utf8');
}

test('tanstack table dependency is pinned', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(
    pkg.dependencies?.['@tanstack/react-table'],
    '@tanstack/react-table must be in package.json dependencies',
  );
});

test('shadcn table/filter primitives exist', () => {
  for (const file of [
    'src/components/ui/table.tsx',
    'src/components/ui/checkbox.tsx',
    'src/components/ui/select.tsx',
    'src/components/ui/popover.tsx',
    'src/components/ui/collapsible.tsx',
  ]) {
    assert.ok(fs.existsSync(path.resolve(root, file)), `${file} must exist`);
  }
});

test('ReportsTable uses manual pagination and column visibility persistence', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  assert.ok(fs.existsSync(path.resolve(root, tablePath)), 'ReportsTable.tsx must exist');
  const src = read(tablePath);
  assert.ok(src.includes('manualPagination'), 'ReportsTable must use manualPagination');
  assert.ok(src.includes('manualSorting'), 'ReportsTable must use manualSorting');
  assert.ok(
    src.includes('citymind.dashboard.columnVisibility'),
    'ReportsTable must persist column visibility under citymind.dashboard.columnVisibility',
  );
  assert.ok(
    src.includes('severity') && /columnVisibility[\s\S]*severity\s*:\s*false|severity\s*:\s*false/.test(src),
    'severity column must be hidden by default',
  );
});

test('ReportsFilters and ReportsMetrics components exist', () => {
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/reports/ReportsFilters.tsx')),
    'ReportsFilters.tsx must exist',
  );
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/reports/ReportsMetrics.tsx')),
    'ReportsMetrics.tsx must exist',
  );
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    /Collapsible|collapsible/.test(filters),
    'ReportsFilters must use collapsible panel',
  );
  assert.ok(
    /status|category|priority|severity|created_after|created_before/i.test(filters),
    'ReportsFilters must cover status/category/priority/severity/date filters',
  );
});

test('dashboard page uses table chrome instead of ReportCard grid', () => {
  const page = read('src/app/dashboard/page.tsx');
  assert.ok(!page.includes('ReportCard'), 'dashboard page must not import ReportCard');
  assert.ok(page.includes('ReportsTable'), 'dashboard page must render ReportsTable');
  assert.ok(page.includes('ReportsFilters'), 'dashboard page must render ReportsFilters');
  assert.ok(page.includes('ReportsMetrics'), 'dashboard page must render ReportsMetrics');
  assert.ok(
    page.includes('/api/v1/reports/recent') && page.includes('/api/v1/reports/summary'),
    'dashboard must fetch /recent and /summary',
  );
  assert.ok(
    /searchParams|next_cursor|cursor/.test(page),
    'dashboard must sync cursor/filters via searchParams',
  );
  assert.ok(!/ExportButton|export reports/i.test(page) || !page.includes('ExportButton'),
    'ExportButton is Plan 03-04 — must not ship in 03-02');
});

test('EN/VI catalogs include list filter and empty/error copy', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  assert.equal(en.dashboard.clearFilters, 'Clear filters');
  assert.equal(vi.dashboard.clearFilters, 'Xóa bộ lọc');
  assert.ok(en.dashboard.pageTitle || en.dashboard.reportsTitle || en.dashboard.title);
  const enEmptyFiltered =
    en.empty.filteredHeading ||
    en.empty.noReportsMatch ||
    en.dashboard.emptyFilteredHeading ||
    en.empty.noMatch;
  const viEmptyFiltered =
    vi.empty.filteredHeading ||
    vi.empty.noReportsMatch ||
    vi.dashboard.emptyFilteredHeading ||
    vi.empty.noMatch;
  assert.ok(enEmptyFiltered, 'EN empty filtered copy required');
  assert.ok(viEmptyFiltered, 'VI empty filtered copy required');
  assert.ok(
    (en.error.loadFailed || en.dashboard.errorLoad) &&
      (vi.error.loadFailed || vi.dashboard.errorLoad),
    'error load copy required in both locales',
  );
});
