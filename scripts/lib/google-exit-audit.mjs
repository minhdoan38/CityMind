import crypto from "node:crypto";
import path from "node:path";

export const GOOGLE_FONT_ALLOWLIST = [
  {
    file: "src/lib/fonts.ts",
    patterns: [/next\/font\/google/],
  },
  {
    file: "src/app/globals.css",
    patterns: [/fonts\.googleapis\.com/],
  },
];

export const EXCLUDED_PATH_PREFIXES = [
  ".planning/",
  ".git/",
  "node_modules/",
  "frontend/node_modules/",
  "frontend/.next/",
  "backend/.venv/",
  "backend/.pytest_cache/",
  "supabase/migrations/",
  "tests/contracts/fastapi-golden/",
  "migration-manifests/",
  "operations/tooling-decision.json",
];

export const MIGRATION_TOOLING_PREFIXES = [
  "scripts/capture-migration-inventory.mjs",
  "scripts/inventory-google-sources.ps1",
  "scripts/migrate-google-data.ps1",
  "scripts/reconcile-migration.mjs",
  "scripts/lib/reconciliation.mjs",
  "scripts/google-exit-audit.mjs",
  "scripts/lib/google-exit-audit.mjs",
];

export const ACTIVE_FRONTEND_PREFIXES = ["src/"];

export const LEGACY_TRACK_PREFIXES = [
  "backend/",
  "scripts/migrate_bigquery_to_supabase.py",
  "scripts/seed_reports.py",
  "infra/bigquery/",
  "docker-compose.yml",
  "backend/Dockerfile",
  "frontend/Dockerfile",
  "scripts/deploy_cloudrun.ps1",
];

