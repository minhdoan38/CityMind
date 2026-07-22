import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('dashboard files and layout exist', () => {
  assert.ok(fs.existsSync(path.resolve('src/app/dashboard/layout.tsx')), 'layout.tsx must exist');
  assert.ok(fs.existsSync(path.resolve('src/app/dashboard/page.tsx')), 'page.tsx must exist');
  assert.ok(fs.existsSync(path.resolve('src/app/dashboard/reports/[reportId]/page.tsx')), 'detail page must exist');
});

test('sidebar primitives and components exist', () => {
  assert.ok(fs.existsSync(path.resolve('src/components/ui/sidebar.tsx')), 'sidebar primitive must exist');
  assert.ok(fs.existsSync(path.resolve('src/components/ui/sheet.tsx')), 'sheet primitive must exist');
  assert.ok(fs.existsSync(path.resolve('src/components/ui/tooltip.tsx')), 'tooltip primitive must exist');
  assert.ok(fs.existsSync(path.resolve('src/components/ui/skeleton.tsx')), 'skeleton primitive must exist');
  assert.ok(fs.existsSync(path.resolve('src/components/DashboardSidebar.tsx')), 'DashboardSidebar component must exist');
  assert.ok(fs.existsSync(path.resolve('src/hooks/use-mobile.ts')), 'use-mobile hook must exist');
});

test('dashboard components import correctly', () => {
  const layoutContent = fs.readFileSync(path.resolve('src/app/dashboard/layout.tsx'), 'utf8');
  assert.ok(layoutContent.includes('requireOfficerSession'), 'layout must import requireOfficerSession');
  assert.ok(layoutContent.includes('DashboardSidebar'), 'layout must import DashboardSidebar');

  const sidebarContent = fs.readFileSync(path.resolve('src/components/DashboardSidebar.tsx'), 'utf8');
  assert.ok(sidebarContent.includes('Export'), 'sidebar must contain Export menu option');
  assert.ok(sidebarContent.includes('Settings'), 'sidebar must contain Settings menu option');
  assert.ok(sidebarContent.includes('Sign out of the officer dashboard?'), 'sidebar must contain logout warning string');
});
