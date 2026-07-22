"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { Skeleton } from "@/components/ui/skeleton";
import { buildRasterMapStyle } from "@/lib/mapTiles";

const DEFAULT_LAT = 21.0285;
const DEFAULT_LNG = 105.8542;
const DEFAULT_ZOOM = 12;

function parseCoord(
  value: string,
  min: number,
  max: number,
): number | null {
  if (!value.trim()) return null;
  const num = parseFloat(value);
  if (Number.isNaN(num) || num < min || num > max) return null;
  return num;
}

type ReportLocationMiniMapInnerProps = {
  latitude: string;
  longitude: string;
  onCoordsChange: (lat: string, lng: string) => void;
  disabled?: boolean;
  onDegrade: () => void;
  loadingLabel: string;
  mapAriaLabel: string;
};

export default function ReportLocationMiniMapInner({
  latitude,
  longitude,
  onCoordsChange,
  disabled = false,
  onDegrade,
  loadingLabel,
  mapAriaLabel,
}: ReportLocationMiniMapInnerProps) {
  const mapRef = useRef<MapRef>(null);
  const mapStyle = useMemo(() => buildRasterMapStyle(), []);
  const [ready, setReady] = useState(false);

  const lat = parseCoord(latitude, -90, 90);
  const lng = parseCoord(longitude, -180, 180);
  const hasPin = lat !== null && lng !== null;

  const initialViewState = useMemo(
    () => ({
      longitude: lng ?? DEFAULT_LNG,
      latitude: lat ?? DEFAULT_LAT,
      zoom: DEFAULT_ZOOM,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once on mount
    [],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const nextLat = parseCoord(latitude, -90, 90);
      const nextLng = parseCoord(longitude, -180, 180);
      if (nextLat === null || nextLng === null || !mapRef.current) return;

      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reducedMotion) {
        mapRef.current.jumpTo({ center: [nextLng, nextLat] });
      } else {
        mapRef.current.flyTo({
          center: [nextLng, nextLat],
          duration: 500,
        });
      }
    }, 300);

    return () => window.clearTimeout(timer);
  }, [latitude, longitude]);

  const handleClick = useCallback(
    (event: { lngLat: { lat: number; lng: number } }) => {
      if (disabled) return;
      const { lat: clickLat, lng: clickLng } = event.lngLat;
      onCoordsChange(clickLat.toFixed(6), clickLng.toFixed(6));
    },
    [disabled, onCoordsChange],
  );

  const handleError = useCallback(() => {
    onDegrade();
  }, [onDegrade]);

  return (
    <div className="relative h-50 w-full md:h-60">
      {!ready ? (
        <Skeleton
          className="absolute inset-0 rounded-none"
          aria-label={loadingLabel}
        />
      ) : null}
      <Map
        ref={mapRef}
        mapStyle={mapStyle}
        initialViewState={initialViewState}
        onClick={handleClick}
        onLoad={() => setReady(true)}
        onError={handleError}
        style={{ width: "100%", height: "100%" }}
        scrollZoom={!disabled}
        dragPan={!disabled}
        doubleClickZoom={!disabled}
        touchZoomRotate={!disabled}
        keyboard={!disabled}
        aria-label={mapAriaLabel}
      >
        {hasPin ? (
          <Marker longitude={lng} latitude={lat} anchor="bottom" />
        ) : null}
      </Map>
    </div>
  );
}
