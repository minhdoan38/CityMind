#!/usr/bin/env node
/**
 * Fail-closed verifier for native Supabase CLI and PostgreSQL client tooling.
 * Used by Phase 7 plans before schema/migration work.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { loadProjectEnv, requireEnvKeys } from "./load-project-env.mjs";

function parseArgs(argv) {
  const args = {
    file: null,
    requireSigned: false,
    requireNativeSupabase: false,
    supabaseRange: null,
    requireNativePsql: false,
    psqlRange: null,
    requireNativePgDump: false,
    forbidDocker: false,
  };
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    switch (token) {
      case "--file":
        args.file = argv[++i];
        break;
      case "--require-signed":
        args.requireSigned = true;
        break;
      case "--require-native-supabase":
        args.requireNativeSupabase = true;
        break;
      case "--supabase-range":
        args.supabaseRange = argv[++i];
        break;
      case "--require-native-psql":
        args.requireNativePsql = true;
        break;
      case "--psql-range":
        args.psqlRange = argv[++i];
        break;
      case "--require-native-pg-dump":
        args.requireNativePgDump = true;
        break;
      case "--forbid-docker":
        args.forbidDocker = true;
        break;
      default:
        fail(`Unknown argument: ${token}`);
    }
  }
  if (!args.file) fail("--file is required");
  return args;
}

function fail(message) {
  console.error(`verify-tooling-decision: ${message}`);
  process.exit(1);
}

function parseSemver(value) {
  const match = String(value).match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    raw: `${match[1]}.${match[2]}.${match[3]}`,
  };
}

function parsePsqlMajor(versionOutput) {
  const match = String(versionOutput).match(/PostgreSQL\)\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

function inSemverRange(version, rangeSpec) {
  const [minRaw, maxRaw] = rangeSpec.split(":");
  const versionParts = parseSemver(version);
  const minParts = parseSemver(minRaw);
  const maxParts = parseSemver(maxRaw);
  if (!versionParts || !minParts || !maxParts) return false;
  const v = versionParts.major * 1_000_000 + versionParts.minor * 1_000 + versionParts.patch;
  const min = minParts.major * 1_000_000 + minParts.minor * 1_000 + minParts.patch;
  const max = maxParts.major * 1_000_000 + maxParts.minor * 1_000 + maxParts.patch;
  return v >= min && v < max;
}

function inMajorRange(major, rangeSpec) {
  const [minRaw, maxRaw] = rangeSpec.split(":");
  const min = Number(minRaw);
  const max = Number(maxRaw);
  return major >= min && major < max;
}

function sha256File(filePath) {
  const data = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(data).digest("hex").toUpperCase();
}

function probeVersion(executable) {
  const result = spawnSync(executable, ["--version"], {
    encoding: "utf8",
    shell: false,
  });
  if (result.status !== 0) {
    fail(`Version probe failed for ${executable}: ${result.stderr || result.stdout}`);
  }
  return (result.stdout || result.stderr || "").trim();
}

function assertSemverTool(toolName, tool, rangeSpec) {
  if (!tool?.executable) fail(`${toolName} executable missing in decision file`);
  const executable = path.resolve(tool.executable);
  if (!fs.existsSync(executable)) fail(`${toolName} executable not found: ${executable}`);
  if (executable.toLowerCase().includes("docker")) {
    fail(`${toolName} executable must not be a Docker wrapper`);
  }
  if (tool.sha256) {
    const actual = sha256File(executable);
    const expected = String(tool.sha256).toUpperCase();
    if (actual !== expected) {
      fail(`${toolName} sha256 mismatch for ${executable}`);
    }
  }
  const liveOutput = probeVersion(executable);
  const liveParts = parseSemver(liveOutput);
  if (!liveParts) fail(`Could not parse ${toolName} version from: ${liveOutput}`);
  if (rangeSpec && !inSemverRange(liveParts.raw, rangeSpec)) {
    fail(`${toolName} version ${liveParts.raw} outside ${rangeSpec}`);
  }
}

function assertSupabaseRemoteDatabase(decision) {
  const access = decision.databaseAccess;
  if (!access || access.mode !== "supabase-remote") {
    fail("Decision must set databaseAccess.mode to supabase-remote");
  }
  const env = loadProjectEnv();
  const keys = access.envKeys ?? ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "SUPABASE_DB_URL"];
  const missing = requireEnvKeys(env, keys);
  if (missing.length > 0) {
    fail(
      `Missing Supabase env keys for remote database access: ${missing.join(", ")} (set in backend/.env)`
    );
  }
  const wrapper = access.wrapperScript ?? "scripts/run-supabase-sql.mjs";
  const wrapperPath = path.resolve(process.cwd(), wrapper);
  if (!fs.existsSync(wrapperPath)) {
    fail(`Supabase SQL wrapper missing: ${wrapper}`);
  }
}

function scanForDocker(decision) {
  const blob = JSON.stringify(decision).toLowerCase();
  const forbidden = ["docker run", "npx supabase", "podman", "colima"];
  for (const term of forbidden) {
    if (blob.includes(term)) fail(`Docker-equivalent route detected: ${term}`);
  }
}

const args = parseArgs(process.argv);
const decisionPath = path.resolve(process.cwd(), args.file);
if (!fs.existsSync(decisionPath)) fail(`Decision file not found: ${decisionPath}`);

const decision = JSON.parse(fs.readFileSync(decisionPath, "utf8"));

if (args.requireSigned) {
  if (decision.approved !== true) fail("Decision is not approved");
  if (decision.status !== "PASS") fail(`Decision status must be PASS, got ${decision.status}`);
  if (!decision.signer) fail("Decision signer is required");
}

if (args.forbidDocker) {
  if (decision.forbidDocker !== true) fail("Decision must set forbidDocker:true");
  scanForDocker(decision);
}

if (args.requireNativeSupabase) {
  assertSemverTool("supabase", decision.tools?.supabase, args.supabaseRange);
}

if (args.requireNativePsql) {
  if (decision.databaseAccess?.mode === "supabase-remote") {
    assertSupabaseRemoteDatabase(decision);
  } else {
    fail(
      "Native psql is not installed. Decision must use databaseAccess.mode=supabase-remote with project Supabase env keys."
    );
  }
}

if (args.requireNativePgDump) {
  if (decision.databaseAccess?.mode !== "supabase-remote") {
    fail("pg_dump requires supabase-remote databaseAccess mode (use supabase db dump --db-url)");
  }
  if (!decision.databaseAccess?.backupRunner?.includes("supabase db dump")) {
    fail("Decision must record supabase db dump backup runner");
  }
}

console.log(`verify-tooling-decision: PASS (${path.relative(process.cwd(), decisionPath)})`);
