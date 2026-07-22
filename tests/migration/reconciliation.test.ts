import { describe, expect, it } from "vitest";

import {
  buildReconciliationManifest,
  canonicalRowHash,
  compareObjectInventories,
  compareRowSets,
  summarizeUriSchemes,
} from "../../scripts/lib/reconciliation.mjs";

describe("canonicalRowHash", () => {
  it("is stable regardless of key order", () => {
    const left = { report_id: "r1", category: "flooding", severity: 3 };
    const right = { severity: 3, report_id: "r1", category: "flooding" };
    expect(canonicalRowHash(left)).toBe(canonicalRowHash(right));
  });
});

describe("compareRowSets", () => {
  it("detects missing rows and hash mismatches", () => {
    const source = [{ report_id: "r1", category: "flooding" }];
    const target = [{ report_id: "r1", category: "traffic" }];
    const result = compareRowSets(source, target);
    expect(result.pass).toBe(false);
    expect(result.hashMismatches).toEqual(["r1"]);
  });

  it("passes when canonical rows match", () => {
    const rows = [{ report_id: "r1", category: "flooding" }];
    expect(compareRowSets(rows, rows).pass).toBe(true);
  });
});

describe("compareObjectInventories", () => {
  it("flags sha256 mismatches", () => {
    const source = [{ path: "evidence/reports/a.jpg", sha256: "abc", size_bytes: 10 }];
    const target = [{ path: "evidence/reports/a.jpg", sha256: "def", size_bytes: 10 }];
    const result = compareObjectInventories(source, target);
    expect(result.pass).toBe(false);
    expect(result.hashMismatches).toContain("evidence/reports/a.jpg");
  });
});

describe("summarizeUriSchemes", () => {
  it("counts null, supabase, and gs schemes", () => {
    expect(
      summarizeUriSchemes([
        { image_gcs_uri: null },
        { image_gcs_uri: "supabase://evidence/reports/a.jpg" },
        { image_gcs_uri: "gs://bucket/a.jpg" },
      ]),
    ).toEqual({ null: 1, supabase: 1, gs: 1, other: 0 });
  });
});

describe("buildReconciliationManifest", () => {
  it("returns PASS with zero unexplained differences", () => {
    const rows = [{ report_id: "r1", category: "flooding" }];
    const objects = [{ path: "evidence/reports/a.jpg", sha256: "abc", size_bytes: 1 }];
    const manifest = buildReconciliationManifest({
      sourceRows: rows,
      targetRows: rows,
      sourceObjects: objects,
      targetObjects: objects,
      signed: true,
      signer: "operator",
      signedAt: "2026-07-22T00:00:00Z",
      targetEvidencePathCount: 1,
      targetGsUriCount: 0,
    });
    expect(manifest.status).toBe("PASS");
    expect(manifest.unexplainedDifferences).toEqual([]);
  });
});
