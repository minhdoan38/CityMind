"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CoachMessage = {
  message_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type Props = {
  reportId: string;
  accessToken: string;
  disabled?: boolean;
  onEscalate?: () => void;
};

export default function CoachPanel({
  reportId,
  accessToken,
  disabled = false,
  onEscalate,
}: Props) {
  const t = useTranslations("public.coach");
  const tr = useTranslations("public.routing");
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiDown, setAiDown] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const healthRes = await fetch("/api/health/ai");
        if (healthRes.ok) {
          const health = (await healthRes.json()) as { status?: string };
          if (!cancelled) {
            setAiDown(health.status === "down");
          }
        }

        const params = new URLSearchParams({
          report_id: reportId,
          token: accessToken,
        });
        const res = await fetch(`/api/public/reports/coach/messages?${params.toString()}`);
        if (!res.ok) {
          if (!cancelled) setError(t("loadError"));
          return;
        }
        const data = (await res.json()) as { messages?: CoachMessage[] };
        if (!cancelled) {
          setMessages(Array.isArray(data.messages) ? data.messages : []);
        }
      } catch {
        if (!cancelled) setError(t("loadError"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [reportId, accessToken, t]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || disabled || aiDown) return;

    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/public/reports/coach/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_id: reportId, token: accessToken, message }),
      });
      if (!res.ok) {
        setError(t("sendError"));
        return;
      }
      const data = (await res.json()) as { messages?: CoachMessage[] };
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setDraft("");
    } catch {
      setError(t("sendError"));
    } finally {
      setSending(false);
    }
  }

  const sendDisabled = disabled || aiDown || sending || !draft.trim();

  return (
    <section className="space-y-4 rounded-lg border border-border bg-card p-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{t("title")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {aiDown ? (
        <Alert className="border-amber-500/40 bg-amber-50 text-amber-900">
          <AlertDescription>{t("aiDownWarning")}</AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("loading")}
        </div>
      ) : (
        <div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
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

      <form onSubmit={onSubmit} className="space-y-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("inputPlaceholder")}
          className="min-h-24"
          disabled={sendDisabled}
          maxLength={4000}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="min-h-11" disabled={sendDisabled}>
            {sending ? t("sending") : t("send")}
          </Button>
          {onEscalate ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={onEscalate}>
              {tr("escalateCta")}
            </Button>
          ) : null}
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
