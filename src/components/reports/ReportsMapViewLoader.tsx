"use client";

import dynamic from "next/dynamic";

import MapCanvasSkeleton from "./MapCanvasSkeleton";
import type { DashboardSearchParams } from "./types";

const ReportsMapView = dynamic(() => import("./ReportsMapView"), {
  ssr: false,
  loading: () => <MapCanvasSkeleton />,
});

type Props = {
  params: DashboardSearchParams;
};

export default function ReportsMapViewLoader({ params }: Props) {
  return <ReportsMapView params={params} />;
}
