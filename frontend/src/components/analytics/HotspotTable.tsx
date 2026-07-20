"use client";

import { useTranslations } from "next-intl";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import ChartBlock from "./ChartBlock";
import type { AnalyticsHotspotRow } from "./types";

type Props = {
  data: AnalyticsHotspotRow[];
  warehouseEmpty: boolean;
  loading?: boolean;
};

const TOP_N = 10;

export default function HotspotTable({ data, warehouseEmpty, loading }: Props) {
  const t = useTranslations("dashboard.analytics");
  const rows = data.slice(0, TOP_N);
  const isEmpty = rows.length === 0;

  return (
    <ChartBlock
      title={t("hotspotTitle")}
      caption={t("hotspotCaption")}
      summary={t("hotspotSummary", { count: rows.length })}
      loading={loading}
      isEmpty={isEmpty}
      emptyHeading={
        warehouseEmpty ? t("emptyWarehouseHeading") : t("emptyHeading")
      }
      emptyBody={warehouseEmpty ? t("emptyWarehouseBody") : t("emptyBody")}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">{t("hotspotRank")}</TableHead>
            <TableHead>{t("hotspotLabel")}</TableHead>
            <TableHead className="text-right">{t("hotspotCount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.category}-${index}`}>
              <TableCell className="font-semibold text-primary">
                {String(index + 1).padStart(2, "0")}
              </TableCell>
              <TableCell>{row.category}</TableCell>
              <TableCell className="text-right tabular-nums">
                {row.report_count}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </ChartBlock>
  );
}
