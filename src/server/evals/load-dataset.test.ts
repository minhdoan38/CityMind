import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { loadDataset } from "./load-dataset";

const tempDirs: string[] = [];

afterEach(async () => {
  tempDirs.length = 0;
});

async function writeJsonl(lines: string[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "eval-dataset-"));
  tempDirs.push(dir);
  const filePath = path.join(dir, "cases.jsonl");
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

describe("loadDataset", () => {
  it("loads valid JSONL cases", async () => {
    const filePath = await writeJsonl([
      JSON.stringify({
        case_id: "en-pothole-001",
        locale: "en",
        report_text: "Small pothole on a quiet residential street.",
        gold: {
          category: "pothole",
          severity: 2,
          priority: "low",
          is_critical: false,
        },
      }),
    ]);

    const result = await loadDataset(filePath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.cases).toHaveLength(1);
      expect(result.cases[0]?.case_id).toBe("en-pothole-001");
    }
  });

  it("rejects malformed JSONL with Zod safeParse errors", async () => {
    const filePath = await writeJsonl([
      JSON.stringify({ case_id: "bad", locale: "en" }),
      "not-json",
    ]);

    const result = await loadDataset(filePath);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    }
  });
});
