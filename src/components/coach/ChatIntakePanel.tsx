"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import type { CitizenTriageOutcomeData } from "@/components/coach/CitizenTriageOutcome";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "@/i18n/navigation";

const FLASH_KEY = "citymind:report-success";
const MIN_DESCRIPTION_LENGTH = 5;

type IntakeMessage = {
  message_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type SubmitResponse = {
  report_id: string;
  access_token: string;
  triage_status?: string;
  service_step?: CitizenTriageOutcomeData["service_step"];
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

function synthesizeDescription(messages: IntakeMessage[]): string {
  return messages
    .filter((message) => message.role === "user")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

export default function ChatIntakePanel() {
  const t = useTranslations("public.intake");
  const locale = useLocale();
  const router = useRouter();

  const [reportId, setReportId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<IntakeMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiDown, setAiDown] = useState(false);

  const description = useMemo(() => synthesizeDescription(messages), [messages]);
  const canSubmit = description.length >= MIN_DESCRIPTION_LENGTH && !submitting;

  const startSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const healthRes = await fetch("/api/health/ai");
      if (healthRes.ok) {
        const health = (await healthRes.json()) as { status?: string };
        setAiDown(health.status === "down");
      }

      const res = await fetch("/api/public/reports/intake/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: locale === "vi" ? "vi" : "en" }),
      });
      if (!res.ok) {
        setError(t("loadError"));
        return;
      }

      const data = (await res.json()) as {
        report_id?: string;
        access_token?: string;
        welcome_message?: IntakeMessage;
      };
      if (!data.report_id || !data.access_token) {
        setError(t("loadError"));
        return;
      }

      setReportId(data.report_id);
      setAccessToken(data.access_token);
      setMessages(data.welcome_message ? [data.welcome_message] : []);
    } catch {
      setError(t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [locale, t]);

  useEffect(() => {
    void startSession();
  }, [startSession]);

  async function onSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || !reportId || !accessToken || sending || aiDown) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/public/reports/intake/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, token: accessToken, message }),
      });
      if (!res.ok) {
        setError(t("sendError"));
        return;
      }
      const data = (await res.json()) as { messages?: IntakeMessage[] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setDraft("");
    } catch {
      setError(t("sendError"));
    } finally {
      setSending(false);
    }
  }

  async function onSubmitReport() {
    if (!reportId || !accessToken || !canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/public/reports/intake/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          report_id: reportId,
          token: accessToken,
          description,
        }),
      });
      if (!res.ok) {
        setError(t("submitError"));
        return;
      }

      const body = (await res.json()) as SubmitResponse;
      if (!body.report_id || !body.access_token) {
        setError(t("submitError"));
        return;
      }

      sessionStorage.setItem(
        FLASH_KEY,
        JSON.stringify({
          reportId: body.report_id,
          accessToken: body.access_token,
          outcome: {
            service_step: body.service_step ?? "ai_review_pending",
            triage_status: body.triage_status ?? "pending",
            routing_destination: body.routing_destination ?? null,
            category: body.category ?? null,
            severity: body.severity ?? null,
            priority: body.priority ?? null,
            summary: body.summary ?? null,
            recommendation: body.recommendation ?? null,
            playbook_id: body.playbook_id ?? null,
            can_escalate: body.can_escalate ?? false,
            guidance_script: body.guidance_script ?? null,
            guidance_status: body.guidance_status ?? null,
            allowed_actions: body.allowed_actions ?? [],
            prohibited_actions: body.prohibited_actions ?? [],
          } satisfies CitizenTriageOutcomeData,
        }),
      );

      router.push("/report/success");
    } catch {
      setError(t("submitError"));
    } finally {
      setSubmitting(false);
    }
  }

  const sendDisabled = aiDown || sending || !draft.trim() || !reportId;

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm md:p-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {aiDown ? (
        <Alert className="border-amber-500/40 bg-amber-50 text-amber-900">
          <AlertDescription>{t("aiDown")}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      ) : (
        <div
          className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border bg-muted/30 p-3"
          role="log"
          aria-live="polite"
          aria-label={t("messageLogLabel")}
        >
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          ) : (
            messages.map((message) => (
              <div
                key={message.message_id}
                className={
                  message.role === "user"
                    ? "ml-8 rounded-lg bg-primary/10 px-3 py-2 text-sm"
                    : "mr-8 rounded-lg bg-background px-3 py-2 text-sm"
                }
              >
                {message.content}
              </div>
            ))
          )}
        </div>
      )}

      <form onSubmit={onSend} className="space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("placeholder")}
          className="min-h-24"
          disabled={sendDisabled || loading}
          maxLength={4000}
          aria-label={t("inputLabel")}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={sendDisabled || loading}>
            {sending ? t("sending") : t("send")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={!canSubmit}
            onClick={() => void onSubmitReport()}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                {t("submitting")}
              </>
            ) : (
              t("submitReport")
            )}
          </Button>
        </div>
      </form>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
