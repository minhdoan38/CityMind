"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Columns3,
  Eye,
  FileText,
  Flag,
  Gauge,
  MapPin,
  Sparkles,
  Tag,
  LayoutGrid,
  Download,
  Keyboard,
  RotateCcw,
  Percent,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  encodeTriageBucketCursor,
  parseTriageBucketOffset,
} from "@/lib/report-pagination";
import { cn } from "@/lib/utils";
import { reportRowSurfaceTone } from "@/lib/report-row-urgency";

import TriageStatusBadge from "./TriageStatusBadge";
import TriageDispatchActions, {
  type TriageDispatchResult,
} from "./TriageDispatchActions";
import RoutingDestinationBadge from "./RoutingDestinationBadge";
import ShadowMismatchBadge from "./ShadowMismatchBadge";
import ReportThumbnail from "./ReportThumbnail";
import ReportQuickPreviewSheet from "./ReportQuickPreviewSheet";
import ReportRowContextMenu from "./ReportRowContextMenu";
import {
  ReportAgeSla,
  ReportConfidenceChip,
  ReportPriorityBadge,
  ReportRowQuickActions,
  ReportSeverityBadge,
  ReportStatusBadge,
} from "./ReportUrgencyCells";
import ReportBulkCheckbox from "./ReportBulkCheckbox";
import TriageOutcomeAnnouncer, {
  type TriageOutcomeMessage,
} from "./TriageOutcomeAnnouncer";
import {
  formatReportIdForList,
  formatReportIdTail,
  formatCategoryLabel,
  normalizeBulkSkipReason,
  parseBulkTriageResult,
  readTriageErrorDetail,
  triageFieldPlaceholderKey,
  type BulkSkipReason,
} from "./triage-field-display";
import {
  FILTER_PARAM_KEYS,
  type DashboardSearchParams,
  type ReportRow,
} from "./types";

const COLUMN_VISIBILITY_KEY = "citymind.dashboard.columnVisibility";
const COLUMN_SIZING_KEY = "citymind.dashboard.columnSizing";
const COLUMN_RESIZE_STEP = 16;

const COLUMN_ICONS: Record<string, LucideIcon> = {
  triage_status: Sparkles,
  routing_destination: MapPin,
  has_shadow_disagreement: Eye,
  created_at: Calendar,
  category: Tag,
  priority: Flag,
  status: CircleDot,
  severity: Gauge,
  urgency: Gauge,
  confidence: Percent,
  summary: FileText,
};

function columnIcon(columnId: string): LucideIcon {
  return COLUMN_ICONS[columnId] ?? Columns3;
}

const SORTABLE = new Set(["created_at", "priority", "status", "category"]);

const REPORT_COLUMN_ID = "report";
const TRIAGE_COLUMN_ID = "triage_status";
const CREATED_COLUMN_ID = "created_at";
const ACTIONS_COLUMN_ID = "triage_actions";
const BULK_ELIGIBLE = new Set(["pending", "failed", "retry"]);
const BULK_MAX = 25;

function reportColumnClass(): string {
  return "w-[9.5rem] max-w-[10rem] px-2";
}

function triageColumnClass(compact: boolean): string {
  return compact
    ? "w-[6.75rem] max-w-[7.5rem] px-2 text-xs"
    : "px-4";
}

function createdColumnClass(compact: boolean): string {
  return compact
    ? "w-[5.75rem] max-w-[6.75rem] px-2 text-xs tabular-nums"
    : "px-4";
}

const SELECT_COLUMN_ID = "select";
const URGENCY_COLUMN_ID = "urgency";
const CONFIDENCE_COLUMN_ID = "confidence";

function selectColumnClass(): string {
  return "w-10 max-w-10 px-0 text-center align-middle [&_.dash-bulk-checkbox-host]:mx-auto";
}

function urgencyColumnClass(): string {
  return "w-11 max-w-11 px-1.5 text-center";
}

function confidenceColumnClass(compact: boolean): string {
  return compact ? "w-[4.5rem] max-w-[5rem] px-2 text-xs" : "px-3";
}

function compactColumnClass(columnId: string): string | undefined {
  if (columnId === SELECT_COLUMN_ID) return selectColumnClass();
  if (columnId === URGENCY_COLUMN_ID) return urgencyColumnClass();
  if (columnId === CONFIDENCE_COLUMN_ID) return confidenceColumnClass(true);
  if (columnId === REPORT_COLUMN_ID) return reportColumnClass();
  if (columnId === TRIAGE_COLUMN_ID) return triageColumnClass(true);
  if (columnId === CREATED_COLUMN_ID) return createdColumnClass(true);
  return undefined;
}

function isRowInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      "button, a, input, textarea, select, [role='checkbox'], [data-stop-row-click]",
    ),
  );
}

function resizeColumnByKeyboard(
  event: React.KeyboardEvent,
  columnId: string,
  currentSize: number,
  minSize: number,
  maxSize: number,
  setColumnSizing: React.Dispatch<React.SetStateAction<ColumnSizingState>>,
): void {
  const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
  if (direction === 0) return;

  event.preventDefault();
  const multiplier = event.shiftKey ? 2 : 1;
  const nextSize = Math.min(
    maxSize,
    Math.max(
      minSize,
      currentSize + direction * COLUMN_RESIZE_STEP * multiplier,
    ),
  );
  setColumnSizing((current) => ({ ...current, [columnId]: nextSize }));
}

