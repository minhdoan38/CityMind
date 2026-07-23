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

test('ReportsTable supports accessible persistent column resizing', () => {
  const src = read('src/components/reports/ReportsTable.tsx');
  assert.ok(src.includes('columnResizeMode: "onChange"'));
  assert.ok(src.includes('resizeColumnByKeyboard'));
  assert.ok(src.includes('role="separator"'));
  assert.ok(src.includes('aria-orientation="vertical"'));
  assert.ok(src.includes('citymind.dashboard.columnSizing'));
  assert.ok(src.includes('header.column.resetSize()'));
  assert.ok(src.includes('overflow-x-auto'));
});

test('ReportsTable renders routing destination column', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('RoutingDestinationBadge'), 'ReportsTable must render RoutingDestinationBadge');
  assert.ok(src.includes('routing_destination'), 'ReportsTable must include routing_destination column');
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
    page.includes("loadDashboardBundle"),
    "dashboard must load recent/summary via officer-dashboard service",
  );
  assert.ok(
    /searchParams|next_cursor|cursor/.test(page),
    'dashboard must sync cursor/filters via searchParams',
  );
  assert.ok(
    page.includes('ExportButton'),
    'dashboard must include ExportButton (Plan 03-04)',
  );
});

test('ReportsTable includes routing destination badge column', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('RoutingDestinationBadge'), 'ReportsTable must render RoutingDestinationBadge');
  assert.ok(
    src.includes('routing_destination'),
    'ReportsTable must include routing_destination column',
  );
  assert.ok(src.includes('dashboard.routing'), 'ReportsTable must use dashboard.routing column header');
  const en = JSON.parse(read('messages/en.json'));
  assert.equal(typeof en.dashboard.routing.badgeSelfHelp, 'string');
  assert.equal(typeof en.dashboard.routing.badgeGovernment, 'string');
});

test('ReportsTable renders shadow mismatch badge column', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('ShadowMismatchBadge'), 'ReportsTable must render ShadowMismatchBadge');
  assert.ok(
    src.includes('has_shadow_disagreement'),
    'ReportsTable must include has_shadow_disagreement column',
  );
  const badge = read('src/components/reports/ShadowMismatchBadge.tsx');
  assert.ok(
    badge.includes('Shadow mismatch'),
    'ShadowMismatchBadge must expose Shadow mismatch label',
  );
});

test('ReportsFilters includes shadow disagreement chip', () => {
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    filters.includes('shadow_disagreement'),
    'ReportsFilters must support shadow_disagreement param',
  );
  assert.ok(
    filters.includes('filterShadowDisagreement'),
    'ReportsFilters must use filterShadowDisagreement i18n key',
  );
});

test('ReportsFilters uses saved-view chips in toolbar layout', () => {
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    filters.includes('reports-saved-view-chip'),
    'ReportsFilters must use saved-view chips for triage and routing',
  );
  assert.ok(
    filters.includes('savedViewsLabel'),
    'ReportsFilters must label saved view chip row for accessibility',
  );
});

test('ReportsFilters renders removable active filter summary chips', () => {
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    filters.includes('ReportsActiveFilterChips'),
    'ReportsFilters must render active filter summary chips',
  );
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/reports/ReportsActiveFilterChips.tsx')),
    'ReportsActiveFilterChips.tsx must exist',
  );
});

test('ReportsFilters disables clear until filters are active', () => {
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    filters.includes('clearFiltersWithCount'),
    'ReportsFilters must show active filter count on clear button',
  );
  assert.ok(
    filters.includes('disabled={pending || !filtersActive}'),
    'ReportsFilters must disable clear when no filters are active',
  );
});

test('ReportsFilters uses severity preset chips instead of min/max selects', () => {
  const filters = read('src/components/reports/ReportsFilters.tsx');
  assert.ok(
    filters.includes('SEVERITY_FILTER_CHIPS'),
    'ReportsFilters must use severity preset chips',
  );
  assert.ok(
    filters.includes('filterSeverityHighPlus'),
    'ReportsFilters must expose 4+ severity preset for triage',
  );
  assert.ok(
    !filters.includes('filterMinSeverity'),
    'ReportsFilters must not use separate min severity select',
  );
  assert.ok(
    !filters.includes('filterMaxSeverity'),
    'ReportsFilters must not use separate max severity select',
  );
});

test('dashboard navbar includes AI health chip', () => {
  const navbar = read('src/components/dashboard/DashboardNavbar.tsx');
  assert.ok(navbar.includes('AiHealthChip'), 'dashboard navbar must render AiHealthChip');
});

