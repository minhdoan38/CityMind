"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRightLeft,
  CircleAlert,
  ExternalLink,
  Loader2,
  Trash2,
} from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  reportId: string;
  onOpenDetail: (reportId: string) => void;
  onReportDeleted?: (reportId: string) => void;
  children: ReactNode;
};

function dialogSectionStyle(index: number): CSSProperties {
  return { "--preview-i": index } as CSSProperties;
}

export default function ReportRowContextMenu({
  reportId,
  onOpenDetail,
  onReportDeleted,
  children,
}: Props) {
  const router = useRouter();
  const t = useTranslations("dashboard");
  const tr = useTranslations("dashboard.routing");
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferError, setTransferError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function confirmTransfer() {
    setTransferLoading(true);
    setTransferError("");
    try {
      const res = await fetch(`/api/officer/reports/${reportId}/routing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "escalate_to_government" }),
      });
      if (!res.ok) {
        setTransferError(tr("overrideEscalateError"));
        return;
      }
      setTransferOpen(false);
      router.refresh();
    } catch {
      setTransferError(tr("overrideEscalateError"));
    } finally {
      setTransferLoading(false);
    }
  }

  async function confirmDelete() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      const res = await fetch(`/api/officer/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setDeleteError(t("contextDeleteError"));
        return;
      }
      setDeleteOpen(false);
      onReportDeleted?.(reportId);
      router.refresh();
    } catch {
      setDeleteError(t("contextDeleteError"));
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-52">
          <ContextMenuItem onSelect={() => onOpenDetail(reportId)}>
            <ExternalLink className="size-4" />
            {t("contextOpenDetail")}
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => setTransferOpen(true)}>
            <ArrowRightLeft className="size-4" />
            {t("contextTransferCase")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            variant="destructive"
            onSelect={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-4" />
            {t("contextDeleteCase")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr("overrideEscalateConfirmTitle")}</DialogTitle>
            <DialogDescription>{tr("overrideEscalateConfirmBody")}</DialogDescription>
          </DialogHeader>
          {transferError ? (
            <p className="text-sm text-destructive">{transferError}</p>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransferOpen(false)}
              disabled={transferLoading}
            >
              {tr("overrideEscalateCancel")}
            </Button>
            <Button
              type="button"
              disabled={transferLoading}
              onClick={() => void confirmTransfer()}
            >
              {tr("overrideEscalateConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (deleteLoading) return;
          setDeleteOpen(open);
          if (!open) setDeleteError("");
        }}
      >
        <DialogContent
          className="gap-0 overflow-hidden p-0 sm:max-w-md"
          aria-busy={deleteLoading}
        >
          <div className="space-y-4 px-5 pb-4 pt-5">
            <DialogHeader className="text-left">
              <div
                className="preview-section-rise flex items-start gap-3"
                style={dialogSectionStyle(0)}
              >
                <div
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                  aria-hidden
                >
                  <Trash2 className="size-5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 space-y-1">
                  <DialogTitle className="text-lg font-semibold text-balance">
                    {t("contextDeleteConfirmTitle")}
                  </DialogTitle>
                  <DialogDescription className="text-pretty">
                    {t("contextDeleteConfirmLead")}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div
              className="preview-section-rise rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-3"
              style={dialogSectionStyle(1)}
            >
              <p className="text-sm leading-relaxed text-foreground text-pretty">
                {t("contextDeleteConfirmBody")}
              </p>
            </div>

            <div
              className="preview-section-rise space-y-1.5 rounded-lg border border-border bg-muted/30 px-3.5 py-3"
              style={dialogSectionStyle(2)}
            >
              <p className="text-xs font-medium leading-none text-muted-foreground">
                {t("colReportId")}
              </p>
              <p className="break-all font-mono text-xs leading-relaxed text-foreground">
                {reportId}
              </p>
            </div>

            {deleteError ? (
              <Alert
                variant="destructive"
                className="preview-section-rise"
                style={dialogSectionStyle(3)}
              >
                <CircleAlert aria-hidden />
                <AlertTitle className="text-sm font-medium leading-snug">
                  {deleteError}
                </AlertTitle>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="mx-0 mb-0 gap-2 border-t bg-muted/30 px-5 py-4 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              {t("contextDeleteCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-10"
              disabled={deleteLoading}
              onClick={() => void confirmDelete()}
            >
              {deleteLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t("contextDeleteInProgress")}
                </>
              ) : (
                t("contextDeleteConfirm")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
