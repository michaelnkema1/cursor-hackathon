'use client';

import dynamic from 'next/dynamic';

// Dynamically import the actual map component and disable Server-Side Rendering
const MapComponent = dynamic(() => import("../../MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-gray-200">
      <p className="text-gray-500 font-medium animate-pulse">Loading Map...</p>
    </div>
  ),
});

export default function MapWrapper() {
  return (
    <div className="h-full w-full z-0">
      <MapComponent />
    </div>
  );
}