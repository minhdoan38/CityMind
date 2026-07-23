#!/usr/bin/env node
/**
 * Batch-convert legacy evidence objects to sanitized WebP keys.
 *
 * Usage:
 *   node scripts/migrate-evidence-to-webp.mjs --dry-run
 *   node scripts/migrate-evidence-to-webp.mjs --limit 10
 *   node scripts/migrate-evidence-to-webp.mjs --report-id <id>
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys } from "./load-project-env.mjs";

const EVIDENCE_BUCKET = "evidence";
const DEFAULT_MAX_INPUT_PIXELS = 16_777_216;
const DEFAULT_WEBP_QUALITY = 88;

function fail(message) {
  console.error(`migrate-evidence-to-webp: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const limitIndex = argv.indexOf("--limit");
  const reportIdIndex = argv.indexOf("--report-id");
  const limit =
    limitIndex >= 0 ? Number.parseInt(argv[limitIndex + 1] ?? "", 10) : null;
  const reportId =
    reportIdIndex >= 0 ? String(argv[reportIdIndex + 1] ?? "").trim() : null;
  if (limitIndex >= 0 && (!Number.isFinite(limit) || limit <= 0)) {
    fail("--limit requires a positive integer");
  }
  if (reportIdIndex >= 0 && !reportId) {
    fail("--report-id requires a report id");
  }
  return { dryRun, limit, reportId };
}

function isLegacyEvidencePath(path) {
  if (!path) return false;
  if (path.endsWith(".webp") && /\/[0-9a-f-]{36}\.webp$/i.test(path)) {
    return false;
  }
  return /^evidence\/reports\/[^/]+\/evidence\.(jpg|jpeg|png|webp)$/i.test(path);
}

function objectPathFromEvidencePath(evidencePath) {
  return evidencePath.replace(/^evidence\//, "");
}

async function sanitizeToWebp(bytes) {
  const { default: sharp } = await import("sharp");
  return sharp(bytes, {
    limitInputPixels: Number(process.env.EVIDENCE_MAX_INPUT_PIXELS ?? DEFAULT_MAX_INPUT_PIXELS),
    failOn: "warning",
    animated: false,
    pages: 1,
  })
    .rotate()
    .webp({
      quality: Number(process.env.EVIDENCE_WEBP_QUALITY ?? DEFAULT_WEBP_QUALITY),
    })
    .toBuffer();
}

async function listCandidateReports(client, reportId) {
  let query = client
    .from("reports")
    .select("report_id, evidence_path")
    .not("evidence_path", "is", null);
  if (reportId) {
    query = query.eq("report_id", reportId);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).filter((row) => isLegacyEvidencePath(row.evidence_path));
}

async function main() {
  const { dryRun, limit, reportId } = parseArgs(process.argv.slice(2));
  const env = loadProjectEnv();
  const missing = requireEnvKeys(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  if (missing.length > 0) {
    fail(`missing env keys: ${missing.join(", ")}`);
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const candidates = await listCandidateReports(client, reportId);
  const selected = limit ? candidates.slice(0, limit) : candidates;

  const summary = {
    dry_run: dryRun,
    converted: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  for (const row of selected) {
    const evidencePath = row.evidence_path;
    const objectPath = objectPathFromEvidencePath(evidencePath);
    try {
      if (dryRun) {
        summary.converted += 1;
        continue;
      }

      const { data, error } = await client.storage
        .from(EVIDENCE_BUCKET)
        .download(objectPath);
      if (error || !data) {
        throw new Error(error?.message ?? "download failed");
      }

      const bytes = new Uint8Array(await data.arrayBuffer());
      const webpBytes = await sanitizeToWebp(bytes);
      const newObjectPath = `reports/${row.report_id}/${randomUUID()}.webp`;
      const newEvidencePath = `${EVIDENCE_BUCKET}/${newObjectPath}`;

      const { error: uploadError } = await client.storage
        .from(EVIDENCE_BUCKET)
        .upload(newObjectPath, webpBytes, {
          contentType: "image/webp",
          upsert: false,
        });
      if (uploadError) {
        throw uploadError;
      }

      const { error: updateError } = await client
        .from("reports")
        .update({ evidence_path: newEvidencePath })
        .eq("report_id", row.report_id);
      if (updateError) {
        await client.storage.from(EVIDENCE_BUCKET).remove([newObjectPath]);
        throw updateError;
      }

      const { error: removeError } = await client.storage
        .from(EVIDENCE_BUCKET)
        .remove([objectPath]);
      if (removeError) {
        throw removeError;
      }

      summary.converted += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        report_id: row.report_id,
        evidence_path: evidencePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  summary.skipped = candidates.length - selected.length;
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0 && !dryRun) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
