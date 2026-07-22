"use client";

import { Component, type ReactNode, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";

function MapLoadingSkeleton() {
  return <Skeleton className="h-50 w-full rounded-none md:h-60" />;
}

const ReportLocationMiniMapInner = dynamic(
  () => import("./ReportLocationMiniMapInner"),
  {
    ssr: false,
    loading: () => <MapLoadingSkeleton />,
  },
);

type ReportLocationMiniMapProps = {
  latitude: string;
  longitude: string;
  onCoordsChange: (lat: string, lng: string) => void;
  disabled?: boolean;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class MapErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export default function ReportLocationMiniMap({
  latitude,
  longitude,
  onCoordsChange,
  disabled = false,
}: ReportLocationMiniMapProps) {
  const t = useTranslations("public.map");
  const [degraded, setDegraded] = useState(false);

  const degradedMessage = (
    <p role="alert" className="px-3 py-4 text-sm text-muted-foreground">
      {t("degraded")}
    </p>
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{t("label")}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("helper")}</p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-secondary/30">
        {degraded ? (
          degradedMessage
        ) : (
          <MapErrorBoundary fallback={degradedMessage}>
            <ReportLocationMiniMapInner
              latitude={latitude}
              longitude={longitude}
              onCoordsChange={onCoordsChange}
              disabled={disabled}
              onDegrade={() => setDegraded(true)}
              loadingLabel={t("loading")}
              mapAriaLabel={t("ariaLabel")}
            />
          </MapErrorBoundary>
        )}
      </div>
    </div>
  );
}
