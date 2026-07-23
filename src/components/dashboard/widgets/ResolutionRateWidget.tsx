"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import WidgetCard from "./WidgetCard";

const TARGET_RATE = 80;
const TICK_COUNT = 36;

function roundSvgCoord(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

type Props = {
  rate: number;
  resolved: number;
  total: number;
  delayClass?: string;
};

export default function ResolutionRateWidget({
  rate,
  resolved,
  total,
  delayClass,
}: Props) {
  const t = useTranslations("dashboard.widgets");
  const [animatedRate, setAnimatedRate] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const duration = 700;
    let frame = 0;

    const step = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setAnimatedRate(Math.round(rate * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(step);
      }
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [rate]);

  const activeTicks = Math.round((animatedRate / 100) * TICK_COUNT);
  const onTrack = rate >= TARGET_RATE;

  return (
    <WidgetCard title={t("resolutionTitle")} delayClass={delayClass}>
      <div className="flex flex-col items-center">
        <div className="relative h-[140px] w-full max-w-[220px]">
          <svg
            viewBox="0 0 200 110"
            className="h-full w-full"
            role="img"
            aria-label={t("resolutionAria", { rate })}
          >
            {Array.from({ length: TICK_COUNT }).map((_, index) => {
              const angle = -180 + (index / (TICK_COUNT - 1)) * 180;
              const rad = (angle * Math.PI) / 180;
              const inner = 68;
              const outer = 88;
              const x1 = roundSvgCoord(100 + inner * Math.cos(rad));
              const y1 = roundSvgCoord(100 + inner * Math.sin(rad));
              const x2 = roundSvgCoord(100 + outer * Math.cos(rad));
              const y2 = roundSvgCoord(100 + outer * Math.sin(rad));
              const active = index < activeTicks;
              return (
                <line
                  key={index}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    active
                      ? onTrack
                        ? "var(--success)"
                        : "var(--primary)"
                      : "var(--border)"
                  }
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-x-0 bottom-2 text-center">
            <p className="font-heading text-4xl font-semibold tabular-nums tracking-tight text-foreground">
              {animatedRate}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {onTrack
                ? t("resolutionOnTrack", { target: TARGET_RATE })
                : t("resolutionProgress", {
                    target: TARGET_RATE,
                    resolved,
                    total,
                  })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="mt-2 px-5 text-sm"
        >
          {t("resolutionDetails")}
        </Button>
      </div>
    </WidgetCard>
  );
}
