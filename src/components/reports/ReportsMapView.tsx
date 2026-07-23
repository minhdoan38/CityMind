"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Map, { Layer, Source, type MapRef } from "react-map-gl/maplibre";
import type { GeoJSONSource, MapLayerMouseEvent } from "maplibre-gl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import "maplibre-gl/dist/maplibre-gl.css";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildRasterMapStyle } from "@/lib/mapTiles";

import GeoFilterBar from "./GeoFilterBar";
import GeoFilterPanel from "./GeoFilterPanel";
import IncidentsListPanel from "./IncidentsListPanel";
import MapCanvasSkeleton from "./MapCanvasSkeleton";
import {
  buildGeoPinsQuery,
  formatBbox,
  parseBbox,
  type Bbox,
  type DashboardSearchParams,
  type GeoPin,
} from "./types";

const DEFAULT_LAT = 21.0285;
const DEFAULT_LNG = 105.8542;
const DEFAULT_ZOOM = 11;

type Props = {
  params: DashboardSearchParams;
};

function bboxToFeatureCollection(bbox: Bbox) {
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: {},
        geometry: {
          type: "Polygon" as const,
          coordinates: [
            [
              [bbox.west, bbox.south],
              [bbox.east, bbox.south],
              [bbox.east, bbox.north],
              [bbox.west, bbox.north],
              [bbox.west, bbox.south],
            ],
          ],
        },
      },
    ],
  };
}

function pinsToGeoJSON(pins: GeoPin[]) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((pin) => ({
      type: "Feature" as const,
      properties: {
        report_id: pin.report_id,
        priority: pin.priority,
        status: pin.status,
        category: pin.category,
      },
      geometry: {
        type: "Point" as const,
        coordinates: [pin.longitude, pin.latitude],
      },
    })),
  };
}

