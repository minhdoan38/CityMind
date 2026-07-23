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
  currentStatus?: string;
  /** Full-width vertical stack for report detail aside */
  stacked?: boolean;
};

type PendingStatus = "resolved" | "rejected";

export default function StatusActions({
  reportId,
  currentStatus,
  stacked = false,
}: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [pendingStatus, setPendingStatus] = useState<PendingStatus | null>(
    null,
  );
  const [note, setNote] = useState("");

  async function updateStatus(status: string, decisionNote?: string) {
    setLoading(status);
    setError("");

    const url = new URL(
      `/api/officer/reports/${reportId}/status`,
      window.location.origin,
    );
    url.searchParams.set("status", status);
    if (decisionNote !== undefined) {
      url.searchParams.set("note", decisionNote);
    }

    try {
      const res = await fetch(url.toString(), { method: "PATCH" });
      if (res.status === 422) {
        setNoteError(t("noteRequired"));
        setError("");
        return;
      }
      if (!res.ok) {
        setError(t("statusUpdateFailed"));
        return;
      }
      setPendingStatus(null);
      setNote("");
      setNoteError("");
      router.refresh();
    } catch {
      setError(t("statusUpdateFailed"));
    } finally {
      setLoading("");
    }
  }

  function openConfirm(status: PendingStatus) {
    setPendingStatus(status);
    setNote("");
    setNoteError("");
    setError("");
  }

  function keepEditing() {
    setPendingStatus(null);
    setNote("");
    setNoteError("");
  }

  function confirmDecision() {
    if (!pendingStatus) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setNoteError(t("noteRequired"));
      return;
    }
    void updateStatus(pendingStatus, trimmed);
  }

  const dialogOpen = pendingStatus !== null;
  const isReject = pendingStatus === "rejected";

  return (
    <div className={stacked ? "reports-detail-actions" : "mt-4 space-y-3"}>
      <div
        className={
          stacked
            ? "reports-detail-actions__buttons"
            : "flex flex-wrap gap-2"
        }
      >
        <Button
          type="button"
          variant="default"
          className={stacked ? "reports-detail-action-btn" : "min-h-11 rounded-lg"}
          disabled={Boolean(loading) || currentStatus === "reviewing"}
          onClick={() => void updateStatus("reviewing")}
        >
          {loading === "reviewing" ? t("statusUpdating") : t("markReviewing")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={
            stacked ? "reports-detail-action-btn" : "min-h-11 rounded-lg"
          }
          disabled={Boolean(loading) || currentStatus === "resolved"}
          onClick={() => openConfirm("resolved")}
        >
          {t("markResolved")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className={
            stacked
              ? "reports-detail-action-btn reports-detail-action-btn--destructive"
              : "min-h-11 rounded-lg text-destructive hover:text-destructive"
          }
          disabled={Boolean(loading) || currentStatus === "rejected"}
          onClick={() => openConfirm("rejected")}
        >
          {t("markRejected")}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) keepEditing();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isReject ? t("dialogRejectTitle") : t("dialogResolveTitle")}
            </DialogTitle>
            <DialogDescription>{t("noteLabel")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="decision-note">{t("noteLabel")}</Label>
            <Textarea
              id="decision-note"
              aria-required
              placeholder={t("notePlaceholder")}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                if (noteError) setNoteError("");
              }}
              className="min-h-24"
            />
            {noteError && (
              <p role="alert" className="text-sm text-destructive">
                {noteError}
              </p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={keepEditing}
              disabled={Boolean(loading)}
            >
              {t("dialogDismiss")}
            </Button>
            <Button
              type="button"
              variant={isReject ? "destructive" : "default"}
              className="min-h-11"
              onClick={confirmDecision}
              disabled={Boolean(loading)}
            >
              {loading === pendingStatus
                ? t("statusUpdating")
                : isReject
                  ? t("confirmReject")
                  : t("confirmResolve")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
