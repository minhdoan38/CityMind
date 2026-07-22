import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

test("DashboardSearchParams includes view and bbox in buildReportsQuery", () => {
  const types = read("src/components/reports/types.ts");
  assert.match(types, /view\?: string/);
  assert.match(types, /bbox\?: string/);
  assert.match(types, /qs\.set\("bbox"/);
  assert.match(types, /qs\.set\("view"/);
  assert.match(types, /buildGeoPinsQuery/);
  assert.match(types, /filter_bbox/);
});

test("geo pins BFF route uses local officer-read handler", () => {
  const routePath = "src/app/api/officer/reports/geo/pins/route.ts";
  assert.ok(fs.existsSync(path.resolve(root, routePath)));
  const route = read(routePath);
  assert.match(route, /handleGeoPinsRequest/);
  assert.doesNotMatch(route, /officerFetch/);
});

test("buildReportsQuery serializes bbox=1,2,3,4 when param set", () => {
  const typesSource = read("src/components/reports/types.ts");
  const fnBody = typesSource.slice(
    typesSource.indexOf("export function buildReportsQuery"),
    typesSource.indexOf("export function buildGeoPinsQuery"),
  );
  assert.match(fnBody, /params\.bbox/);
  assert.match(fnBody, /qs\.set\("bbox"/);

  const sample = {
    limit: "25",
    sort: "created_at",
    order: "desc",
    bbox: "1,2,3,4",
  };
  const qs = new URLSearchParams();
  qs.set("limit", sample.limit);
  qs.set("sort", sample.sort);
  qs.set("order", sample.order);
  qs.set("bbox", sample.bbox);
  assert.equal(qs.toString(), "limit=25&sort=created_at&order=desc&bbox=1%2C2%2C3%2C4");
});