test('ReportsTable includes quick preview sheet and context menu', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('ReportQuickPreviewSheet'), 'ReportsTable must render ReportQuickPreviewSheet');
  assert.ok(src.includes('ReportRowContextMenu'), 'ReportsTable must wrap rows with ReportRowContextMenu');
  assert.ok(src.includes('openPreview'), 'ReportsTable must open preview on row click');
  assert.ok(!src.includes('function openRow'), 'ReportsTable must not navigate directly on row click');
  assert.ok(!src.includes('role="button"'), 'ReportsTable rows must not use nested button role');
  assert.ok(src.includes('TriageOutcomeAnnouncer'), 'ReportsTable must announce triage outcomes');
  assert.ok(src.includes('deferLoad'), 'ReportsTable must defer thumbnail loading');
  assert.ok(src.includes('onReportDeleted'), 'ReportsTable must handle deleted report cleanup');
});

test('dashboard row context menu supports hard delete', () => {
  const menuPath = 'src/components/reports/ReportRowContextMenu.tsx';
  const routePath = 'src/app/api/officer/reports/[reportId]/route.ts';
  const menu = read(menuPath);
  const route = read(routePath);
  assert.ok(menu.includes('contextDeleteConfirmTitle'), 'context menu must open delete confirmation');
  assert.ok(!menu.includes('contextDeleteDisabled'), 'delete must not be audit-disabled');
  assert.ok(menu.includes('method: "DELETE"') || menu.includes("method: 'DELETE'"), 'context menu must call DELETE API');
  assert.match(route, /export async function DELETE/);
  assert.ok(route.includes('handleDeleteReportRequest'), 'delete route must delegate to officer-write');
});

test('ReportsTable includes triage dispatch actions and bulk retry', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('TriageDispatchActions'), 'ReportsTable must render TriageDispatchActions');
  assert.ok(src.includes('rowSelection'), 'ReportsTable must support row selection');
  assert.ok(src.includes('triage/bulk'), 'ReportsTable must call bulk triage API');
  const en = JSON.parse(read('messages/en.json'));
  assert.equal(typeof en.dashboard.aiHealth.up, 'string');
  assert.equal(typeof en.dashboard.triage.runNow, 'string');
  assert.equal(typeof en.dashboard.triage.bulkRetry, 'string');
});

test('ReportsTable includes urgency surfaces and operational columns', () => {
  const tablePath = 'src/components/reports/ReportsTable.tsx';
  const src = read(tablePath);
  assert.ok(src.includes('ReportSeverityBadge'), 'ReportsTable must render severity badge column');
  assert.ok(src.includes('ReportAgeSla'), 'ReportsTable must render age/SLA column');
  assert.ok(src.includes('ReportConfidenceChip'), 'ReportsTable must render confidence column');
  assert.ok(src.includes('ReportRowQuickActions'), 'ReportsTable must render quick actions');
  assert.ok(src.includes('reports-table-row--selected'), 'ReportsTable must style selected rows');
  assert.ok(src.includes('reports-table-row--urgent'), 'ReportsTable must tint urgent rows');
  const en = JSON.parse(read('messages/en.json'));
  assert.equal(typeof en.dashboard.colAgeSla, 'string');
  assert.equal(typeof en.dashboard.colConfidence, 'string');
  assert.equal(typeof en.dashboard.slaOverdueShort, 'string');
});

test('report row urgency helpers exist', () => {
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/lib/report-row-urgency.ts')),
    'report-row-urgency.ts must exist',
  );
  assert.ok(
    fs.existsSync(path.resolve(root, 'src/components/reports/ReportUrgencyCells.tsx')),
    'ReportUrgencyCells.tsx must exist',
  );
});

test('Dashboard insights rail uses operations snapshot widget', () => {
  const rail = read('src/components/dashboard/DashboardInsightsRail.tsx');
  assert.ok(
    rail.includes('OperationsInsightsWidget'),
    'DashboardInsightsRail must render OperationsInsightsWidget',
  );
  assert.ok(
    !rail.includes('BusiestDayWidget'),
    'DashboardInsightsRail must not render BusiestDayWidget',
  );
  const en = JSON.parse(read('messages/en.json'));
  assert.equal(typeof en.dashboard.widgets.insightsTitle, 'string');
  assert.equal(typeof en.dashboard.widgets.insightsTabTrend, 'string');
});

test('EN/VI catalogs include list filter and empty/error copy', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  assert.equal(en.dashboard.clearFilters, 'Clear filters');
  assert.equal(en.dashboard.clearFiltersWithCount, 'Clear filters ({count})');
  assert.equal(vi.dashboard.clearFilters, 'Xóa bộ lọc');
  assert.equal(vi.dashboard.clearFiltersWithCount, 'Xóa bộ lọc ({count})');
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
