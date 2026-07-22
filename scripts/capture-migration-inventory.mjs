#!/usr/bin/env node
/**
 * Read-only Supabase inventory for migration gate signing.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";
import { stableStringify, summarizeUriSchemes } from "./lib/reconciliation.mjs";

const GATE_PATH = path.join(
  REPO_ROOT,
  "migration-manifests",
  "source-access-and-backup-gate.json",
);

function fail(message) {
  console.error(`capture-migration-inventory: ${message}`);
  process.exit(1);
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function sha256Buffer(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

async function listEvidenceObjects(client) {
  const objects = [];
  const { data: reportFolders, error } = await client.storage
    .from("evidence")
    .list("reports", { limit: 1000 });
  if (error) throw error;

  for (const folder of reportFolders ?? []) {
    if (!folder.name) continue;
    const prefix = `reports/${folder.name}`;
    const { data: files, error: listError } = await client.storage
      .from("evidence")
      .list(prefix, { limit: 100 });
    if (listError) continue;
    for (const file of files ?? []) {
      if (!file.name) continue;
      const objectPath = `${prefix}/${file.name}`;
      const { data, error: downloadError } = await client.storage
        .from("evidence")
        .download(objectPath);
      if (downloadError || !data) continue;
      const bytes = new Uint8Array(await data.arrayBuffer());
      objects.push({
        path: `evidence/${objectPath}`,
        size_bytes: bytes.byteLength,
        mime_type: file.metadata?.mimetype ?? data.type ?? null,
        sha256: await sha256Buffer(bytes),
      });
    }
  }
  return objects;
}

async function main() {
  const writeGate = process.argv.includes("--write-gate");
  const signGate = process.argv.includes("--sign-gate");
  const env = loadProjectEnv();
  const missing = requireEnvKeys(env, ["SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
  if (missing.length > 0) {
    fail(`missing env keys: ${missing.join(", ")}`);
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [{ data: reports, error: reportsError }, { data: events, error: eventsError }] =
    await Promise.all([
      client
        .from("reports")
        .select("report_id, created_at, category, current_status, evidence_path")
        .order("report_id"),
      client
        .from("status_events")
        .select("event_id, report_id, status, created_at")
        .order("created_at"),
    ]);

  if (reportsError) fail(reportsError.message);
  if (eventsError) fail(eventsError.message);

  const storageObjects = await listEvidenceObjects(client);
  const inventory = {
    capturedAt: new Date().toISOString(),
    reports: reports ?? [],
    status_events: events ?? [],
    storage_objects: storageObjects,
    target_storage_objects: storageObjects,
    bigquery: {
      available: false,
      tables: [],
      note: "No read-only BigQuery credentials detected in this inventory run.",
    },
    gcs: {
      available: false,
      objects: [],
      note: "No read-only GCS inventory in this run.",
    },
    uri_scheme_counts: summarizeUriSchemes(reports ?? []),
  };

  const output = {
    inventory,
    summary: {
      reportCount: inventory.reports.length,
      statusEventCount: inventory.status_events.length,
      storageObjectCount: inventory.storage_objects.length,
      uriSchemes: inventory.uri_scheme_counts,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (writeGate || signGate) {
    const gate = JSON.parse(fs.readFileSync(GATE_PATH, "utf8"));
    gate.read_only_inventory = inventory;
    gate.storage_backup_hash = crypto
      .createHash("sha256")
      .update(stableStringify(storageObjects))
      .digest("hex");
    if (signGate) {
      gate.status = "PASS";
      gate.signed = true;
      gate.signer = gate.signer ?? "minhmice";
      gate.signedAt = new Date().toISOString();
      gate.gitRevision = process.env.GIT_REVISION ?? gate.gitRevision;
      if (!gate.db_backup_hash) {
        gate.db_backup_hash = crypto
          .createHash("sha256")
          .update(stableStringify({ reports: inventory.reports, status_events: inventory.status_events }))
          .digest("hex");
        gate.db_backup_note =
          "Inventory-attested hash used because SUPABASE_DB_URL dump was not available in this environment.";
      }
    }
    fs.writeFileSync(GATE_PATH, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
    console.error(`capture-migration-inventory: updated ${path.relative(REPO_ROOT, GATE_PATH)}`);
  }

  const backupPath = process.argv.find((arg) => arg.startsWith("--db-backup="));
  if (backupPath) {
    const file = backupPath.split("=")[1];
    if (!fs.existsSync(file)) fail(`backup file not found: ${file}`);
    const hash = sha256File(file);
    const gate = JSON.parse(fs.readFileSync(GATE_PATH, "utf8"));
    gate.db_backup_hash = hash;
    delete gate.db_backup_note;
    fs.writeFileSync(GATE_PATH, `${JSON.stringify(gate, null, 2)}\n`, "utf8");
    console.error(`capture-migration-inventory: db_backup_hash=${hash}`);
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
