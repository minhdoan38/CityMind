import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(".");

function read(rel) {
  return fs.readFileSync(path.resolve(root, rel), "utf8");
}

const viewerPath = "src/components/dashboard/AgentConsoleViewer.tsx";
const sidebarPath = "src/components/DashboardSidebar.tsx";
const reportDetailPath = "src/app/dashboard/reports/[reportId]/page.tsx";
const pagePath = "src/app/dashboard/agent-console/page.tsx";

test("AgentConsoleViewer exists", () => {
  assert.ok(fs.existsSync(path.resolve(root, viewerPath)), `${viewerPath} must exist`);
});

test("AgentConsoleViewer fetches triage console API", () => {
  const src = read(viewerPath);
  assert.ok(
    src.includes('fetch(`/api/officer/triage-console'),
    "viewer must fetch /api/officer/triage-console",
  );
});

test("AgentConsoleViewer loads recent feed on mount without filter", () => {
  const src = read(viewerPath);
  assert.ok(src.includes("useEffect"), "viewer must use useEffect for mount load");
  assert.ok(
    src.includes("void load(initialReportId || undefined)"),
    "viewer must load on mount without requiring a filter",
  );
});

test("AgentConsoleViewer truncates raw output preview at 320 chars", () => {
  const src = read(viewerPath);
  assert.ok(src.includes("slice(0, 320)"), "viewer must preview raw output at 320 chars");
});

test("AgentConsoleViewer shows validation_errors warn block", () => {
  const src = read(viewerPath);
  assert.ok(src.includes("validation_errors"), "viewer must reference validation_errors");
  assert.ok(
    src.includes("agent-console-log-warn"),
    "viewer must render validation_errors in warn block",
  );
});

test("AgentConsoleViewer shows attempt metadata latency and disposition", () => {
  const src = read(viewerPath);
  assert.ok(src.includes("latency_ms"), "viewer must show attempt latency_ms");
  assert.ok(src.includes("attempt.disposition"), "viewer must show attempt disposition");
});

test("AgentConsoleViewer truncates case list report IDs", () => {
  const src = read(viewerPath);
  assert.ok(
    src.includes("report_id.slice(0, 8)"),
    "viewer must truncate report_id in case list",
  );
});

test("DashboardSidebar links to agent console", () => {
  const src = read(sidebarPath);
  assert.ok(
    src.includes("/dashboard/agent-console"),
    "sidebar must link to /dashboard/agent-console",
  );
});

test("Report detail deep-links to agent console with report_id", () => {
  const src = read(reportDetailPath);
  assert.ok(
    src.includes("/dashboard/agent-console?report_id="),
    "report detail must deep-link to agent console with report_id",
  );
});

test("Agent console page requires officer session", () => {
  const src = read(pagePath);
  assert.ok(
    src.includes("requireOfficerSession"),
    "agent console page must call requireOfficerSession",
  );
});

test("Agent console contract does not cross-contaminate assistant API", () => {
  const viewerSrc = read(viewerPath);
  assert.ok(
    !viewerSrc.includes("/api/officer/assistant/messages"),
    "viewer must not call assistant messages API",
  );
});

test("AgentConsoleViewer shows truncation notice when unfiltered", () => {
  const src = read(viewerPath);
  assert.ok(src.includes('t("truncationNotice")'), "viewer must render truncationNotice");
  assert.ok(src.includes('role="note"'), "truncation notice must use role=note");
});

test("AgentConsoleViewer uses split empty state copy", () => {
  const src = read(viewerPath);
  assert.ok(src.includes('t("emptyFiltered")'), "viewer must use emptyFiltered");
  assert.ok(src.includes('t("emptyRecent")'), "viewer must use emptyRecent");
});

test("AgentConsoleViewer supports keyboard case list navigation", () => {
  const src = read(viewerPath);
  assert.ok(
    src.includes("ArrowDown") || src.includes("ArrowUp"),
    "viewer must handle arrow keys for case list",
  );
});

test("Agent console i18n keys exist in EN and VI catalogs", () => {
  const en = JSON.parse(read("messages/en.json"));
  const vi = JSON.parse(read("messages/vi.json"));
  for (const key of ["truncationNotice", "emptyFiltered", "emptyRecent"]) {
    assert.ok(en.dashboard?.agentConsole?.[key], `en.json missing agentConsole.${key}`);
    assert.ok(vi.dashboard?.agentConsole?.[key], `vi.json missing agentConsole.${key}`);
  }
});
