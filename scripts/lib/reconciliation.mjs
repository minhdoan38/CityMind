import crypto from "node:crypto";

export function stableStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(",")}}`;
}

export function sha256Hex(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function canonicalRowHash(row) {
  return sha256Hex(stableStringify(row));
}

export function normalizeReportRowForReconciliation(row) {
  return {
    report_id: row.report_id,
    created_at: row.created_at,
    category: row.category,
    current_status: row.current_status,
    evidence_path: row.evidence_path ?? null,
  };
}

export function summarizeUriSchemes(rows) {
  const counts = { null: 0, supabase: 0, gs: 0, other: 0 };
  for (const row of rows) {
    const uri =
      row.evidence_path != null && row.evidence_path !== ""
        ? `supabase://${row.evidence_path}`
        : row.image_gcs_uri ?? row.legacy_uri ?? null;
    if (!uri) {
      counts.null += 1;
    } else if (String(uri).startsWith("supabase://")) {
      counts.supabase += 1;
    } else if (String(uri).startsWith("gs://")) {
      counts.gs += 1;
    } else {
      counts.other += 1;
    }
  }
  return counts;
}

export function compareRowSets(sourceRows, targetRows, key = "report_id") {
  const sourceMap = new Map(
    sourceRows.map((row) => [row[key], normalizeReportRowForReconciliation(row)]),
  );
  const targetMap = new Map(
    targetRows.map((row) => [row[key], normalizeReportRowForReconciliation(row)]),
  );
  const missingInTarget = [];
  const missingInSource = [];
  const hashMismatches = [];

  for (const [id, sourceRow] of sourceMap) {
    const targetRow = targetMap.get(id);
    if (!targetRow) {
      missingInTarget.push(id);
      continue;
    }
    if (canonicalRowHash(sourceRow) !== canonicalRowHash(targetRow)) {
      hashMismatches.push(id);
    }
  }

  for (const id of targetMap.keys()) {
    if (!sourceMap.has(id)) {
      missingInSource.push(id);
    }
  }

  return {
    missingInTarget,
    missingInSource,
    hashMismatches,
    pass:
      missingInTarget.length === 0 &&
      missingInSource.length === 0 &&
      hashMismatches.length === 0,
  };
}

export function compareObjectInventories(sourceObjects, targetObjects) {
  const sourceMap = new Map(sourceObjects.map((item) => [item.path, item]));
  const targetMap = new Map(targetObjects.map((item) => [item.path, item]));
  const missingInTarget = [];
  const hashMismatches = [];
  const orphansInTarget = [];

  for (const [path, sourceObject] of sourceMap) {
    const targetObject = targetMap.get(path);
    if (!targetObject) {
      missingInTarget.push(path);
      continue;
    }
    if (sourceObject.sha256 !== targetObject.sha256) {
      hashMismatches.push(path);
    }
    if (sourceObject.size_bytes !== targetObject.size_bytes) {
      hashMismatches.push(path);
    }
  }

  for (const path of targetMap.keys()) {
    if (!sourceMap.has(path)) {
      orphansInTarget.push(path);
    }
  }

  return {
    missingInTarget,
    hashMismatches,
    orphansInTarget,
    pass:
      missingInTarget.length === 0 &&
      hashMismatches.length === 0 &&
      orphansInTarget.length === 0,
  };
}

export function buildReconciliationManifest(options) {
  const rowComparison = compareRowSets(options.sourceRows, options.targetRows);
  const objectComparison = compareObjectInventories(
    options.sourceObjects,
    options.targetObjects,
  );
  const pass = rowComparison.pass && objectComparison.pass;
  return {
    status: pass ? "PASS" : "FAIL",
    signed: Boolean(options.signed),
    signer: options.signer ?? null,
    signedAt: options.signedAt ?? null,
    gitRevision: options.gitRevision ?? null,
    rowComparison,
    objectComparison,
    sourceCounts: {
      reports: options.sourceRows.length,
      objects: options.sourceObjects.length,
    },
    targetCounts: {
      reports: options.targetRows.length,
      objects: options.targetObjects.length,
      evidence_path_rows: options.targetEvidencePathCount ?? 0,
      gs_uri_rows: options.targetGsUriCount ?? 0,
    },
    uriSchemes: summarizeUriSchemes(options.targetRows),
    unexplainedDifferences: pass
      ? []
      : [
          ...rowComparison.missingInTarget.map((id) => `missing-report:${id}`),
          ...rowComparison.missingInSource.map((id) => `orphan-report:${id}`),
          ...rowComparison.hashMismatches.map((id) => `hash-mismatch:${id}`),
          ...objectComparison.missingInTarget.map(
            (path) => `missing-object:${path}`,
          ),
          ...objectComparison.hashMismatches.map(
            (path) => `object-hash-mismatch:${path}`,
          ),
          ...objectComparison.orphansInTarget.map(
            (path) => `orphan-object:${path}`,
          ),
        ],
  };
}