export default function ReportsMapView({ params }: Props) {
  const t = useTranslations("dashboard.map");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const mapRef = useRef<MapRef>(null);
  const mapStyle = useMemo(() => buildRasterMapStyle(), []);

  const [pins, setPins] = useState<GeoPin[]>([]);
  const [unlocatedCount, setUnlocatedCount] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [drawStart, setDrawStart] = useState<{ lng: number; lat: number } | null>(
    null,
  );
  const [draftBbox, setDraftBbox] = useState<Bbox | null>(null);

  const activeFilterBbox = parseBbox(params.bbox);
  const previewBbox = draftBbox ?? activeFilterBbox;

  const pushSearchParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("cursor");
      mutate(next);
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const fetchPins = useCallback(async () => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const bounds = map.getBounds();
    const viewport: Bbox = {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };

    setRefreshing(true);
    try {
      const qs = buildGeoPinsQuery(viewport, params);
      const res = await fetch(`/api/officer/reports/geo/pins?${qs}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const body = await res.json();
      setPins((body.pins ?? []) as GeoPin[]);
      setUnlocatedCount(Number(body.unlocated_count ?? 0));
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setRefreshing(false);
    }
  }, [params]);

  useEffect(() => {
    if (!mapReady) return;
    const timer = window.setTimeout(() => {
      void fetchPins();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [fetchPins, mapReady]);

  useEffect(() => {
    const filterBbox = parseBbox(params.bbox);
    if (!filterBbox || !mapRef.current) return;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    mapRef.current.fitBounds(
      [
        [filterBbox.west, filterBbox.south],
        [filterBbox.east, filterBbox.north],
      ],
      { padding: 40, duration: reducedMotion ? 0 : 500 },
    );
  }, [params.bbox]);

  const handleMoveEnd = useCallback(() => {
    void fetchPins();
  }, [fetchPins]);

  const handleMapClick = useCallback(
    async (event: MapLayerMouseEvent) => {
      if (drawMode) return;

      const map = mapRef.current?.getMap();
      if (!map) return;

      const features = map.queryRenderedFeatures(event.point, {
        layers: ["clusters", "unclustered-point"],
      });
      if (!features.length) return;

      const feature = features[0];
      const clusterId = feature.properties?.cluster_id;
      if (clusterId !== undefined) {
        const source = map.getSource("reports") as GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(Number(clusterId));
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (reducedMotion) {
          map.jumpTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        } else {
          map.easeTo({
            center: (feature.geometry as GeoJSON.Point).coordinates as [
              number,
              number,
            ],
            zoom,
          });
        }
        return;
      }

      const reportId = feature.properties?.report_id;
      if (reportId) {
        router.push(`/dashboard/reports/${reportId}`);
      }
    },
    [drawMode, router],
  );

  const handleMouseDown = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!drawMode) return;
      setDrawStart({ lng: event.lngLat.lng, lat: event.lngLat.lat });
    },
    [drawMode],
  );

  const handleMouseMove = useCallback(
    (event: MapLayerMouseEvent) => {
      if (!drawMode || !drawStart) return;
      const west = Math.min(drawStart.lng, event.lngLat.lng);
      const east = Math.max(drawStart.lng, event.lngLat.lng);
      const south = Math.min(drawStart.lat, event.lngLat.lat);
      const north = Math.max(drawStart.lat, event.lngLat.lat);
      const candidate = { west, south, east, north };
      if (parseBbox(formatBbox(candidate))) {
        setDraftBbox(candidate);
      }
    },
    [drawMode, drawStart],
  );

  const handleMouseUp = useCallback(() => {
    if (!drawMode) return;
    setDrawStart(null);
    setDrawMode(false);
  }, [drawMode]);

  const applyBbox = useCallback(
    (bboxValue: string) => {
      if (!parseBbox(bboxValue)) return;
      setDraftBbox(null);
      pushSearchParams((next) => {
        next.set("bbox", bboxValue);
      });
    },
    [pushSearchParams],
  );

  const clearAreaFilter = useCallback(() => {
    setDraftBbox(null);
    pushSearchParams((next) => {
      next.delete("bbox");
    });
  }, [pushSearchParams]);

  const geoJson = useMemo(() => pinsToGeoJSON(pins), [pins]);
  const previewGeoJson = useMemo(
    () => (previewBbox ? bboxToFeatureCollection(previewBbox) : null),
    [previewBbox],
  );

  return (
    <div className="space-y-4">
      <GeoFilterBar
        drawMode={drawMode}
        hasActiveBbox={Boolean(activeFilterBbox)}
        onToggleDraw={() => setDrawMode((value) => !value)}
        onClear={clearAreaFilter}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="relative overflow-hidden rounded-lg border border-border">
          {!mapReady ? (
            <div className="absolute inset-0 z-20">
              <MapCanvasSkeleton />
            </div>
          ) : null}
          {refreshing ? (
            <p className="absolute right-3 top-3 z-10 rounded-md bg-card/90 px-2 py-1 text-xs text-muted-foreground">
              {t("updating")}
            </p>
          ) : null}

          <div className="absolute right-3 top-12 z-10 flex flex-col gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-10 min-w-10 bg-card"
              aria-label={t("zoomIn")}
              onClick={() => mapRef.current?.zoomIn()}
            >
              +
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="min-h-10 min-w-10 bg-card"
              aria-label={t("zoomOut")}
              onClick={() => mapRef.current?.zoomOut()}
            >
              −
            </Button>
          </div>

          <Map
            ref={mapRef}
            mapStyle={mapStyle}
            initialViewState={{
              longitude: DEFAULT_LNG,
              latitude: DEFAULT_LAT,
              zoom: DEFAULT_ZOOM,
            }}
            style={{ width: "100%", height: "480px" }}
            onMoveEnd={handleMoveEnd}
            onClick={handleMapClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onLoad={() => setMapReady(true)}
            interactiveLayerIds={["clusters", "unclustered-point"]}
            aria-label={t("mapAriaLabel")}
            onError={() => setLoadError(true)}
          >
            {previewGeoJson ? (
              <Source id="bbox-preview" type="geojson" data={previewGeoJson}>
                <Layer
                  id="bbox-fill"
                  type="fill"
                  paint={{
                    "fill-color": "#EFF6FF",
                    "fill-opacity": 0.25,
                  }}
                />
                <Layer
                  id="bbox-outline"
                  type="line"
                  paint={{
                    "line-color": "#2563EB",
                    "line-width": 2,
                  }}
                />
              </Source>
            ) : null}

            <Source
              id="reports"
              type="geojson"
              data={geoJson}
              cluster
              clusterMaxZoom={14}
              clusterRadius={50}
            >
              <Layer
                id="clusters"
                type="circle"
                filter={["has", "point_count"]}
                paint={{
                  "circle-color": "#EFF6FF",
                  "circle-stroke-color": "#2563EB",
                  "circle-stroke-width": 1,
                  "circle-radius": [
                    "step",
                    ["get", "point_count"],
                    18,
                    10,
                    22,
                    50,
                    28,
                  ],
                }}
              />
              <Layer
                id="cluster-count"
                type="symbol"
                filter={["has", "point_count"]}
                layout={{
                  "text-field": ["get", "point_count_abbreviated"],
                  "text-size": 12,
                }}
                paint={{
                  "text-color": "#2563EB",
                }}
              />
              <Layer
                id="unclustered-point"
                type="circle"
                filter={["!", ["has", "point_count"]]}
                paint={{
                  "circle-radius": 8,
                  "circle-color": "#FFFFFF",
                  "circle-stroke-width": 2,
                  "circle-stroke-color": [
                    "match",
                    ["get", "priority"],
                    "critical",
                    "#DC2626",
                    "high",
                    "#2563EB",
                    "medium",
                    "#94A3B8",
                    "low",
                    "#E2E8F0",
                    "#94A3B8",
                  ],
                }}
              />
            </Source>
          </Map>
        </div>

        <div className="space-y-4">
          <GeoFilterPanel
            key={
              draftBbox
                ? formatBbox(draftBbox)
                : (params.bbox ?? "none")
            }
            initialBbox={
              draftBbox ? formatBbox(draftBbox) : params.bbox
            }
            onApply={applyBbox}
            onClear={clearAreaFilter}
          />
          <IncidentsListPanel pins={pins} />
        </div>
      </div>

      {pins.length === 0 && !loadError ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">
            {activeFilterBbox ? t("emptyAreaHeading") : t("emptyHeading")}
          </p>
          <p className="mt-1">
            {activeFilterBbox ? t("emptyAreaBody") : t("emptyBody")}
          </p>
        </div>
      ) : null}

      {unlocatedCount > 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("unlocatedCount", { count: unlocatedCount })}
        </p>
      ) : null}

      {loadError ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>{t("errorLoad")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{t("errorTiles")}</span>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => void fetchPins()}
            >
              {t("retry")}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
