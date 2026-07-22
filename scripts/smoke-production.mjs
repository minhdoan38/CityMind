#!/usr/bin/env node
/**
 * Production smoke: clean build, loopback start, health/ready polling, graceful shutdown.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FRONTEND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOST = process.env.SMOKE_HOST?.trim() || "127.0.0.1";
const PORT = Number(process.env.SMOKE_PORT ?? "4310");
const BASE_URL = `http://${HOST}:${PORT}`;
const SECRET_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY=\S+/i,
  /THIRD_PARTY_API_KEY=\S+/i,
  /Bearer\s+[A-Za-z0-9._-]{8,}/,
  /postgresql:\/\//i,
];

function fail(message) {
  console.error(`smoke-production: ${message}`);
  process.exit(1);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: FRONTEND_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `${command} exited ${code}`));
    });
  });
}

async function waitForEndpoint(pathname, expectedStatus = 200) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}${pathname}`);
      if (response.status === expectedStatus) return;
    } catch {
      // server still starting
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  fail(`timed out waiting for ${pathname}`);
}

function scanForSecrets(output) {
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.test(output)) {
      fail(`secret-like output matched ${pattern}`);
    }
  }
}

async function main() {
  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    fail(`Node 22+ required for production smoke (found ${process.versions.node})`);
  }
  if (HOST === "0.0.0.0") {
    fail("Refusing smoke run on 0.0.0.0 bind");
  }

  if (process.env.SMOKE_SKIP_BUILD !== "1") {
    await run("npm", ["run", "build"], {
      env: { ...process.env, NODE_ENV: "production" },
    });
  }

  const server = spawn("npm", ["run", "start", "--", "-H", HOST, "-p", String(PORT)], {
    cwd: FRONTEND_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    shell: process.platform === "win32",
    env: { ...process.env, NODE_ENV: "production", PORT: String(PORT), HOSTNAME: HOST },
  });

  let logs = "";
  server.stdout?.on("data", (chunk) => {
    logs += String(chunk);
  });
  server.stderr?.on("data", (chunk) => {
    logs += String(chunk);
  });

  try {
    await waitForEndpoint("/api/health", 200);
    const readyResponse = await fetch(`${BASE_URL}/api/ready`);
    if (readyResponse.status !== 200 && readyResponse.status !== 503) {
      fail(`/api/ready returned unexpected status ${readyResponse.status}`);
    }
    const readyBody = await readyResponse.json();
    const serialized = JSON.stringify(readyBody);
    scanForSecrets(serialized);
    if (serialized.includes("http://") || serialized.includes("https://")) {
      fail("readiness payload leaked URL");
    }

    const homeResponse = await fetch(`${BASE_URL}/en`);
    if (homeResponse.status !== 200) {
      fail(`/en returned ${homeResponse.status}`);
    }
    scanForSecrets(logs);
    console.log(`smoke-production: PASS (${BASE_URL})`);
  } finally {
    server.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 1500));
    if (!server.killed) server.kill("SIGKILL");
  }
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
