import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

test("report detail loading.tsx exists with section-block skeleton contract", () => {
  const loadingPath = "src/app/dashboard/reports/[reportId]/loading.tsx";
  assert.ok(
    fs.existsSync(path.resolve(root, loadingPath)),
    "detail loading.tsx must exist",
  );
  const src = read(loadingPath);
  assert.match(src, /export default function/);
  assert.match(src, /@\/components\/ui\/skeleton/);
  assert.match(src, /Skeleton/);
  const sectionMatches = src.match(/rounded-lg border border-border p-6/g) ?? [];
  assert.ok(
    sectionMatches.length >= 5,
    `expected >=5 section-block skeleton regions, got ${sectionMatches.length}`,
  );
  assert.match(src, /max-w-4xl mx-auto/);
});
