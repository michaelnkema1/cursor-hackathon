"use client";

import dynamic from "next/dynamic";
import type { MapComponentProps } from "@/components/MapComponent";

const MapComponentLazy = dynamic(
  () =>
    import("@/components/MapComponent").then((m) => m.MapComponent),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-none bg-slate-100 text-sm font-medium text-slate-600 lg:rounded-l-2xl dark:bg-slate-900 dark:text-slate-400">
        Loading map…
      </div>
    ),
  },
);

export function MapComponentDynamic(props: MapComponentProps) {
  return <MapComponentLazy {...props} />;
}
