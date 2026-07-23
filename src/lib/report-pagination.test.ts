import { describe, expect, it } from "vitest";

import {
  encodeTriageBucketCursor,
  parseTriageBucketOffset,
} from "@/lib/report-pagination";

describe("report-pagination", () => {
  it("round-trips triage bucket offset cursor", () => {
    const cursor = encodeTriageBucketCursor(3, "asc", "rep-a");
    expect(parseTriageBucketOffset(cursor)).toBe(3);
  });
});
