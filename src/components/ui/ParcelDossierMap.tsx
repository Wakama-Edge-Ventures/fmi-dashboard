"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer, useMap } from "react-leaflet";

function parsePolygonCoords(polygoneStr: string): [number, number][] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo: any = JSON.parse(polygoneStr);
    let coords: number[][] | undefined;
    if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
      coords = geo.features[0]?.geometry?.coordinates?.[0];
    } else if (geo.type === "Feature") {
      coords = geo.geometry?.coordinates?.[0];
    } else if (geo.type === "Polygon") {
      coords = geo.coordinates?.[0];
    } else if (Array.isArray(geo)) {
      coords = geo;
    }
    if (!coords || coords.length < 3) return null;
    return coords.map(([a, b]) => [b, a] as [number, number]);
  } catch {
    return null;
  }
}

function centroid(coords: [number, number][]): [number, number] {
  const lat = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lng = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lat, lng];
}

function BoundsAdjuster({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (coords.length > 0) map.fitBounds(coords, { padding: [30, 30] });
  }, [map, coords]);
  return null;
}

export interface ParcelDossierMapProps {
  parcel: Record<string, unknown>;
  onClose: () => void;
}

export default function ParcelDossierMap({ parcel, onClose }: ParcelDossierMapProps) {
  const title = String(parcel.name ?? parcel.culture ?? "Parcelle");
  const polygone = typeof parcel.polygone === "string" ? parcel.polygone : null;
  const lat = typeof parcel.lat === "number" ? parcel.lat : null;
  const lng = typeof parcel.lng === "number" ? parcel.lng : null;

  const polygonCoords = polygone ? parsePolygonCoords(polygone) : null;
  const hasPoint = lat != null && lng != null;
  const hasAnything = polygonCoords !== null || hasPoint;

  const center: [number, number] = polygonCoords
    ? centroid(polygonCoords)
    : hasPoint
    ? [lat!, lng!]
    : [7.5, -5.5];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-xl bg-bg-secondary p-4"
        style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-text-primary">{title}</p>
          <button
            onClick={onClose}
            className="text-text-muted transition-colors hover:text-text-primary"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {hasAnything ? (
          <MapContainer
            center={center}
            zoom={polygonCoords ? 13 : 14}
            style={{ height: 360, width: "100%", borderRadius: 8 }}
            scrollWheelZoom
          >
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
            />
            {polygonCoords ? (
              <>
                <BoundsAdjuster coords={polygonCoords} />
                <Polygon
                  positions={polygonCoords}
                  pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.35, weight: 2 }}
                >
                  <Popup>{title}</Popup>
                </Polygon>
              </>
            ) : (
              <CircleMarker
                center={center}
                radius={10}
                pathOptions={{ color: "#10b981", fillColor: "#10b981", fillOpacity: 0.8, weight: 2 }}
              >
                <Popup>{title}</Popup>
              </CircleMarker>
            )}
          </MapContainer>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-lg bg-bg-tertiary">
            <p className="text-sm text-text-muted">Polygone indisponible</p>
          </div>
        )}
      </div>
    </div>
  );
}
