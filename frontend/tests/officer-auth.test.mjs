import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('auth helpers exist and reference correct modules', () => {
  const authContent = fs.readFileSync(path.resolve('src/lib/auth.ts'), 'utf8');
  assert.ok(authContent.includes('getClaims'), 'auth.ts must define getClaims');
  assert.ok(authContent.includes('getSessionToken'), 'auth.ts must define getSessionToken');
  assert.ok(authContent.includes('requireOfficerSession'), 'auth.ts must define requireOfficerSession');
});

test('supabase client configs exist', () => {
  assert.ok(fs.existsSync(path.resolve('src/lib/supabase/client.ts')), 'client.ts must exist');
  assert.ok(fs.existsSync(path.resolve('src/lib/supabase/server.ts')), 'server.ts must exist');
});

test('api routes use getClaims for validation', () => {
  const statusRoute = fs.readFileSync(path.resolve('src/app/api/officer/reports/[reportId]/status/route.ts'), 'utf8');
  assert.ok(statusRoute.includes('getClaims'), 'status route must use getClaims');

  const imageRoute = fs.readFileSync(path.resolve('src/app/api/officer/reports/[reportId]/image/route.ts'), 'utf8');
  assert.ok(imageRoute.includes('getClaims'), 'image route must use getClaims');
});

test('backend fetch forwards bearer authorization', () => {
  const backendContent = fs.readFileSync(path.resolve('src/lib/backend.ts'), 'utf8');
  assert.ok(backendContent.includes('Authorization'), 'backend.ts must define Authorization headers');
  assert.ok(backendContent.includes('Bearer'), 'backend.ts must use Bearer schema');
});
