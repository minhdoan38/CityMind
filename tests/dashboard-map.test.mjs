import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

test("dashboard page branches on view=map and renders ReportsMapView", () => {
  const page = read("src/app/dashboard/page.tsx");
  assert.match(page, /ReportsMapViewLoader/);
  assert.match(page, /view === "map"|view=map/);
  assert.match(page, /ReportsViewToggle/);

  const loader = read("src/components/reports/ReportsMapViewLoader.tsx");
  assert.match(loader, /next\/dynamic/);
  assert.match(loader, /ssr:\s*false/);
});

test("ReportsMapView uses clustered MapLibre source and direct navigation", () => {
  const mapView = read("src/components/reports/ReportsMapView.tsx");
  assert.match(mapView, /react-map-gl\/maplibre/);
  assert.match(mapView, /cluster/);
  assert.match(mapView, /\/api\/officer\/reports\/geo\/pins/);
  assert.match(mapView, /\/dashboard\/reports\//);
  assert.match(mapView, /unlocated_count|unlocatedCount/);
});

test("dashboard.map i18n keys exist EN/VI", () => {
  const required = [
    "tableView",
    "mapView",
    "applyAreaFilter",
    "clearAreaFilter",
    "unlocatedCount",
    "listPanelToggle",
    "invalidBbox",
  ];
  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(read(`messages/${locale}.json`));
    for (const key of required) {
      assert.ok(
        messages.dashboard?.map?.[key],
        `${locale} dashboard.map.${key} required`,
      );
    }
  }
});
