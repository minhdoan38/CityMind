"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  reportId: string;
};

export default function RoutingOverrideActions({ reportId }: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard.routing");
  const td = useTranslations("dashboard");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [confirmEscalate, setConfirmEscalate] = useState(false);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [note, setNote] = useState("");

  async function postAction(
    action: "escalate_to_government" | "mark_resolved",
    actionNote?: string,
  ) {
    setLoading(action);
    setError("");

    try {
      const res = await fetch(`/api/officer/reports/${reportId}/routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: actionNote }),
      });
      if (!res.ok) {
        setError(
          action === "escalate_to_government"
            ? t("overrideEscalateError")
            : td("statusUpdateFailed"),
        );
        return;
      }
      setConfirmEscalate(false);
      setResolveOpen(false);
      setNote("");
      router.refresh();
    } catch {
      setError(t("overrideEscalateError"));
    } finally {
      setLoading("");
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-border p-6">
      <h2 className="text-xl font-semibold text-foreground">{t("overrideSectionTitle")}</h2>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={Boolean(loading)}
          onClick={() => setConfirmEscalate(true)}
        >
          {t("overrideEscalate")}
        </Button>
        <Button
          type="button"
          className="min-h-11"
          disabled={Boolean(loading)}
          onClick={() => setResolveOpen(true)}
        >
          {t("overrideResolve")}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Dialog open={confirmEscalate} onOpenChange={setConfirmEscalate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("overrideEscalateConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("overrideEscalateConfirmBody")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmEscalate(false)}
            >
              {t("overrideEscalateCancel")}
            </Button>
            <Button
              type="button"
              disabled={loading === "escalate_to_government"}
              onClick={() => void postAction("escalate_to_government")}
            >
              {t("overrideEscalateConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resolveOpen} onOpenChange={setResolveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{td("confirmResolve")}</DialogTitle>
            <DialogDescription>{td("noteRequired")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="routing-resolve-note">{td("noteLabel")}</Label>
            <Textarea
              id="routing-resolve-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={td("notePlaceholder")}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setResolveOpen(false)}>
              {td("dialogDismiss")}
            </Button>
            <Button
              type="button"
              disabled={loading === "mark_resolved" || !note.trim()}
              onClick={() => void postAction("mark_resolved", note.trim())}
            >
              {td("confirmResolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
