import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const messagesDir = path.resolve('messages');

test('catalog parity check', () => {
  const en = JSON.parse(fs.readFileSync(path.join(messagesDir, 'en.json'), 'utf8'));
  const vi = JSON.parse(fs.readFileSync(path.join(messagesDir, 'vi.json'), 'utf8'));

  const walk = (o) =>
    Object.entries(o).flatMap(([k, v]) =>
      v && typeof v === 'object' ? walk(v).map((x) => `${k}.${x}`) : [k]
    ).sort();

  const enKeys = walk(en);
  const viKeys = walk(vi);

  assert.deepStrictEqual(enKeys, viKeys, 'EN and VI translation catalogs must have identical keys');
});

test('locale switcher file exists', () => {
  assert.ok(fs.existsSync(path.resolve('src/components/LocaleSwitcher.tsx')));
});

test('middleware exists and secures reports path', () => {
  assert.ok(fs.existsSync(path.resolve('src/proxy.ts')));
});
