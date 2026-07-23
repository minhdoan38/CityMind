import "server-only";

import { createClient } from "@supabase/supabase-js";

import { isClamavEnabled } from "@/server/services/clamav-client";
import { checkClamavHealth } from "./clamav-readiness";

export type DependencyStatus = {
  name: string;
  status: "up" | "down";
  latency_ms: number;
};

export type ReadinessResponse = {
  status: "ready" | "not_ready";
  dependencies: DependencyStatus[];
};

const READINESS_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function probeSupabase(
  env: NodeJS.ProcessEnv,
): Promise<DependencyStatus | null> {
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  const started = Date.now();
  try {
    const client = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await withTimeout(
      (async () => {
        const { error } = await client
          .from("reports")
          .select("report_id", { head: true, count: "exact" });
        if (error) throw error;
      })(),
      READINESS_TIMEOUT_MS,
    );
    return {
      name: "supabase",
      status: "up",
      latency_ms: Date.now() - started,
    };
  } catch {
    return {
      name: "supabase",
      status: "down",
      latency_ms: Date.now() - started,
    };
  }
}

export async function checkReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessResponse> {
  const supabase = await probeSupabase(env);
  const dependencies: DependencyStatus[] = supabase
    ? [supabase]
    : [
        {
          name: "supabase",
          status: "down",
          latency_ms: 0,
        },
      ];

  if (supabase?.status !== "up") {
    return { status: "not_ready", dependencies };
  }

  if (isClamavEnabled()) {
    const clamav = await checkClamavHealth();
    dependencies.push({
      name: "clamav",
      status: clamav.body.status === "up" ? "up" : "down",
      latency_ms: clamav.body.latency_ms,
    });
    if (clamav.body.status !== "up") {
      return { status: "not_ready", dependencies };
    }
  }

  return { status: "ready", dependencies };
}
