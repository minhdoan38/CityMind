import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), 'utf8');
}

test('export BFF route exists and streams with officer auth', () => {
  const routePath = 'src/app/api/officer/reports/export/route.ts';
  assert.ok(fs.existsSync(path.resolve(root, routePath)), 'export/route.ts must exist');
  const src = read(routePath);
  assert.ok(src.includes('handleReportsExportRequest'), 'export route must use local handler');
  assert.doesNotMatch(src, /officerFetch/);
  assert.ok(
    !src.includes('.json()'),
    'export route must not parse body as JSON',
  );
});

test('ExportButton offers CSV and Excel with format markers', () => {
  const buttonPath = 'src/components/reports/ExportButton.tsx';
  assert.ok(fs.existsSync(path.resolve(root, buttonPath)), 'ExportButton.tsx must exist');
  const src = read(buttonPath);
  assert.ok(
    /format=csv|format=.?csv|"csv"/.test(src),
    'ExportButton must reference format=csv',
  );
  assert.ok(
    /format=xlsx|format=.?xlsx|"xlsx"/.test(src),
    'ExportButton must reference format=xlsx',
  );
  assert.ok(
    /Preparing export|exportPreparing|preparing/i.test(src),
    'ExportButton must show preparing state',
  );
  assert.ok(
    /Alert|exportFailed|export failed/i.test(src),
    'ExportButton must surface failure Alert',
  );
  assert.ok(
    src.includes('/api/officer/reports/export'),
    'ExportButton must call BFF export route',
  );
});

test('dashboard wires ExportButton and sidebar focus=export', () => {
  const page = read('src/app/dashboard/page.tsx');
  assert.ok(page.includes('ExportButton'), 'dashboard must render ExportButton');

  const sidebar = read('src/components/DashboardSidebar.tsx');
  assert.ok(
    sidebar.includes('focus=export'),
    'DashboardSidebar Export url must contain focus=export',
  );
  assert.ok(
    !/url:\s*['"]#['"]/.test(sidebar) || sidebar.includes('/dashboard?focus=export'),
    'Export nav must not remain a dead hash',
  );
});

test('EN/VI catalogs include export copy from UI-SPEC', () => {
  const en = JSON.parse(read('messages/en.json'));
  const vi = JSON.parse(read('messages/vi.json'));
  assert.equal(en.dashboard.exportReports, 'Export reports');
  assert.equal(vi.dashboard.exportReports, 'Xuất báo cáo');
  assert.equal(en.dashboard.exportCsv, 'Download CSV');
  assert.equal(vi.dashboard.exportCsv, 'Tải CSV');
  assert.equal(en.dashboard.exportExcel, 'Download Excel');
  assert.equal(vi.dashboard.exportExcel, 'Tải Excel');
  assert.equal(en.dashboard.exportPreparing, 'Preparing export…');
  assert.equal(vi.dashboard.exportPreparing, 'Đang chuẩn bị tệp xuất…');
  assert.equal(
    en.dashboard.exportFailed,
    'Could not export reports. Check your connection and try again.',
  );
  assert.equal(
    vi.dashboard.exportFailed,
    'Không thể xuất báo cáo. Kiểm tra kết nối và thử lại.',
  );
});
