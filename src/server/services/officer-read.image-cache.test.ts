import { describe, expect, it } from "vitest";

import { evidenceImageETag } from "@/server/services/officer-read";

describe("evidenceImageETag", () => {
  it("returns a stable quoted etag for the same evidence path", () => {
    const path = "evidence/reports/demo-1/evidence.jpg";
    expect(evidenceImageETag(path)).toBe(evidenceImageETag(path));
    expect(evidenceImageETag(path)).toMatch(/^"[a-f0-9]{16}"$/);
  });

  it("changes when the evidence path changes", () => {
    expect(evidenceImageETag("a/b.jpg")).not.toBe(evidenceImageETag("a/c.jpg"));
  });
});
