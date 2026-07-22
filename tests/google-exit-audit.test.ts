import { describe, expect, it } from "vitest";

import {
  buildAuditReport,
  buildLegacyInventory,
  evaluateAuditStatus,
  filterFindingsForMode,
  scanDependencies,
  scanEnvExample,
  scanFileContent,
  validateSafetyEvidence,
} from "../scripts/lib/google-exit-audit.mjs";

describe("google-exit audit scanners", () => {
  it("flags forbidden backend bridge usage in active frontend", () => {
    const findings = scanFileContent(
      "src/lib/backend.ts",
      'export function backendEndpoint(path: string) { return path; }',
    );
    expect(findings.some((item) => item.id === "backend-bridge")).toBe(true);
  });

  it("allows Google Fonts only on the exact allowlist paths", () => {
    const allowedFonts = scanFileContent(
      "src/lib/fonts.ts",
      'import { Roboto } from "next/font/google";',
    );
    const allowedCss = scanFileContent(
      "src/app/globals.css",
      '@import url("https://fonts.googleapis.com/css2?family=Google+Sans&display=swap");',
    );
    const forbidden = scanFileContent(
      "src/components/Bad.tsx",
      'import { Roboto } from "next/font/google";',
    );

    expect(allowedFonts).toHaveLength(0);
    expect(allowedCss).toHaveLength(0);
    expect(forbidden.some((item) => item.id === "google-font-outside-allowlist")).toBe(
      true,
    );
  });

  it("does not false-positive FastAPI mentions in test descriptions", () => {
    const findings = scanFileContent(
      "src/server/services/report-service.test.ts",
      'it("rejects descriptions longer than the FastAPI-compatible limit", async () => {});',
    );
    expect(findings).toHaveLength(0);
  });

  it("flags gs:// and bigquery patterns in active frontend", () => {
    const findings = scanFileContent(
      "src/server/evidence.ts",
      'const uri = "gs://bucket/object";\nconst table = "bigquery.dataset";',
    );
    expect(findings.some((item) => item.id === "gcs-uri-scheme")).toBe(true);
    expect(findings.some((item) => item.id === "bigquery-runtime")).toBe(true);
  });

  it("does not false-positive on excluded golden fixtures", () => {
    const findings = scanFileContent(
      "tests/contracts/fastapi-golden/analytics.json",
      '"endpoint": "GET /api/v1/analytics"',
    );
    expect(findings).toHaveLength(0);
  });

  it("detects forbidden npm dependencies", () => {
    const findings = scanDependencies({
      dependencies: { "@google-cloud/storage": "1.0.0", react: "19.0.0" },
    });
    expect(findings).toHaveLength(1);
    expect(findings[0].name).toBe("@google-cloud/storage");
  });

  it("detects forbidden env key names without values", () => {
    const findings = scanEnvExample("BACKEND_API_URL=http://127.0.0.1:8000\nAI_MODEL=demo");
    expect(findings.some((item) => item.key === "BACKEND_API_URL")).toBe(true);
    expect(JSON.stringify(findings)).not.toContain("127.0.0.1");
  });
});

describe("google-exit safety evidence", () => {
  it("fails closed when restore evidence is missing", () => {
    const result = validateSafetyEvidence({
      sourceGate: {
        signed: true,
        status: "PASS",
        db_backup_hash: "abc",
        storage_backup_hash: "def",
        read_only_inventory: { reports: [{ report_id: "r1" }] },
      },
      reconciliation: { signed: true, status: "PASS" },
      restoreGate: { signed: false, status: "PENDING" },
    });
    expect(result.pass).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("builds deterministic pre-clean manifest with legacy inventory", () => {
    const report = buildAuditReport({
      mode: "pre-clean",
      findings: [{ id: "backend-bridge", path: "src/lib/backend.ts", line: 1 }],
      legacyInventory: buildLegacyInventory([
        "backend/app/main.py",
        "docker-compose.yml",
        "src/lib/backend.ts",
      ]),
      safetyEvidence: { pass: false, issues: ["restore gate missing"] },
    });
    expect(report.status).toBe("FAIL");
    expect(report.removalInventory.legacyTrack.length).toBeGreaterThan(0);
    expect(report.manifestHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("passes pre-clean when safety evidence and legacy inventory exist", () => {
    const status = evaluateAuditStatus({
      mode: "pre-clean",
      findings: [{ id: "backend-bridge", path: "src/lib/backend.ts", line: 1 }],
      legacyInventory: buildLegacyInventory(["backend/app/main.py"]),
      safetyEvidence: { pass: true, issues: [] },
    });
    expect(status).toBe("PASS");
  });

  it("fails post-runtime-cleanup when backend bridge remains", () => {
    const status = evaluateAuditStatus({
      mode: "post-runtime-cleanup",
      findings: [{ id: "backend-bridge", path: "src/lib/backend.ts", line: 1 }],
      legacyInventory: [],
      safetyEvidence: { pass: true, issues: [] },
    });
    expect(status).toBe("FAIL");
  });

  it("scopes docs mode to documentation paths only", () => {
    const findings = filterFindingsForMode("docs", [
      { id: "backend-bridge", path: "src/lib/backend.ts", line: 1 },
      { id: "fastapi-runtime", path: "README.md", line: 10 },
    ]);
    expect(findings).toHaveLength(1);
    expect(findings[0].path).toBe("README.md");
  });
});
