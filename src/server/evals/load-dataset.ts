import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

import { EvalCaseSchema, type EvalCase } from "./types";

export type DatasetLoadError = {
  line: number;
  message: string;
};

export type DatasetLoadResult =
  | { ok: true; cases: EvalCase[] }
  | { ok: false; errors: DatasetLoadError[] };

export async function loadDataset(filePath: string): Promise<DatasetLoadResult> {
  const cases: EvalCase[] = [];
  const errors: DatasetLoadError[] = [];
  let lineNumber = 0;

  const stream = createReadStream(filePath, { encoding: "utf8" });
  const rl = createInterface({ input: stream, crlfDelay: Infinity });

  for await (const line of rl) {
    lineNumber += 1;
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      errors.push({ line: lineNumber, message: "Invalid JSON on line" });
      continue;
    }

    const result = EvalCaseSchema.safeParse(parsed);
    if (!result.success) {
      errors.push({
        line: lineNumber,
        message: result.error.issues.map((issue) => issue.message).join("; "),
      });
      continue;
    }

    cases.push(result.data);
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, cases };
}
