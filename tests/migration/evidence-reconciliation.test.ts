import { describe, expect, it } from "vitest";

import {
  formatEvidencePath,
  parseEvidencePath,
  resolveEvidenceLocation,
} from "@/server/services/evidence-service";

describe("evidence path dual-read", () => {
  it("prefers evidence_path over legacy supabase URI", () => {
    expect(
      resolveEvidenceLocation({
        evidencePath: "evidence/reports/r1/evidence.jpg",
        legacyUri: "supabase://evidence/reports/r1/legacy.jpg",
      }),
    ).toEqual({
      bucket: "evidence",
      objectPath: "reports/r1/evidence.jpg",
    });
  });

  it("falls back to legacy supabase URI when evidence_path is absent", () => {
    expect(
      resolveEvidenceLocation({
        evidencePath: null,
        legacyUri: "supabase://evidence/reports/r1/evidence.jpg",
      }),
    ).toEqual({
      bucket: "evidence",
      objectPath: "reports/r1/evidence.jpg",
    });
  });

  it("returns null for unsupported legacy schemes", () => {
    expect(
      resolveEvidenceLocation({
        evidencePath: null,
        legacyUri: "gs://bucket/object.jpg",
      }),
    ).toBeNull();
  });

  it("formats and parses bucket/object paths", () => {
    const path = formatEvidencePath("evidence", "reports/r1/evidence.webp");
    expect(parseEvidencePath(path)).toEqual({
      bucket: "evidence",
      objectPath: "reports/r1/evidence.webp",
    });
  });
});
