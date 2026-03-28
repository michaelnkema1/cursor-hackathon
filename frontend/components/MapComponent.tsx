"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { IssueApiRow } from "@/lib/reports";

export type MapComponentProps = {
  /** When set, map flies to this issue (e.g. sidebar selection). */
  selectedId?: string | null;
  onSelectReport?: (id: string) => void;
};

function FlyToSelected({ issue }: { issue: IssueApiRow | null }) {
  const map = useMap();
  useEffect(() => {
    if (!issue) return;
    map.flyTo([issue.lat, issue.lng], 12, { duration: 0.9 });
  }, [map, issue]);
  return null;
}

export function MapComponent({
  selectedId = null,
  onSelectReport,
}: MapComponentProps) {
  const [issues, setIssues] = useState<IssueApiRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    type Proto = typeof L.Icon.Default.prototype & { _getIconUrl?: unknown };
    delete (L.Icon.Default.prototype as Proto)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
      iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
      shadowUrl:
        "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/issues", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<unknown>;
      })
      .then((data) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          setIssues([]);
          setError("Invalid response");
          return;
        }
        setIssues(data as IssueApiRow[]);
      })
      .catch(() => {
        if (!cancelled) {
          setIssues([]);
          setError("Could not load issues");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedIssue = useMemo(() => {
    if (selectedId == null) return null;
    return issues.find((i) => String(i.id) === selectedId) ?? null;
  }, [issues, selectedId]);

  const handleMarkerClick = useCallback(
    (id: string) => {
      onSelectReport?.(id);
    },
    [onSelectReport],
  );

  const markerRefs = useRef<Map<string, LeafletMarker>>(new Map());

  useEffect(() => {
    if (!selectedId || loading) return;
    const marker = markerRefs.current.get(selectedId);
    if (!marker) return;
    const t = window.setTimeout(() => {
      marker.openPopup();
    }, 350);
    return () => window.clearTimeout(t);
  }, [selectedId, loading, issues]);

  const center: [number, number] = [5.6037, -0.187];
  const zoom = 7;

  return (
    <div className="relative h-full min-h-[280px] w-full">
      {loading && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-1000 rounded-lg bg-white/90 px-2 py-1 text-xs font-medium text-slate-600 shadow-md dark:bg-slate-900/90 dark:text-slate-300">
          Loading pins…
        </div>
      )}
      {error && (
        <div className="absolute left-3 right-3 top-3 z-1000 rounded-lg bg-red-100 px-3 py-2 text-xs font-medium text-red-900 shadow-md dark:bg-red-950/90 dark:text-red-100">
          {error}
        </div>
      )}
      <MapContainer
        center={center}
        zoom={zoom}
        className="z-0 h-full w-full rounded-none lg:rounded-l-2xl"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FlyToSelected issue={selectedIssue} />
        {issues.map((issue) => (
          <Marker
            key={String(issue.id)}
            ref={(instance) => {
              const id = String(issue.id);
              if (instance) markerRefs.current.set(id, instance);
              else markerRefs.current.delete(id);
            }}
            position={[issue.lat, issue.lng]}
            eventHandlers={{
              click: () => handleMarkerClick(String(issue.id)),
            }}
          >
            <Popup>
              <div className="min-w-[200px] font-sans text-sm text-slate-800">
                <p className="font-semibold text-slate-900">{issue.title}</p>
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Type:</span>{" "}
                  {issue.type}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  <span className="font-medium text-slate-700">Status:</span>{" "}
                  {issue.status}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
