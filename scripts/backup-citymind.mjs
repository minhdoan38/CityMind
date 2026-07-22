#!/usr/bin/env node
/**
 * Operator-approved CityMind backup: separate Postgres dump + Storage object manifest/archive.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { loadProjectEnv, requireEnvKeys, REPO_ROOT } from "./load-project-env.mjs";

function fail(message) {
  console.error(`backup-citymind: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const outputIndex = argv.findIndex((arg) => arg === "-Output" || arg === "--output");
  const output =
    outputIndex !== -1 ? argv[outputIndex + 1] : argv.find((arg) => arg.startsWith("--output="))?.split("=")[1];
  if (!output) fail("Usage: node backup-citymind.mjs -Output <absolute-or-repo-relative-dir>");
  return { outputDir: path.resolve(REPO_ROOT, output) };
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
  if (error) fail(error.message);

  for (const folder of reportFolders ?? []) {
    if (!folder.name) continue;
    const prefix = `reports/${folder.name}`;
    const { data: files, error: listError } = await client.storage
      .from("evidence")
      .list(prefix, { limit: 100 });
    if (listError) continue;
    for (const file of files ?? []) {
      if (!file.name || file.id === null) continue;
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
        bytes,
      });
    }
  }
  return objects;
}

async function main() {
  const { outputDir } = parseArgs(process.argv.slice(2));
  if (!path.isAbsolute(outputDir)) {
    fail("Output directory must resolve to an absolute path");
  }
  if (outputDir.includes("production") || outputDir.includes("current-live")) {
    fail("Refusing ambiguous production/current-live backup target name");
  }

  const env = loadProjectEnv();
  const missing = requireEnvKeys(env, [
    "SUPABASE_URL",
    "SUPABASE_SECRET_KEY",
    "SUPABASE_DB_URL",
  ]);
  if (missing.length > 0) fail(`missing env keys: ${missing.join(", ")}`);

  fs.mkdirSync(outputDir, { recursive: true });
  const dbPath = path.join(outputDir, "database.sql");
  const storageManifestPath = path.join(outputDir, "storage-manifest.json");
  const backupMetaPath = path.join(outputDir, "backup-meta.json");

  const dump = spawnSync(
    process.platform === "win32" ? "supabase.exe" : "supabase",
    ["db", "dump", "--db-url", env.SUPABASE_DB_URL, "-f", dbPath],
    { cwd: REPO_ROOT, encoding: "utf8", env: { ...process.env, ...env } },
  );
  if (dump.status !== 0) {
    fail(dump.stderr || dump.stdout || "supabase db dump failed");
  }
  if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0) {
    fail("database dump is missing or empty");
  }

  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const objects = await listEvidenceObjects(client);
  const storageManifest = {
    capturedAt: new Date().toISOString(),
    bucket: "evidence",
    objects: objects.map(({ bytes: _bytes, ...meta }) => meta),
  };
  fs.writeFileSync(storageManifestPath, `${JSON.stringify(storageManifest, null, 2)}\n`, "utf8");

  const storageArchivePath = path.join(outputDir, "storage-objects.jsonl");
  const lines = objects.map((object) =>
    JSON.stringify({
      path: object.path,
      size_bytes: object.size_bytes,
      mime_type: object.mime_type,
      sha256: object.sha256,
      content_base64: Buffer.from(object.bytes).toString("base64"),
    }),
  );
  fs.writeFileSync(storageArchivePath, `${lines.join("\n")}\n`, "utf8");

  const meta = {
    createdAt: new Date().toISOString(),
    outputDir,
    db_backup_path: dbPath,
    db_backup_hash: sha256File(dbPath),
    storage_manifest_path: storageManifestPath,
    storage_archive_path: storageArchivePath,
    storage_backup_hash: sha256File(storageArchivePath),
    object_count: objects.length,
    credentialScope: "supabase-service-role-readonly-backup",
  };
  fs.writeFileSync(backupMetaPath, `${JSON.stringify(meta, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(meta, null, 2));
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
