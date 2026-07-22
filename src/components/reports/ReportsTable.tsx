"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, Columns3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

import TriageStatusBadge from "./TriageStatusBadge";
import {
  FILTER_PARAM_KEYS,
  type DashboardSearchParams,
  type ReportRow,
} from "./types";

const COLUMN_VISIBILITY_KEY = "citymind.dashboard.columnVisibility";

const SORTABLE = new Set(["created_at", "priority", "status", "category"]);

type Props = {
  rows: ReportRow[];
  nextCursor: string | null;
  params: DashboardSearchParams;
  filtersActive: boolean;
};

function truncate(text: string, max = 80): string {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusVariant(
  status: string,
): "secondary" | "outline" | "default" | "destructive" {
  switch (status) {
    case "resolved":
      return "default";
    case "rejected":
      return "destructive";
    case "reviewing":
      return "outline";
    default:
      return "secondary";
  }
}

export default function ReportsTable({
  rows,
  nextCursor,
  params,
  filtersActive,
}: Props) {
  const t = useTranslations("dashboard");
  const tt = useTranslations("dashboard.triage");
  const te = useTranslations("empty");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    severity: false,
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLUMN_VISIBILITY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as VisibilityState;
        setColumnVisibility({ severity: false, ...parsed });
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

  const sorting: SortingState = useMemo(() => {
    const id = params.sort ?? "triage_bucket";
    return [{ id, desc: (params.order ?? "asc") !== "asc" }];
  }, [params.sort, params.order]);

  function displayCell(value: string, triageStatus: string): string {
    if (triageStatus !== "completed") return "—";
    return value.trim() ? value : "—";
  }

  const columns = useMemo<ColumnDef<ReportRow>[]>(
    () => [
      {
        accessorKey: "report_id",
        header: t("colReportId"),
        enableSorting: false,
        cell: ({ getValue }) => (
          <span className="font-normal text-foreground">{String(getValue())}</span>
        ),
      },
      {
        accessorKey: "triage_status",
        header: tt("columnHeader"),
        enableSorting: false,
        cell: ({ getValue }) => (
          <TriageStatusBadge triageStatus={String(getValue() ?? "pending")} />
        ),
      },
      {
        accessorKey: "created_at",
        header: t("colCreatedAt"),
        cell: ({ getValue }) => (
          <span className="text-muted-foreground">
            {formatWhen(String(getValue() ?? ""))}
          </span>
        ),
      },
      {
        accessorKey: "category",
        header: t("colCategory"),
        cell: ({ row, getValue }) => (
          <span
            className="capitalize"
            aria-label={
              row.original.triage_status !== "completed" ? "not available" : undefined
            }
          >
            {displayCell(String(getValue() ?? ""), row.original.triage_status)}
          </span>
        ),
      },
      {
        accessorKey: "priority",
        header: t("colPriority"),
        cell: ({ row, getValue }) => {
          const shown = displayCell(String(getValue() ?? ""), row.original.triage_status);
          if (shown === "—") {
            return (
              <span aria-label="not available">{shown}</span>
            );
          }
          return (
            <Badge variant="secondary" className="capitalize">
              {shown}
            </Badge>
          );
        },
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
          return (
            <Badge variant={statusVariant(status)} className="capitalize">
              {label}
            </Badge>
          );
        },
      },
      {
        accessorKey: "severity",
        header: t("colSeverity"),
        enableSorting: false,
        cell: ({ getValue }) => {
          const v = getValue();
          return <span>{v == null || v === "" ? "—" : String(v)}</span>;
        },
      },
      {
        accessorKey: "summary",
        header: t("colSummary"),
        enableSorting: false,
        cell: ({ row, getValue }) => {
          const shown = displayCell(String(getValue() ?? ""), row.original.triage_status);
          return (
            <span
              className="block max-w-[28rem] truncate text-sm text-foreground"
              aria-label={
                row.original.triage_status !== "completed" ? "not available" : undefined
              }
            >
              {shown === "—" ? shown : truncate(shown)}
            </span>
          );
        },
      },
    ],
    [t, tt],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, columnVisibility },
    onColumnVisibilityChange: setColumnVisibility,
    manualPagination: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: { severity: false },
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
    if (!params.cursor) return;
    pushQuery((qs) => {
      qs.delete("cursor");
    });
  }

  function openRow(reportId: string) {
    router.push(`/dashboard/reports/${reportId}`);
  }

  if (rows.length === 0) {
    return (
      <div className="surface-card border-dashed p-12 text-center">
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
    <div className="space-y-3" data-slot="reports-table">
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className="min-h-11 gap-2">
              <Columns3 className="size-4" />
              {t("columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>{t("columns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  className="capitalize"
                  checked={col.getIsVisible()}
                  onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  onSelect={(e) => e.preventDefault()}
                >
                  {col.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="surface-card overflow-hidden rounded-xl">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const sortable = SORTABLE.has(header.column.id);
                  const sorted = sorting.find((s) => s.id === header.column.id);
                  return (
                    <TableHead
                      key={header.id}
                      className="h-11 text-sm font-normal text-muted-foreground"
                    >
                      {header.isPlaceholder ? null : sortable ? (
                        <button
                          type="button"
                          className="inline-flex min-h-11 items-center gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={0}
                role="link"
                className={cn(
                  "h-12 cursor-pointer focus-visible:bg-[#EFF6FF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary",
                  pending && "opacity-70",
                )}
                onClick={() => openRow(row.original.report_id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openRow(row.original.report_id);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="text-base md:text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!params.cursor || pending}
          onClick={goPrev}
        >
          {t("paginationPrev")}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={!nextCursor || pending}
          onClick={goNext}
        >
          {t("paginationNext")}
        </Button>
      </div>

    </div>
  );
}
