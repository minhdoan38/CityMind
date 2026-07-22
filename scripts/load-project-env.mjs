#!/usr/bin/env node
/**
 * Load non-secret env keys from .env.local for tooling scripts.
 * Does not print values.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadProjectEnv() {
  const merged = {
    ...parseEnvFile(path.join(REPO_ROOT, ".env.local")),
    ...parseEnvFile(path.join(REPO_ROOT, ".env")),
    ...process.env,
  };

  // Normalize service role key naming across env files.
  if (!merged.SUPABASE_SERVICE_ROLE_KEY && merged.SUPABASE_SECRET_KEY) {
    merged.SUPABASE_SERVICE_ROLE_KEY = merged.SUPABASE_SECRET_KEY;
  }
  if (!merged.SUPABASE_SECRET_KEY && merged.SUPABASE_SERVICE_ROLE_KEY) {
    merged.SUPABASE_SECRET_KEY = merged.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!merged.NEXT_PUBLIC_SUPABASE_URL && merged.SUPABASE_URL) {
    merged.NEXT_PUBLIC_SUPABASE_URL = merged.SUPABASE_URL;
  }
  if (!merged.NEXT_PUBLIC_SUPABASE_ANON_KEY && merged.SUPABASE_PUBLISHABLE_KEY) {
    merged.NEXT_PUBLIC_SUPABASE_ANON_KEY = merged.SUPABASE_PUBLISHABLE_KEY;
  }

  return merged;
}

export function requireEnvKeys(env, keys) {
  const missing = [];
  for (const key of keys) {
    const value = env[key];
    if (!value || value.includes("your-") || value.includes("YOUR_")) {
      missing.push(key);
    }
  }
  return missing;
}

export { REPO_ROOT };
