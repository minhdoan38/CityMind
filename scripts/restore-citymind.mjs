#!/usr/bin/env node
/**
 * Guarded isolated restore wrapper for CityMind backups.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`restore-citymind: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const inputIndex = argv.findIndex((arg) => arg === "-Input" || arg === "--input");
  const targetIndex = argv.findIndex((arg) => arg === "-Target" || arg === "--target");
  const input =
    inputIndex !== -1 ? argv[inputIndex + 1] : argv.find((arg) => arg.startsWith("--input="))?.split("=")[1];
  const target =
    targetIndex !== -1 ? argv[targetIndex + 1] : argv.find((arg) => arg.startsWith("--target="))?.split("=")[1];
  if (!input || !target) {
    fail("Usage: node restore-citymind.mjs -Input <backup-dir> -Target isolated");
  }
  if (target !== "isolated") {
    fail("Only -Target isolated is supported");
  }
  return { inputDir: path.resolve(REPO_ROOT, input) };
}

function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

async function main() {
  const { inputDir } = parseArgs(process.argv.slice(2));
  const restoreTargetUrl = process.env.CITYMIND_ISOLATED_DB_URL?.trim();
  const restoreSupabaseUrl = process.env.CITYMIND_ISOLATED_SUPABASE_URL?.trim();
  const restoreServiceKey = process.env.CITYMIND_ISOLATED_SUPABASE_SECRET_KEY?.trim();
  if (!restoreTargetUrl || !restoreSupabaseUrl || !restoreServiceKey) {
    fail(
      "Isolated restore requires CITYMIND_ISOLATED_DB_URL, CITYMIND_ISOLATED_SUPABASE_URL, and CITYMIND_ISOLATED_SUPABASE_SECRET_KEY",
    );
  }

  const env = loadProjectEnv();
  if (restoreTargetUrl === env.SUPABASE_DB_URL) {
    fail("Refusing restore into current production SUPABASE_DB_URL");
  }

  const metaPath = path.join(inputDir, "backup-meta.json");
  const dbPath = path.join(inputDir, "database.sql");
  const storageArchivePath = path.join(inputDir, "storage-objects.jsonl");
  for (const required of [metaPath, dbPath, storageArchivePath]) {
    if (!fs.existsSync(required)) fail(`missing backup artifact: ${required}`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
  if (sha256File(dbPath) !== meta.db_backup_hash) {
    fail("database backup hash mismatch");
  }
  if (sha256File(storageArchivePath) !== meta.storage_backup_hash) {
    fail("storage archive hash mismatch");
  }

  const restoreSql = fs.readFileSync(dbPath, "utf8");
  const apply = spawnSync(
    process.platform === "win32" ? "supabase.exe" : "supabase",
    ["db", "query", restoreSql, "--db-url", restoreTargetUrl],
    { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, ...env } },
  );
  if (apply.status !== 0) {
    fail(apply.stderr || apply.stdout || "isolated database restore failed");
  }

  const client = createClient(restoreSupabaseUrl, restoreServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const lines = fs
    .readFileSync(storageArchivePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) {
    const entry = JSON.parse(line);
    const objectPath = entry.path.replace(/^evidence\//, "");
    const bytes = Buffer.from(entry.content_base64, "base64");
    const { error } = await client.storage.from("evidence").upload(objectPath, bytes, {
      contentType: entry.mime_type ?? "application/octet-stream",
      upsert: true,
    });
    if (error) fail(`storage restore failed for ${entry.path}: ${error.message}`);
  }

  const restoreManifestPath = path.join(
    REPO_ROOT,
    "frontend",
    "migration-manifests",
    "restore.json",
  );
  const restoreManifest = {
    status: "RESTORED",
    restoredAt: new Date().toISOString(),
    sourceBackupDir: inputDir,
    db_backup_hash: meta.db_backup_hash,
    storage_backup_hash: meta.storage_backup_hash,
    isolatedTarget: "CITYMIND_ISOLATED_DB_URL",
    object_count: lines.length,
  };
  fs.writeFileSync(restoreManifestPath, `${JSON.stringify(restoreManifest, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(restoreManifest, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
