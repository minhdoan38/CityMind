import type { CitizenTriageOutcomeData } from "@/components/coach/CitizenTriageOutcome";
import type { CitizenServiceStep } from "@/server/services/citizen-status";

export const REPORT_SUCCESS_FLASH_KEY = "citymind:report-success";
export const REPORT_FAILED_FLASH_KEY = "citymind:report-failed";

export type ReportSuccessFlash = {
  reportId: string;
  accessToken: string;
  outcome?: CitizenTriageOutcomeData;
};

export type ReportFailedReason = "network" | "validation" | "server" | "unknown";

export type ReportFailedFlash = {
  message: string;
  reason: ReportFailedReason;
  status?: number;
};

/** Survives React Strict Mode remount — flash is read at most once per navigation. */
let successFlashMemory: ReportSuccessFlash | null | undefined;
let failedFlashMemory: ReportFailedFlash | null | undefined;

function parseSuccessFlash(raw: string): ReportSuccessFlash | null {
  try {
    const data = JSON.parse(raw) as Partial<ReportSuccessFlash> & {
      service_step?: CitizenServiceStep;
      triage_status?: string;
      routing_destination?: string | null;
      category?: string | null;
      severity?: number | null;
      priority?: string | null;
      summary?: string | null;
      recommendation?: string | null;
      playbook_id?: string | null;
      can_escalate?: boolean;
      guidance_script?: string | null;
      guidance_status?: "script_ready" | "generate_later" | null;
      allowed_actions?: string[];
      prohibited_actions?: string[];
    };
    if (!data.reportId || !data.accessToken) return null;

    const outcome: CitizenTriageOutcomeData | undefined =
      data.outcome ??
      (data.service_step && data.triage_status
        ? {
            service_step: data.service_step,
            triage_status: data.triage_status,
            routing_destination: data.routing_destination ?? null,
            category: data.category ?? null,
            severity: data.severity ?? null,
            priority: data.priority ?? null,
            summary: data.summary ?? null,
            recommendation: data.recommendation ?? null,
            playbook_id: data.playbook_id ?? null,
            can_escalate: data.can_escalate ?? false,
            guidance_script: data.guidance_script ?? null,
            guidance_status: data.guidance_status ?? null,
            allowed_actions: data.allowed_actions ?? [],
            prohibited_actions: data.prohibited_actions ?? [],
          }
        : undefined);

    return { reportId: data.reportId, accessToken: data.accessToken, outcome };
  } catch {
    return null;
  }
}

export function writeReportSuccessFlash(payload: ReportSuccessFlash): void {
  if (typeof window === "undefined") return;
  successFlashMemory = undefined;
  sessionStorage.setItem(REPORT_SUCCESS_FLASH_KEY, JSON.stringify(payload));
}

export function readReportSuccessFlash(): ReportSuccessFlash | null {
  if (typeof window === "undefined") return null;
  if (successFlashMemory !== undefined) {
    return successFlashMemory;
  }

  const raw = sessionStorage.getItem(REPORT_SUCCESS_FLASH_KEY);
  sessionStorage.removeItem(REPORT_SUCCESS_FLASH_KEY);
  if (!raw) {
    successFlashMemory = null;
    return null;
  }

  successFlashMemory = parseSuccessFlash(raw);
  return successFlashMemory;
}

export function writeReportFailedFlash(payload: ReportFailedFlash): void {
  if (typeof window === "undefined") return;
  failedFlashMemory = undefined;
  sessionStorage.setItem(REPORT_FAILED_FLASH_KEY, JSON.stringify(payload));
}

export function readReportFailedFlash(): ReportFailedFlash | null {
  if (typeof window === "undefined") return null;
  if (failedFlashMemory !== undefined) {
    return failedFlashMemory;
  }

  const raw = sessionStorage.getItem(REPORT_FAILED_FLASH_KEY);
  sessionStorage.removeItem(REPORT_FAILED_FLASH_KEY);
  if (!raw) {
    failedFlashMemory = null;
    return null;
  }

  try {
    const data = JSON.parse(raw) as Partial<ReportFailedFlash>;
    if (!data.message?.trim()) {
      failedFlashMemory = null;
      return null;
    }
    failedFlashMemory = {
      message: data.message.trim(),
      reason: data.reason ?? "unknown",
      status: typeof data.status === "number" ? data.status : undefined,
    };
    return failedFlashMemory;
  } catch {
    failedFlashMemory = null;
    return null;
  }
}

/** @deprecated Use readReportFailedFlash */
export function consumeReportFailedFlash(): ReportFailedFlash | null {
  return readReportFailedFlash();
}

export function failedReasonFromStatus(status: number): ReportFailedReason {
  if (status === 422 || status === 400) return "validation";
  if (status >= 500) return "server";
  if (status === 0 || status === 408 || status === 429 || status === 503) return "network";
  return "unknown";
}