type Props = {
  rows: ReportRow[];
  nextCursor: string | null;
  params: DashboardSearchParams;
  filtersActive: boolean;
  embedded?: boolean;
  totalCount?: number | null;
};

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function TriageFieldText({
  value,
  triageStatus,
  className,
  placeholderClassName,
}: {
  value: string;
  triageStatus: string;
  className?: string;
  placeholderClassName?: string;
}) {
  const tt = useTranslations("dashboard.triage");
  const placeholderKey = triageFieldPlaceholderKey(triageStatus, value);

  if (!placeholderKey) {
    return <span className={className}>{value.trim()}</span>;
  }

  const copyByKey = {
    pending: tt("cellPending"),
    processing: tt("cellProcessing"),
    failed: tt("cellFailed"),
    manualReview: tt("cellManualReview"),
    empty: tt("cellEmpty"),
  } as const;

  return (
    <span className={cn("text-muted-foreground", placeholderClassName, className)}>
      {copyByKey[placeholderKey]}
    </span>
  );
}

export default function ReportsTable({
  rows,
  nextCursor,
  params,
  filtersActive,
  embedded = false,
  totalCount = null,
}: Props) {
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const tr = useTranslations("dashboard.routing");
  const te = useTranslations("empty");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    severity: false,
    confidence: true,
  });
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkLoading, setBulkLoading] = useState(false);
  const [outcome, setOutcome] = useState<TriageOutcomeMessage | null>(null);
  const outcomeSeq = useRef(0);
  const [previewReport, setPreviewReport] = useState<ReportRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectWaveId, setSelectWaveId] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [density, setDensity] = useState<"comfortable" | "compact" | "dense">("comfortable");
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const selectRowRange = (startIndex: number, endIndex: number) => {
    const min = Math.min(startIndex, endIndex);
    const max = Math.max(startIndex, endIndex);
    setRowSelection((prev) => {
      const next = { ...prev };
      for (let i = min; i <= max; i++) {
        const r = rows[i];
        if (r && BULK_ELIGIBLE.has(r.triage_status)) {
          next[r.report_id] = true;
        }
      }
      return next;
    });
  };

  const handleResetLayout = () => {
    try {
      localStorage.removeItem("citymind.dashboard.columnOrder");
      localStorage.removeItem("citymind.dashboard.columnVisibility");
      localStorage.removeItem("citymind.dashboard.density");
      localStorage.removeItem(COLUMN_SIZING_KEY);
    } catch {
      /* ignore */
    }
    setColumnOrder(columns.map((c) => c.id || (c.accessorKey as string)).filter(Boolean));
    setColumnSizing({});
    setColumnVisibility({ severity: false, confidence: true });
    setDensity("comfortable");
  };

  const handleExportCsv = () => {
    const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
    const targetRows = selectedRows.length > 0 ? selectedRows : rows;

    if (targetRows.length === 0) return;

    const headers = [
      "report_id",
      "created_at",
      "category",
      "priority",
      "status",
      "severity",
      "triage_status",
      "routing_destination",
      "summary",
    ];
    const csvRows = [headers.join(",")];

    for (const r of targetRows) {
      const values = [
        `"${r.report_id}"`,
        `"${r.created_at}"`,
        `"${r.category || ""}"`,
        `"${r.priority || ""}"`,
        `"${r.status || ""}"`,
        `"${r.severity ?? ""}"`,
        `"${r.triage_status || ""}"`,
        `"${r.routing_destination || ""}"`,
        `"${(r.summary || "").replace(/"/g, '""')}"`,
      ];
      csvRows.push(values.join(","));
    }

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `citymind_reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Initialize density and column order on hydration
  useEffect(() => {
    try {
      const savedDensity = localStorage.getItem("citymind.dashboard.density");
      if (savedDensity === "comfortable" || savedDensity === "compact" || savedDensity === "dense") {
        setDensity(savedDensity);
      }
      const savedOrder = localStorage.getItem("citymind.dashboard.columnOrder");
      if (savedOrder) {
        setColumnOrder(JSON.parse(savedOrder));
      }
      const savedSizing = localStorage.getItem(COLUMN_SIZING_KEY);
      if (savedSizing) {
        setColumnSizing(JSON.parse(savedSizing));
      }
    } catch {
      /* ignore storage read error */
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLUMN_SIZING_KEY, JSON.stringify(columnSizing));
    } catch {
      /* ignore quota */
    }
  }, [columnSizing, hydrated]);

  const changeDensity = (value: "comfortable" | "compact" | "dense") => {
    setDensity(value);
    try {
      localStorage.setItem("citymind.dashboard.density", value);
    } catch {
      /* ignore */
    }
  };

  const persistColumnOrder = (newOrder: string[]) => {
    setColumnOrder(newOrder);
    try {
      localStorage.setItem("citymind.dashboard.columnOrder", JSON.stringify(newOrder));
    } catch {
      /* ignore */
    }
  };

  const handleDragStart = (e: React.DragEvent, columnId: string) => {
    if (
      columnId === SELECT_COLUMN_ID ||
      columnId === URGENCY_COLUMN_ID ||
      columnId === ACTIONS_COLUMN_ID
    ) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData("text/plain", columnId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    if (
      columnId === SELECT_COLUMN_ID ||
      columnId === URGENCY_COLUMN_ID ||
      columnId === ACTIONS_COLUMN_ID
    )
      return;
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, targetColumnId: string) => {
    if (
      targetColumnId === SELECT_COLUMN_ID ||
      targetColumnId === URGENCY_COLUMN_ID ||
      targetColumnId === ACTIONS_COLUMN_ID
    )
      return;
    const dragColumnId = e.dataTransfer.getData("text/plain");
    if (!dragColumnId || dragColumnId === targetColumnId) return;

    const newOrder = [...columnOrder];
    const dragIdx = newOrder.indexOf(dragColumnId);
    const targetIdx = newOrder.indexOf(targetColumnId);

    if (dragIdx !== -1 && targetIdx !== -1) {
      newOrder.splice(dragIdx, 1);
      newOrder.splice(targetIdx, 0, dragColumnId);
      persistColumnOrder(newOrder);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (rows.length === 0) return;

    if (e.key === "?" || e.key === "/") {
      e.preventDefault();
      setShortcutsOpen(true);
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedRowIndex((prev) => {
        const nextIndex = prev === null ? 0 : Math.min(prev + 1, rows.length - 1);
        if (e.shiftKey && prev !== null) {
          selectRowRange(lastSelectedIndex ?? prev, nextIndex);
        }
        return nextIndex;
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedRowIndex((prev) => {
        const nextIndex = prev === null ? 0 : Math.max(prev - 1, 0);
        if (e.shiftKey && prev !== null) {
          selectRowRange(lastSelectedIndex ?? prev, nextIndex);
        }
        return nextIndex;
      });
    } else if (e.key === "Space" || e.key === " ") {
      if (focusedRowIndex !== null) {
        const row = rows[focusedRowIndex];
        if (BULK_ELIGIBLE.has(row.triage_status)) {
          e.preventDefault();
          setRowSelection((prev) => {
            const next = { ...prev };
            if (next[row.report_id]) {
              delete next[row.report_id];
            } else {
              next[row.report_id] = true;
            }
            return next;
          });
          setLastSelectedIndex(focusedRowIndex);
        }
      }
    } else if (e.key === "Enter") {
      if (focusedRowIndex !== null) {
        e.preventDefault();
        openPreview(rows[focusedRowIndex]);
      }
    } else if (e.key === "Escape") {
      if (shortcutsOpen) {
        setShortcutsOpen(false);
      } else if (sheetOpen) {
        setSheetOpen(false);
      } else {
        setRowSelection({});
      }
    }
  };

  const announceOutcome = useCallback((text: string, tone: TriageOutcomeMessage["tone"]) => {
    outcomeSeq.current += 1;
    setOutcome({ id: outcomeSeq.current, text, tone });
  }, []);

  const dismissOutcome = useCallback(() => {
    setOutcome(null);
  }, []);

  const handleTriageResult = useCallback(
    (result: TriageDispatchResult) => {
      announceOutcome(result.message, result.ok ? "success" : "error");
    },
    [announceOutcome],
  );

  const skipReasonLabel = useCallback(
    (reason: BulkSkipReason) => {
      switch (reason) {
        case "already_completed":
          return tt("skipAlreadyCompleted");
        case "ineligible_status":
          return tt("skipIneligible");
        case "not_found":
          return tt("skipNotFound");
        case "lookup_failed":
          return tt("skipLookupFailed");
        case "reset_failed":
          return tt("skipResetFailed");
        default:
          return tt("skipOther");
      }
    },
    [tt],
  );

  const formatBulkSkippedSummary = useCallback(
    (skipped: Array<{ id: string; reason: string }>) => {
      if (skipped.length === 0) return "";
      const counts = new Map<BulkSkipReason, number>();
      for (const item of skipped) {
        const key = normalizeBulkSkipReason(item.reason);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      const parts = [...counts.entries()].map(([reason, count]) =>
        tt("skipReasonCount", { reason: skipReasonLabel(reason), count }),
      );
      return tt("bulkSkippedSummary", {
        count: skipped.length,
        reasons: parts.join(tt("skipReasonJoiner")),
      });
    },
    [skipReasonLabel, tt],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VisibilityState;
        setColumnVisibility({ severity: false, confidence: true, ...parsed });
      }
    } catch {
      /* ignore corrupt preference */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(COLUMN_VISIBILITY_KEY, JSON.stringify(columnVisibility));
    } catch {
      /* ignore quota */
    }
  }, [columnVisibility, hydrated]);

  useEffect(() => {
    if (selectWaveId === 0) return;
    const duration = 280 + rows.length * 42;
    const timer = window.setTimeout(() => setSelectWaveId(0), duration);
    return () => window.clearTimeout(timer);
  }, [selectWaveId, rows.length]);

  const sorting: SortingState = useMemo(() => {
    const id = params.sort ?? "triage_bucket";
    return [{ id, desc: (params.order ?? "asc") !== "asc" }];
  }, [params.sort, params.order]);

  const openPreview = useCallback((report: ReportRow) => {
    setPreviewReport(report);
    setSheetOpen(true);
  }, []);

  const goToDetail = useCallback(
    (reportId: string) => {
      setSheetOpen(false);
      router.push(`/dashboard/reports/${encodeURIComponent(reportId)}`);
    },
    [router],
  );

  function columnLabel(columnId: string): string {
    switch (columnId) {
      case "report":
        return t("colReport");
      case "triage_status":
        return tt("columnHeader");
      case "routing_destination":
        return tr("columnHeader");
      case "has_shadow_disagreement":
        return t("colShadow");
      case "created_at":
        return t("colAgeSla");
      case URGENCY_COLUMN_ID:
        return t("colSeverity");
      case CONFIDENCE_COLUMN_ID:
        return t("colConfidence");
      case "category":
        return t("colCategory");
      case "priority":
        return t("colPriority");
      case "status":
        return t("colStatus");
      case "severity":
        return t("colSeverity");
      case "summary":
        return t("colSummary");
      case ACTIONS_COLUMN_ID:
        return tt("runNow");
      default:
        return columnId;
    }
  }

  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () => [
      {
        id: SELECT_COLUMN_ID,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: ({ table: tableInstance }) => (
          <ReportBulkCheckbox
            checked={
              tableInstance.getIsAllPageRowsSelected()
                ? true
                : tableInstance.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => {
              if (value) {
                setSelectWaveId((id) => id + 1);
              }
              tableInstance.toggleAllPageRowsSelected(value);
            }}
            aria-label={tt("bulkSelectAll")}
            onClick={(event) => event.stopPropagation()}
            data-stop-row-click=""
          />
        ),
        cell: ({ row }) => (
          <ReportBulkCheckbox
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onCheckedChange={(value) => row.toggleSelected(value)}
            aria-label={tt("bulkSelectRow")}
            staggerIndex={row.index}
            selectWaveId={selectWaveId}
            onClick={(event) => event.stopPropagation()}
            data-stop-row-click=""
          />
        ),
      },
      {
        id: URGENCY_COLUMN_ID,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: t("colSeverity"),
        cell: ({ row }) => (
          <ReportSeverityBadge
            severity={row.original.severity}
            triageStatus={row.original.triage_status}
            compact
          />
        ),
      },
      {
        id: REPORT_COLUMN_ID,
        accessorKey: "report_id",
        header: t("colReport"),
        size: 200,
        maxSize: 280,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => {
          const { report_id, evidence_path, category, triage_status, summary } =
            row.original;
          const { display: idDisplay, full: idFull } =
            formatReportIdForList(report_id);
          const { display: idTail } = formatReportIdTail(report_id);
          const summaryReady =
            triageFieldPlaceholderKey(triage_status, summary) === null;
          const categoryLabel = formatCategoryLabel(category);
          const summaryText = summary.trim();

          let primaryLabel: string;
          let secondaryId: string | null = null;

          if (summaryReady) {
            primaryLabel = categoryLabel || summaryText || idDisplay;
            secondaryId = primaryLabel !== idDisplay ? idTail : null;
          } else {
            primaryLabel = categoryLabel || idDisplay;
          }

          return (
            <div className="flex min-w-0 items-center gap-2.5">
              <ReportThumbnail
                reportId={report_id}
                evidencePath={evidence_path}
                category={category}
                deferLoad
              />
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-px leading-none">
                <button
                  type="button"
                  className="min-w-0 truncate text-left text-sm font-semibold leading-tight text-foreground underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                  title={primaryLabel}
                  onClick={(event) => {
                    event.stopPropagation();
                    openPreview(row.original);
                  }}
                  data-stop-row-click=""
                >
                  {primaryLabel}
                </button>
                {secondaryId ? (
                  <span
                    className="min-w-0 truncate font-mono text-[0.6875rem] leading-tight text-muted-foreground tabular-nums"
                    title={idFull}
                  >
                    {secondaryId}
                  </span>
                ) : null}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: TRIAGE_COLUMN_ID,
        header: tt("columnHeader"),
        size: 108,
        maxSize: 120,
        enableSorting: false,
        cell: ({ getValue }) => (
          <TriageStatusBadge
            triageStatus={String(getValue() ?? "pending")}
            compact
          />
        ),
      },
      {
        accessorKey: "routing_destination",
        header: tr("columnHeader"),
        enableSorting: false,
        cell: ({ row, getValue }) => {
          const destination = (getValue() as string | null) ?? null;
          if (destination) {
            return <RoutingDestinationBadge destination={destination} />;
          }
          return (
            <TriageFieldText
              value=""
              triageStatus={row.original.triage_status}
              className="text-sm"
            />
          );
        },
      },
      {
        accessorKey: "has_shadow_disagreement",
        header: t("colShadow"),
        enableSorting: false,
        cell: ({ getValue }) => (
          <ShadowMismatchBadge hasDisagreement={Boolean(getValue())} />
        ),
      },
      {
        accessorKey: CREATED_COLUMN_ID,
        header: t("colAgeSla"),
        size: 112,
        maxSize: 128,
        cell: ({ row }) => (
          <ReportAgeSla
            createdAt={row.original.created_at}
            priority={row.original.priority}
            status={row.original.status}
          />
        ),
      },
      {
        accessorKey: "category",
        header: t("colCategory"),
        cell: ({ row, getValue }) => (
          <TriageFieldText
            value={String(getValue() ?? "")}
            triageStatus={row.original.triage_status}
            className="capitalize"
          />
        ),
      },
      {
        accessorKey: "priority",
        header: t("colPriority"),
        cell: ({ row }) => (
          <ReportPriorityBadge
            priority={row.original.priority}
            triageStatus={row.original.triage_status}
          />
        ),
      },
      {
        accessorKey: "status",
        header: t("colStatus"),
        cell: ({ getValue }) => {
          const status = String(getValue() || "new");
          const label =
            status === "new" ||
            status === "reviewing" ||
            status === "resolved" ||
            status === "rejected"
              ? t(`status_${status}`)
              : status;
          return <ReportStatusBadge status={status} label={label} />;
        },
      },
      {
        id: CONFIDENCE_COLUMN_ID,
        accessorKey: "confidence",
        header: t("colConfidence"),
        enableSorting: false,
        size: 88,
        maxSize: 104,
        cell: ({ row }) => (
          <ReportConfidenceChip
            confidence={row.original.confidence}
            triageStatus={row.original.triage_status}
          />
        ),
      },
      {
        accessorKey: "severity",
        header: t("colSeverity"),
        enableSorting: false,
        cell: ({ row, getValue }) => {
          const v = getValue();
          if (v == null || v === "") {
            return (
              <TriageFieldText
                value=""
                triageStatus={row.original.triage_status}
                className="text-sm"
              />
            );
          }
          return <span>{String(v)}</span>;
        },
      },
      {
        accessorKey: "summary",
        header: t("colSummary"),
        enableSorting: false,
        cell: ({ row, getValue }) => {
          const placeholderKey = triageFieldPlaceholderKey(
            row.original.triage_status,
            String(getValue() ?? ""),
          );
          if (placeholderKey) {
            return (
              <TriageFieldText
                value={String(getValue() ?? "")}
                triageStatus={row.original.triage_status}
                className="block max-w-[28rem] truncate text-sm"
              />
            );
          }
          return (
            <span className="block max-w-[28rem] truncate text-sm text-foreground">
              {truncate(String(getValue() ?? ""))}
            </span>
          );
        },
      },
      {
        id: ACTIONS_COLUMN_ID,
        enableResizing: false,
        enableSorting: false,
        enableHiding: false,
        header: () => <span className="sr-only">{tt("runNow")}</span>,
        cell: ({ row }) => (
          <ReportRowQuickActions
            report={row.original}
            onOpenDetail={goToDetail}
            triageSlot={
              <TriageDispatchActions
                reportId={row.original.report_id}
                triageStatus={row.original.triage_status}
                compact
                onResult={handleTriageResult}
              />
            }
          />
        ),
      },
    ],
    [goToDetail, handleTriageResult, openPreview, selectWaveId, t, tt, tr],
  );

  useEffect(() => {
    if (columns.length > 0 && columnOrder.length === 0) {
      const savedOrder = localStorage.getItem("citymind.dashboard.columnOrder");
      if (savedOrder) {
        try {
          setColumnOrder(JSON.parse(savedOrder));
        } catch {
          setColumnOrder(columns.map((c) => c.id || (c.accessorKey as string)).filter(Boolean));
        }
      } else {
        setColumnOrder(columns.map((c) => c.id || (c.accessorKey as string)).filter(Boolean));
      }
    }
  }, [columns, columnOrder.length]);

  const table = useReactTable({
    data: rows,
    columns,
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    state: { sorting, columnVisibility, rowSelection, columnOrder, columnSizing },
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: (row) => BULK_ELIGIBLE.has(row.original.triage_status),
    getRowId: (row) => row.report_id,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: { severity: false, confidence: true },
    },
  });

  function buildParams(mutate: (qs: URLSearchParams) => void): string {
    const qs = new URLSearchParams();
    qs.set("limit", params.limit ?? "25");
    qs.set("sort", params.sort ?? "triage_bucket");
    qs.set("order", params.order ?? "asc");
    for (const key of FILTER_PARAM_KEYS) {
      const value = params[key];
      if (value?.trim()) qs.set(key, value.trim());
    }
    if (params.cursor?.trim()) qs.set("cursor", params.cursor.trim());
    mutate(qs);
    return qs.toString();
  }

  function pushQuery(mutate: (qs: URLSearchParams) => void) {
    const qs = buildParams(mutate);
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  function toggleSort(columnId: string) {
    if (!SORTABLE.has(columnId)) return;
    pushQuery((qs) => {
      const currentSort = qs.get("sort") ?? "triage_bucket";
      const currentOrder = qs.get("order") ?? "asc";
      if (currentSort === columnId) {
        qs.set("order", currentOrder === "asc" ? "desc" : "asc");
      } else {
        qs.set("sort", columnId);
        qs.set("order", columnId === "created_at" ? "desc" : "asc");
      }
      qs.delete("cursor");
    });
  }

  function goNext() {
    if (!nextCursor) return;
    pushQuery((qs) => {
      qs.set("cursor", nextCursor);
    });
  }

  function goPrev() {
    const sort = params.sort ?? "triage_bucket";
    const order = params.order ?? "asc";
    const limit = Math.max(1, Number.parseInt(params.limit ?? "25", 10) || 25);

    if (sort === "triage_bucket") {
      const currentOffset = parseTriageBucketOffset(params.cursor);
      if (currentOffset <= 0) return;
      const prevOffset = Math.max(0, currentOffset - limit);
      pushQuery((qs) => {
        if (prevOffset === 0) {
          qs.delete("cursor");
          return;
        }
        qs.set(
          "cursor",
          encodeTriageBucketCursor(
            prevOffset,
            order,
            rows[0]?.report_id ?? "page",
          ),
        );
      });
      return;
    }

    if (!params.cursor) return;
    pushQuery((qs) => {
      qs.delete("cursor");
    });
  }

  const pageLimit = Math.max(1, Number.parseInt(params.limit ?? "25", 10) || 25);
  const pageOffset =
    (params.sort ?? "triage_bucket") === "triage_bucket"
      ? parseTriageBucketOffset(params.cursor)
      : params.cursor
        ? pageLimit
        : 0;
  const rangeStart = rows.length > 0 ? pageOffset + 1 : 0;
  const rangeEnd = rows.length > 0 ? pageOffset + rows.length : 0;
  const canGoPrev =
    (params.sort ?? "triage_bucket") === "triage_bucket"
      ? pageOffset > 0
      : Boolean(params.cursor?.trim());
  const paginationSummary =
    rows.length > 0 && totalCount != null && totalCount > 0
      ? t("paginationShowing", {
          from: rangeStart,
          to: rangeEnd,
          total: totalCount,
        })
      : rows.length > 0
        ? t("paginationPageRows", { count: rows.length })
        : null;

  const handleReportDeleted = useCallback(
    (reportId: string) => {
      if (previewReport?.report_id === reportId) {
        setSheetOpen(false);
        setPreviewReport(null);
      }
      setRowSelection((current) => {
        if (!current[reportId]) return current;
        const next = { ...current };
        delete next[reportId];
        return next;
      });
    },
    [previewReport?.report_id],
  );

  const selectedEligible = table
    .getSelectedRowModel()
    .rows.map((row) => row.original)
    .filter((row) => BULK_ELIGIBLE.has(row.triage_status));
  const bulkSelectionCapped = selectedEligible.length > BULK_MAX;
  const selectedCount = table.getSelectedRowModel().rows.length;

  async function runBulkTriage() {
    if (selectedEligible.length === 0 || bulkLoading) return;
    const reportIds = selectedEligible.slice(0, BULK_MAX).map((row) => row.report_id);
    setBulkLoading(true);
    try {
      const res = await fetch("/api/officer/reports/triage/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report_ids: reportIds }),
      });
      if (!res.ok) {
        const detail = await readTriageErrorDetail(res);
        announceOutcome(detail ?? tt("bulkFailed"), "error");
        return;
      }
      const result = parseBulkTriageResult(await res.json());
      const acceptedCount = result.accepted.length;
      const skippedSummary = formatBulkSkippedSummary(result.skipped);
      let message: string;
      let tone: TriageOutcomeMessage["tone"];
      if (acceptedCount === 0) {
        message = skippedSummary || tt("bulkFailed");
        tone = result.skipped.length > 0 ? "info" : "error";
      } else {
        message = skippedSummary
          ? `${tt("bulkSuccess", { count: acceptedCount })} ${skippedSummary}`
          : tt("bulkSuccess", { count: acceptedCount });
        tone = "success";
      }
      announceOutcome(message, tone);
      setRowSelection({});
      router.refresh();
    } catch {
      announceOutcome(tt("bulkFailed"), "error");
    } finally {
      setBulkLoading(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div
        className={cn(
          embedded
            ? "border-t border-dashed border-border p-10 text-center"
            : "surface-card border-dashed p-12 text-center",
        )}
      >
        <p className="text-xl font-semibold text-foreground">
          {filtersActive ? te("filteredHeading") : te("noneHeading")}
        </p>
        <p className="mt-2 text-base text-muted-foreground">
          {filtersActive ? te("filteredBody") : te("noneBody")}
        </p>
      </div>
    );
  }

  return (
    <div className={embedded ? undefined : "space-y-3"} data-slot="reports-table">
      <div
        className={cn(
          embedded ? undefined : "surface-card overflow-hidden",
        )}
      >
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-dashed border-border px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
              {t("tableTitle")}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="font-semibold"
              disabled={selectedEligible.length === 0 || bulkLoading}
              onClick={() => void runBulkTriage()}
            >
              {bulkLoading ? tt("bulkLoading") : tt("bulkRetry")}
            </Button>
            {selectedCount > 0 ? (
              <span className="text-sm text-muted-foreground">
                {tt("bulkSelectionEligible", { count: selectedEligible.length })}
              </span>
            ) : null}
            {bulkSelectionCapped ? (
              <span className="text-sm font-medium text-amber-800">
                {tt("bulkMaxHint")}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground transition-colors duration-150 ease-[var(--ease-out-expo)] hover:bg-muted/80 hover:text-foreground"
              aria-label={t("shortcutsGuide")}
              title={t("shortcutsGuide")}
              onClick={() => setShortcutsOpen(true)}
            >
              <Keyboard className="size-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 shrink-0 text-muted-foreground transition-colors duration-150 ease-[var(--ease-out-expo)] hover:bg-muted/80 hover:text-foreground"
              aria-label={t("exportCsv")}
              title={t("exportCsv")}
              onClick={handleExportCsv}
            >
              <Download className="size-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground transition-colors duration-150 ease-[var(--ease-out-expo)] hover:bg-muted/80 hover:text-foreground"
                  aria-label={t("density")}
                  title={t("density")}
                >
                  <LayoutGrid className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-40 p-1.5 duration-200 ease-[var(--ease-out-expo)] motion-reduce:duration-0"
              >
                <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground">
                  <LayoutGrid
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  {t("density")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {(["comfortable", "compact", "dense"] as const).map((mode) => (
                  <DropdownMenuCheckboxItem
                    key={mode}
                    checked={density === mode}
                    onCheckedChange={() => changeDensity(mode)}
                    className="min-h-10 gap-2 rounded-lg px-3 py-2 text-foreground font-medium hover:bg-muted/80 focus:bg-muted/80"
                  >
                    <span className="min-w-0 flex-1 capitalize">
                      {t(mode)}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 shrink-0 text-muted-foreground transition-colors duration-150 ease-[var(--ease-out-expo)] hover:bg-muted/80 hover:text-foreground"
                  aria-label={t("columnMenuAria")}
                >
                  <Columns3 className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="min-w-48 p-1.5 duration-200 ease-[var(--ease-out-expo)] motion-reduce:duration-0"
              >
                <DropdownMenuLabel className="flex items-center gap-2 px-3 py-2 text-sm font-semibold text-foreground">
                  <Columns3
                    className="size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  {t("columns")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1" />
                {table
                  .getAllColumns()
                  .filter((col) => col.getCanHide())
                  .map((col, index) => {
                    const Icon = columnIcon(col.id);
                    const visible = col.getIsVisible();
                    return (
                      <DropdownMenuCheckboxItem
                        key={col.id}
                        checked={visible}
                        onCheckedChange={(value) => col.toggleVisibility(!!value)}
                        onSelect={(e) => e.preventDefault()}
                        className={cn(
                          "column-menu-item-enter min-h-10 gap-2 rounded-lg px-3 py-2 pr-9",
                          "font-medium text-foreground",
                          "hover:bg-muted/80 focus:bg-muted/80",
                          "data-[state=checked]:text-foreground",
                        )}
                        style={{ animationDelay: `${index * 35}ms` }}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            visible
                              ? "text-primary"
                              : "text-muted-foreground",
                          )}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {columnLabel(col.id)}
                        </span>
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                <DropdownMenuSeparator className="my-1" />
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-colors"
                  onClick={handleResetLayout}
                >
                  <RotateCcw className="size-3.5 shrink-0" />
                  <span>{t("resetLayout")}</span>
                </button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <div 
          className="overflow-x-auto focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (focusedRowIndex === null && rows.length > 0) setFocusedRowIndex(0);
          }}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow
                  key={headerGroup.id}
                  className="border-b border-dashed border-border hover:bg-transparent"
                >
                  {headerGroup.headers.map((header) => {
                    const sortable = SORTABLE.has(header.column.id);
                    const sorted = sorting.find((s) => s.id === header.column.id);
                    const columnId = header.column.id;
                    const compactClass = compactColumnClass(columnId);
                    const headTitle =
                      columnId === TRIAGE_COLUMN_ID
                        ? tt("columnHeader")
                        : columnId === CREATED_COLUMN_ID
                          ? t("colCreatedAt")
                          : columnId === URGENCY_COLUMN_ID
                            ? t("colSeverity")
                            : columnId === CONFIDENCE_COLUMN_ID
                              ? t("colConfidence")
                              : undefined;
                    const canDrag =
                      columnId !== SELECT_COLUMN_ID &&
                      columnId !== URGENCY_COLUMN_ID &&
                      columnId !== ACTIONS_COLUMN_ID;
                    return (
                      <TableHead
                        key={header.id}
                        title={headTitle}
                        draggable={canDrag}
                        onDragStart={(e) => handleDragStart(e, columnId)}
                        onDragOver={(e) => handleDragOver(e, columnId)}
                        onDrop={(e) => handleDrop(e, columnId)}
                        className={cn(
                          "text-sm font-semibold text-foreground relative group select-none transition-all duration-150",
                          density === "comfortable" && "h-11 py-3 px-4",
                          density === "compact" && "h-9 py-2 px-3 text-xs",
                          density === "dense" && "h-7 py-0.5 px-2 text-xs",
                          canDrag && "cursor-grab active:cursor-grabbing hover:bg-muted/30",
                          compactClass,
                        )}
                        style={{
                          width: header.getSize(),
                          position: "relative",
                        }}
                      >
                        {header.isPlaceholder ? null : sortable ? (
                          <button
                            type="button"
                            className="inline-flex min-h-9 items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                            onClick={() => toggleSort(header.column.id)}
                            aria-label={
                              sorted
                                ? sorted.desc
                                  ? t("sortDesc")
                                  : t("sortAsc")
                                : undefined
                            }
                          >
                            {flexRender(
                              header.column.columnDef.header,
                              header.getContext(),
                            )}
                            {sorted ? (
                              sorted.desc ? (
                                <ArrowDown className="size-3.5 text-primary" />
                              ) : (
                                <ArrowUp className="size-3.5 text-primary" />
                              )
                            ) : null}
                          </button>
                        ) : (
                          flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )
                        )}
                        {header.column.getCanResize() && (
                          <div
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`${columnLabel(columnId)} column width`}
                            aria-valuenow={header.getSize()}
                            tabIndex={0}
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onKeyDown={(event) =>
                              resizeColumnByKeyboard(
                                event,
                                columnId,
                                header.getSize(),
                                header.column.columnDef.minSize ?? 20,
                                header.column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER,
                                setColumnSizing,
                              )
                            }
                            onDoubleClick={() => header.column.resetSize()}
                            className={cn(
                              "absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none touch-none bg-border/50 opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:bg-primary/50 hover:opacity-100 focus-visible:w-2 focus-visible:bg-primary focus-visible:opacity-100 focus-visible:outline-none",
                              header.column.getIsResizing() && "bg-primary opacity-100 w-1.5"
                            )}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => {
                const surfaceTone = reportRowSurfaceTone({
                  created_at: row.original.created_at,
                  priority: row.original.priority,
                  status: row.original.status,
                  severity: row.original.severity,
                });
                return (
                <ReportRowContextMenu
                  key={row.id}
                  reportId={row.original.report_id}
                  onOpenDetail={goToDetail}
                  onReportDeleted={handleReportDeleted}
                >
                  <TableRow
                    className={cn(
                      "reports-table-row group cursor-pointer border-b border-dashed border-border transition-colors duration-150 ease-[var(--ease-out-expo)]",
                      surfaceTone === "urgent" && "reports-table-row--urgent",
                      surfaceTone === "elevated" && "reports-table-row--elevated",
                      row.getIsSelected() && "reports-table-row--selected",
                      density === "comfortable" && "h-14",
                      density === "compact" && "h-11",
                      density === "dense" && "h-8",
                      focusedRowIndex === row.index && "reports-table-row--focused",
                      pending && "opacity-70",
                    )}
                    onClick={(event) => {
                      if (isRowInteractiveTarget(event.target)) return;
                      setFocusedRowIndex(row.index);
                      openPreview(row.original);
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const compactClass = compactColumnClass(cell.column.id);
                      return (
                        <TableCell
                          key={cell.id}
                          className={cn(
                            "text-base md:text-sm transition-all duration-150",
                            density === "comfortable" && "py-3.5 px-4",
                            density === "compact" && "py-2 px-3",
                            density === "dense" && "py-0.5 px-2 text-xs",
                            compactClass,
                          )}
                          style={{
                            width: cell.column.getSize(),
                          }}
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </ReportRowContextMenu>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <footer className="reports-table-pagination flex flex-col gap-2 border-t border-dashed border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          {paginationSummary ? (
            <p className="text-sm tabular-nums text-muted-foreground">
              {paginationSummary}
            </p>
          ) : (
            <span aria-hidden className="hidden sm:block" />
          )}
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!canGoPrev || pending}
              onClick={goPrev}
              aria-label={t("paginationPrev")}
            >
              <ChevronLeft className="size-4 shrink-0" aria-hidden />
              {t("paginationPrev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!nextCursor || pending}
              onClick={goNext}
              aria-label={t("paginationNext")}
            >
              {t("paginationNext")}
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </Button>
          </div>
        </footer>
      </div>

      <ReportQuickPreviewSheet
        report={previewReport}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onShowDetail={goToDetail}
      />

      <TriageOutcomeAnnouncer message={outcome} onDismiss={dismissOutcome} />

      {selectedCount > 0 && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-[var(--radius-card)] border border-[#2a2d3d] bg-[#1A1D26] px-6 py-3 text-white shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-2">
            <span className="flex size-5 items-center justify-center rounded-full bg-[#3B71F7] text-[10px] font-bold text-white">
              {selectedCount}
            </span>
            <span className="text-sm font-medium tracking-wide">
              {tt("bulkSelectionEligible", { count: selectedEligible.length })}
            </span>
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={handleExportCsv}
            >
              <Download className="size-3.5" />
              <span>{t("exportCsv")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"
              onClick={() => setRowSelection({})}
            >
              {t("clearSelection")}
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="bg-[#3B71F7] px-4 font-semibold text-white shadow-md hover:bg-[#3B71F7]/95"
              disabled={selectedEligible.length === 0 || bulkLoading}
              onClick={() => void runBulkTriage()}
            >
              {bulkLoading ? tt("bulkLoading") : tt("bulkRetry")}
            </Button>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Dialog */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Keyboard className="size-5 text-primary" />
              {t("keyboardShortcuts")}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {t("shortcutsGuide")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2.5 py-2 text-sm">
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Navigate rows</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">↑ / ↓</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Select / Deselect row</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">Space</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Select range</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">Shift + ↑ / ↓</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Open quick preview</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">Enter</kbd>
            </div>
            <div className="flex items-center justify-between border-b border-border/50 pb-2">
              <span className="text-muted-foreground">Close panel / Clear selection</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">Esc</kbd>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Toggle hotkey guide</span>
              <kbd className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-foreground">?</kbd>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
