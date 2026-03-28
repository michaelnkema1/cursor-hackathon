"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

// Fix for missing default map marker icons in Next.js
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type Issue = {
  id: string | number;
  title: string;
  type: string;
  status: string;
  lat: number;
  lng: number;
};

export default function MapComponent() {
  const [issues, setIssues] = useState<Issue[]>([]);

  useEffect(() => {
    fetch("/api/issues")
      .then((res) => res.json())
      .then((data) => setIssues(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Error fetching map data:", err));
  }, []);

  return (
    <MapContainer
      center={[5.6037, -0.187]}
      zoom={7}
      className="h-full w-full"
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />
      {issues.map((issue) => (
        <Marker
          key={String(issue.id)}
          position={[issue.lat, issue.lng]}
          icon={customIcon}
        >
          <Popup>
            <div className="p-1">
              <span
                className={`text-xs font-bold uppercase tracking-wider ${
                  issue.status === "Reported"
                    ? "text-red-600"
                    : issue.status === "Investigating"
                      ? "text-yellow-600"
                      : "text-green-600"
                }`}
              >
                {issue.status}
              </span>
              <h3 className="mt-1 font-bold text-gray-800">{issue.title}</h3>
              <p className="text-sm text-gray-600">Issue: {issue.type}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
