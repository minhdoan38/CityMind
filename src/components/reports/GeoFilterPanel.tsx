"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { formatBbox, parseBbox, type Bbox } from "./types";

type Props = {
  initialBbox?: string;
  onApply: (bbox: string) => void;
  onClear: () => void;
};

export default function GeoFilterPanel({
  initialBbox,
  onApply,
  onClear,
}: Props) {
  const t = useTranslations("dashboard.map");
  const parsed = parseBbox(initialBbox);
  const [west, setWest] = useState(parsed ? String(parsed.west) : "");
  const [south, setSouth] = useState(parsed ? String(parsed.south) : "");
  const [east, setEast] = useState(parsed ? String(parsed.east) : "");
  const [north, setNorth] = useState(parsed ? String(parsed.north) : "");
  const [invalid, setInvalid] = useState(false);

  function handleApply() {
    const candidate: Bbox = {
      west: Number(west),
      south: Number(south),
      east: Number(east),
      north: Number(north),
    };
    const formatted = formatBbox(candidate);
    if (!parseBbox(formatted)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onApply(formatted);
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{t("drawHint")}</p>
      <p className="text-xs text-muted-foreground">{t("panelKeyboardHint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="geo-west">{t("westLabel")}</Label>
          <Input
            id="geo-west"
            type="number"
            inputMode="decimal"
            step="any"
            className="min-h-10"
            value={west}
            onChange={(event) => setWest(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="geo-south">{t("southLabel")}</Label>
          <Input
            id="geo-south"
            type="number"
            inputMode="decimal"
            step="any"
            className="min-h-10"
            value={south}
            onChange={(event) => setSouth(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="geo-east">{t("eastLabel")}</Label>
          <Input
            id="geo-east"
            type="number"
            inputMode="decimal"
            step="any"
            className="min-h-10"
            value={east}
            onChange={(event) => setEast(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="geo-north">{t("northLabel")}</Label>
          <Input
            id="geo-north"
            type="number"
            inputMode="decimal"
            step="any"
            className="min-h-10"
            value={north}
            onChange={(event) => setNorth(event.target.value)}
          />
        </div>
      </div>

      {invalid ? (
        <p role="alert" className="text-sm text-destructive">
          {t("invalidBbox")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" className="min-h-10" onClick={handleApply}>
          {t("applyAreaFilter")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-10"
          onClick={onClear}
        >
          {t("clearAreaFilter")}
        </Button>
      </div>
    </div>
  );
}
