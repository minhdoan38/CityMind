import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

test("dashboard list loading.tsx exists with table skeleton contract", () => {
  const loadingPath = "src/app/dashboard/loading.tsx";
  assert.ok(
    fs.existsSync(path.resolve(root, loadingPath)),
    "dashboard/loading.tsx must exist",
  );
  const src = read(loadingPath);
  assert.match(src, /export default function/);
  assert.match(src, /@\/components\/ui\/skeleton/);
  assert.match(src, /Skeleton/);
  assert.match(
    src,
    /Array\.from\(\{\s*length:\s*(8|9|10)\s*\}\)|length:\s*9/,
    "must render 8-10 table row skeletons",
  );
  assert.match(src, /surface-card/);
});
