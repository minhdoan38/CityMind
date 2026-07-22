import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(...parts) {
  return fs.readFileSync(path.resolve(root, ...parts), "utf8");
}

test("ReportForm wires ReportLocationMiniMap below lat/lng fields", () => {
  const form = read("src", "components", "ReportForm.tsx");
  assert.match(form, /ReportLocationMiniMap/);
  assert.match(form, /useWatch/);
  assert.match(form, /form\.setValue\("latitude"/);
  const latIdx = form.indexOf('name="latitude"');
  const mapIdx = form.indexOf("<ReportLocationMiniMap");
  assert.ok(latIdx >= 0 && mapIdx > latIdx, "mini map must follow lat/lng grid");
});

test("ReportLocationMiniMap uses dynamic import with ssr:false", () => {
  const wrapper = read("src", "components", "ReportLocationMiniMap.tsx");
  assert.match(wrapper, /next\/dynamic/);
  assert.match(wrapper, /ssr:\s*false/);
  assert.match(wrapper, /ReportLocationMiniMapInner/);
  assert.match(wrapper, /public\.map/);
});

test("ReportLocationMiniMapInner uses MapLibre react bindings", () => {
  const inner = read("src", "components", "ReportLocationMiniMapInner.tsx");
  assert.match(inner, /react-map-gl\/maplibre/);
  assert.match(inner, /maplibre-gl\/dist\/maplibre-gl\.css/);
  assert.match(inner, /buildRasterMapStyle/);
  assert.match(inner, /toFixed\(6\)/);
});

test("message catalogs include public.map keys EN/VI", () => {
  const required = ["label", "helper", "loading", "degraded"];
  for (const locale of ["en", "vi"]) {
    const messages = JSON.parse(read("messages", `${locale}.json`));
    for (const key of required) {
      assert.ok(
        messages.public?.map?.[key],
        `${locale} public.map.${key} required`,
      );
    }
  }
});