export const FORBIDDEN_RULES = [
  {
    id: "google-cloud-sdk-import",
    pattern: /@google-cloud\//i,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "google-genai",
    pattern: /google-genai|@google\/genai/i,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "gcs-uri-scheme",
    pattern: /gs:\/\//,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "bigquery-runtime",
    pattern: /\bbigquery\b/i,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "vertex-runtime",
    pattern: /vertex\s*ai|vertexai/i,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "fastapi-runtime",
    pattern: /\b(fastapi|uvicorn)\b/i,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "backend-bridge",
    pattern: /BACKEND_API_URL|backendEndpoint\(|officerFetch\(/,
    scope: "active",
    disposition: "remove",
  },
  {
    id: "google-font-outside-allowlist",
    pattern: /next\/font\/google|fonts\.googleapis\.com/,
    scope: "active-font",
    disposition: "remove",
  },
];

export const LEGACY_INVENTORY_RULES = [
  { id: "legacy-backend-dir", pattern: /^backend\//, disposition: "remove-after-plan-12" },
  { id: "legacy-docker-compose", pattern: /^docker-compose\.yml$/, disposition: "remove-after-plan-12" },
  { id: "legacy-backend-dockerfile", pattern: /^backend\/Dockerfile$/, disposition: "remove-after-plan-12" },
  { id: "legacy-frontend-dockerfile", pattern: /^frontend\/Dockerfile$/, disposition: "remove-after-plan-12" },
  { id: "legacy-bq-migrate", pattern: /^scripts\/migrate_bigquery_to_supabase\.py$/, disposition: "remove-after-plan-12" },
  { id: "legacy-cloudrun-deploy", pattern: /^scripts\/deploy_cloudrun\.ps1$/, disposition: "remove-after-plan-12" },
  { id: "legacy-infra-bq", pattern: /^infra\/bigquery\//, disposition: "remove-after-plan-12" },
  { id: "legacy-backend-bridge-module", pattern: /^src\/lib\/backend\.ts$/, disposition: "remove-after-plan-12" },
];

export function normalizeRelPath(filePath, root) {
  return path.relative(root, filePath).split(path.sep).join("/");
}

export function isExcludedPath(relPath) {
  return EXCLUDED_PATH_PREFIXES.some(
    (prefix) => relPath === prefix.replace(/\/$/, "") || relPath.startsWith(prefix),
  );
}

export function isMigrationToolingPath(relPath) {
  return MIGRATION_TOOLING_PREFIXES.includes(relPath);
}

export function isActiveFrontendPath(relPath) {
  return ACTIVE_FRONTEND_PREFIXES.some((prefix) => relPath.startsWith(prefix));
}

export function isGoogleFontAllowlisted(relPath, line) {
  const entry = GOOGLE_FONT_ALLOWLIST.find((item) => item.file === relPath);
  if (!entry) return false;
  return entry.patterns.some((pattern) => pattern.test(line));
}

export function scanLine(relPath, line, lineNumber) {
  const findings = [];
  const inActive = isActiveFrontendPath(relPath);
  const migrationTooling = isMigrationToolingPath(relPath);

  for (const rule of FORBIDDEN_RULES) {
    if (rule.scope === "active" && !inActive) continue;
    if (rule.scope === "active-font" && !inActive) continue;
    if (migrationTooling && rule.id !== "google-font-outside-allowlist") continue;
    if (
      rule.id === "fastapi-runtime" &&
      /\.(test|spec)\.(ts|tsx|mjs)$/i.test(relPath)
    ) {
      continue;
    }
    if (!rule.pattern.test(line)) continue;
    if (rule.id === "google-font-outside-allowlist" && isGoogleFontAllowlisted(relPath, line)) {
      continue;
    }
    findings.push({
      id: rule.id,
      path: relPath,
      line: lineNumber,
      disposition: rule.disposition,
      excerpt: line.trim().slice(0, 160),
    });
  }
  return findings;
}

export function scanFileContent(relPath, content) {
  if (isExcludedPath(relPath)) return [];
  const lines = content.split(/\r?\n/);
  return lines.flatMap((line, index) => scanLine(relPath, line, index + 1));
}

export function buildLegacyInventory(existingPaths) {
  return LEGACY_INVENTORY_RULES.filter((rule) =>
    existingPaths.some((relPath) => rule.pattern.test(relPath)),
  ).map((rule) => ({
    id: rule.id,
    pattern: rule.pattern.source,
    disposition: rule.disposition,
    matches: existingPaths.filter((relPath) => rule.pattern.test(relPath)),
  }));
}

export function validateSafetyEvidence(manifests) {
  const issues = [];
  const { sourceGate, reconciliation, restoreGate } = manifests;

  if (!sourceGate?.signed || sourceGate?.status !== "PASS") {
    issues.push("source-access-and-backup-gate missing signed PASS");
  }
  if (!sourceGate?.db_backup_hash || !sourceGate?.storage_backup_hash) {
    issues.push("source gate missing backup hashes");
  }
  if (!sourceGate?.read_only_inventory?.reports?.length) {
    issues.push("source gate missing read_only_inventory.reports");
  }
  if (!reconciliation || reconciliation.status !== "PASS" || !reconciliation.signed) {
    issues.push("reconciliation manifest missing signed PASS");
  }
  if (!restoreGate?.signed || restoreGate?.status !== "PASS") {
    issues.push("restore-and-rollback-gate missing signed PASS");
  }
  if (restoreGate && restoreGate.application_rollback_pass !== true) {
    issues.push("restore gate missing application_rollback_pass");
  }

  return {
    pass: issues.length === 0,
    issues,
  };
}

const DOC_SCAN_PREFIXES = [
  "README.md",
  "AGENTS.md",
  ".planning/codebase/",
];

const POST_LEGACY_RUNTIME_PREFIXES = [
  "backend/",
  "docker-compose.yml",
  "backend/Dockerfile",
  "scripts/migrate_bigquery_to_supabase.py",
  "scripts/deploy_cloudrun.ps1",
  "scripts/seed_reports.py",
  "infra/bigquery/",
];

const POST_RUNTIME_PREFIXES = [
  ...POST_LEGACY_RUNTIME_PREFIXES,
  "frontend/Dockerfile",
  "frontend/src/lib/backend.ts",
];

export function filterFindingsForMode(mode, findings) {
  if (mode === "docs") {
    return findings.filter((item) =>
      DOC_SCAN_PREFIXES.some(
        (prefix) => item.path === prefix || item.path.startsWith(prefix),
      ),
    );
  }
  return findings;
}

export function evaluateAuditStatus({
  mode,
  findings,
  legacyInventory,
  safetyEvidence,
  dependencyFindings = [],
  envKeyFindings = [],
  requireAllSignedEvidence = false,
}) {
  const activeFindings = filterFindingsForMode(mode, findings);
  const legacyMatches = legacyInventory.flatMap((item) => item.matches ?? []);

  if (mode === "pre-clean") {
    return safetyEvidence.pass && legacyMatches.length > 0 ? "PASS" : "FAIL";
  }

  if (mode === "post-legacy-runtime-cleanup") {
    const lingeringLegacy = legacyMatches.filter((relPath) =>
      POST_LEGACY_RUNTIME_PREFIXES.some(
        (prefix) => relPath === prefix || relPath.startsWith(prefix),
      ),
    );
    if (lingeringLegacy.length > 0) return "FAIL";
    return activeFindings.length === 0 &&
      dependencyFindings.length === 0 &&
      envKeyFindings.length === 0
      ? "PASS"
      : "FAIL";
  }

  if (mode === "post-runtime-cleanup") {
    const lingeringRuntime = legacyMatches.filter((relPath) =>
      POST_RUNTIME_PREFIXES.some(
        (prefix) => relPath === prefix || relPath.startsWith(prefix),
      ),
    );
    if (lingeringRuntime.length > 0) return "FAIL";
    return activeFindings.length === 0 &&
      dependencyFindings.length === 0 &&
      envKeyFindings.length === 0
      ? "PASS"
      : "FAIL";
  }

  if (mode === "docs") {
    return activeFindings.length === 0 ? "PASS" : "FAIL";
  }

  if (mode === "final") {
    if (requireAllSignedEvidence && !safetyEvidence.pass) {
      return "FAIL";
    }
    const lingeringRuntime = legacyMatches.filter((relPath) =>
      POST_RUNTIME_PREFIXES.some(
        (prefix) => relPath === prefix || relPath.startsWith(prefix),
      ),
    );
    if (lingeringRuntime.length > 0) return "FAIL";
    return activeFindings.length === 0 &&
      dependencyFindings.length === 0 &&
      envKeyFindings.length === 0 &&
      safetyEvidence.pass
      ? "PASS"
      : "FAIL";
  }

  return activeFindings.length === 0 &&
    dependencyFindings.length === 0 &&
    envKeyFindings.length === 0
    ? "PASS"
    : "FAIL";
}

export function buildAuditReport(options) {
  const {
    mode,
    findings,
    legacyInventory,
    safetyEvidence,
    dependencyFindings = [],
    envKeyFindings = [],
    requireAllSignedEvidence = false,
  } = options;

  const scopedFindings = filterFindingsForMode(mode, findings);
  const status = evaluateAuditStatus({
    mode,
    findings,
    legacyInventory,
    safetyEvidence,
    dependencyFindings,
    envKeyFindings,
    requireAllSignedEvidence,
  });

  const report = {
    mode,
    status,
    generatedAt: new Date().toISOString(),
    safetyEvidence,
    counts: {
      activeFindings: scopedFindings.length,
      dependencyFindings: dependencyFindings.length,
      envKeyFindings: envKeyFindings.length,
      legacyInventoryItems: legacyInventory.length,
    },
    findings: scopedFindings,
    dependencyFindings,
    envKeyFindings,
    removalInventory: {
      trackedSource: findings,
      legacyTrack: legacyInventory,
      dependencies: dependencyFindings,
      envKeys: envKeyFindings,
    },
  };

  report.manifestHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(report, null, 2))
    .digest("hex");

  return report;
}

export function scanDependencies(packageJson) {
  const findings = [];
  const names = [
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
  ];
  for (const name of names) {
    if (/^@google-cloud\//.test(name) || /^google-/.test(name)) {
      if (name === "google-font" || name.includes("font")) continue;
      findings.push({
        id: "forbidden-npm-dependency",
        name,
        disposition: "remove",
      });
    }
  }
  return findings;
}

export const FORBIDDEN_ENV_KEYS = [
  "GOOGLE_CLOUD_PROJECT",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "BIGQUERY_DATASET",
  "GCS_BUCKET",
  "BACKEND_API_URL",
  "VERTEX_",
];

export function scanEnvExample(content, relPath = ".env.example") {
  const findings = [];
  for (const [index, line] of content.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const key = trimmed.split("=")[0]?.trim();
    if (!key) continue;
    if (FORBIDDEN_ENV_KEYS.some((forbidden) => key.includes(forbidden))) {
      findings.push({
        id: "forbidden-env-key",
        path: relPath,
        line: index + 1,
        key,
        disposition: "remove-after-plan-12",
      });
    }
  }
  return findings;
}
