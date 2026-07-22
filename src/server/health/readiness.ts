import "server-only";

import { createClient } from "@supabase/supabase-js";

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

export async function checkReadiness(
  env: NodeJS.ProcessEnv = process.env,
): Promise<ReadinessResponse> {
  const started = Date.now();
  const supabaseUrl = env.SUPABASE_URL?.trim();
  const serviceRoleKey =
    env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? env.SUPABASE_SECRET_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      status: "not_ready",
      dependencies: [
        {
          name: "supabase",
          status: "down",
          latency_ms: Date.now() - started,
        },
      ],
    };
  }

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
      status: "ready",
      dependencies: [
        {
          name: "supabase",
          status: "up",
          latency_ms: Date.now() - started,
        },
      ],
    };
  } catch {
    return {
      status: "not_ready",
      dependencies: [
        {
          name: "supabase",
          status: "down",
          latency_ms: Date.now() - started,
        },
      ],
    };
  }
}
