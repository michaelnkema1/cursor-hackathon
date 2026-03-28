"use client";

import { MapComponentDynamic } from "@/components/MapComponentDynamic";
import type { MapComponentProps } from "@/components/MapComponent";

export function MapWrapper(props: MapComponentProps = {}) {
  return (
    <div className="relative h-full min-h-[50vh] w-full flex-1">
      <MapComponentDynamic {...props} />
    </div>
  );
}
