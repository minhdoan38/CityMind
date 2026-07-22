"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUp, Loader2, Mic, Paperclip, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import WidgetCard from "./WidgetCard";

type ChatMessage = {
  message_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type AiHealthStatus = "up" | "degraded" | "down" | "unknown";

type Props = {
  delayClass?: string;
  contextReportId?: string;
};

export default function AdvisoryAssistantWidget({
  delayClass,
  contextReportId,
}: Props) {
  const t = useTranslations("dashboard.widgets");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachedReportId, setAttachedReportId] = useState<string | null>(
    contextReportId?.trim() || null,
  );
  const [attachDraft, setAttachDraft] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiHealthStatus>("unknown");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/health/ai");
      if (!res.ok) {
        setAiStatus("down");
        return;
      }
      const body = (await res.json()) as { status?: AiHealthStatus };
      setAiStatus(body.status ?? "down");
    } catch {
      setAiStatus("down");
    }
  }, []);

  const loadMessages = useCallback(async () => {
    setIsLoadingHistory(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/officer/assistant/messages");
      if (!res.ok) {
        setLoadError(t("assistantLoadError"));
        return;
      }
      const body = (await res.json()) as { messages?: ChatMessage[] };
      setMessages(Array.isArray(body.messages) ? body.messages : []);
    } catch {
      setLoadError(t("assistantLoadError"));
    } finally {
      setIsLoadingHistory(false);
    }
  }, [t]);

  useEffect(() => {
    void refreshHealth();
    void loadMessages();
    const timer = window.setInterval(() => {
      void refreshHealth();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadMessages, refreshHealth]);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [messages, isSending]);

  const aiUnavailable = aiStatus === "down";
  const aiDegraded = aiStatus === "degraded";
  const canSend = query.trim().length > 0 && !isSending && !aiUnavailable;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const message = query.trim();
    if (!message || isSending || aiUnavailable) {
      return;
    }

    setError(null);
    setIsSending(true);
    const previousMessages = messages;
    const previousQuery = query;
    setQuery("");

    const optimisticUser: ChatMessage = {
      message_id: `optimistic-user-${Date.now()}`,
      role: "user",
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages([...previousMessages, optimisticUser]);

    try {
      const payload: { message: string; report_id?: string } = { message };
      if (attachedReportId) {
        payload.report_id = attachedReportId;
      }

      const res = await fetch("/api/officer/assistant/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = (await res.json().catch(() => ({}))) as {
        assistant_message?: ChatMessage;
        messages?: ChatMessage[];
        detail?: string;
      };

      if (!res.ok) {
        setMessages(previousMessages);
        setQuery(previousQuery);
        setError(body.detail ?? t("assistantError"));
        return;
      }

      if (Array.isArray(body.messages) && body.messages.length > 0) {
        setMessages(body.messages);
        return;
      }

      const reply = body.assistant_message;
      if (!reply?.content?.trim()) {
        setMessages(previousMessages);
        setQuery(previousQuery);
        setError(t("assistantError"));
        return;
      }

      setMessages([
        ...previousMessages,
        optimisticUser,
        {
          message_id: reply.message_id || `optimistic-assistant-${Date.now()}`,
          role: "assistant",
          content: reply.content,
          created_at: reply.created_at || new Date().toISOString(),
        },
      ]);
    } catch {
      setMessages(previousMessages);
      setQuery(previousQuery);
      setError(t("assistantError"));
    } finally {
      setIsSending(false);
    }
  }

  function confirmAttach() {
    const next = attachDraft.trim();
    if (!next) {
      return;
    }
    setAttachedReportId(next);
    setAttachDraft("");
    setAttachOpen(false);
  }

  return (
    <WidgetCard title={t("assistantTitle")} delayClass={delayClass}>
      <div className="flex min-h-[280px] flex-col gap-4" aria-label={t("assistantTitle")}>
        {isLoadingHistory ? (
          <div className="flex min-h-24 items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            {t("assistantLoading")}
          </div>
        ) : messages.length === 0 ? (
          <div className="relative flex h-24 w-full shrink-0 items-center justify-center">
            <div
              aria-hidden
              className="assistant-orbit absolute size-24 rounded-full border border-dashed border-primary/25"
            />
            <div aria-hidden className="assistant-sphere size-16 rounded-full" />
          </div>
        ) : (
          <div
            ref={threadRef}
            className="flex max-h-40 min-h-24 flex-col gap-2 overflow-y-auto pr-1"
            aria-live="polite"
            aria-relevant="additions"
          >
            {messages.map((turn) => (
              <div
                key={turn.message_id}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs leading-relaxed",
                  turn.role === "user"
                    ? "ml-6 bg-primary/10 text-foreground"
                    : "mr-4 bg-muted text-muted-foreground",
                )}
              >
                {turn.content}
              </div>
            ))}
            {isSending ? (
              <div className="mr-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" aria-hidden />
                {t("assistantThinking")}
              </div>
            ) : null}
          </div>
        )}

        {aiDegraded ? (
          <Alert className="border-amber-500/40 bg-amber-50 text-amber-900">
            <AlertDescription>{t("assistantDegradedWarning")}</AlertDescription>
          </Alert>
        ) : (
          <p
            className={cn(
              "text-center text-xs leading-relaxed text-muted-foreground",
              aiStatus === "unknown" && "opacity-70",
            )}
          >
            {aiUnavailable ? t("assistantUnavailable") : t("assistantDisclaimer")}
          </p>
        )}

        {loadError ? (
          <p className="text-center text-xs text-muted-foreground">{loadError}</p>
        ) : null}

        {error ? (
          <p className="text-center text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {attachedReportId ? (
          <div className="flex justify-center">
            <Badge variant="secondary" className="gap-1 pr-1">
              {t("assistantAttachedReport", { reportId: attachedReportId })}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-5"
                aria-label={t("assistantDetach")}
                onClick={() => setAttachedReportId(null)}
              >
                <X className="size-3" />
              </Button>
            </Badge>
          </div>
        ) : null}

        <form
          className="mt-auto flex w-full items-center gap-2 rounded-full border border-border bg-muted/50 p-1.5 pl-3"
          onSubmit={handleSubmit}
        >
          <Popover open={attachOpen} onOpenChange={setAttachOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 shrink-0 rounded-full text-muted-foreground"
                aria-label={t("assistantAttach")}
                disabled={isSending || aiUnavailable}
              >
                <Paperclip className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-72 space-y-3">
              <p className="text-sm font-medium">{t("assistantAttachPick")}</p>
              <Input
                value={attachDraft}
                onChange={(event) => setAttachDraft(event.target.value)}
                placeholder={t("assistantAttachEmpty")}
              />
              <Button type="button" size="sm" onClick={confirmAttach} disabled={!attachDraft.trim()}>
                {t("assistantAttach")}
              </Button>
            </PopoverContent>
          </Popover>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("assistantPlaceholder")}
            className="min-h-9 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
            aria-describedby="assistant-hint"
            disabled={isSending || aiUnavailable}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 rounded-full text-muted-foreground"
            aria-label={t("assistantVoice")}
            disabled
            title={t("assistantVoiceSoon")}
          >
            <Mic className="size-4" />
          </Button>
          <Button
            type="submit"
            size="icon"
            className="size-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            aria-label={t("assistantSend")}
            disabled={!canSend}
          >
            {isSending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </form>
        <p id="assistant-hint" className="sr-only">
          {aiUnavailable ? t("assistantUnavailable") : t("assistantHint")}
        </p>
      </div>
    </WidgetCard>
  );
}
