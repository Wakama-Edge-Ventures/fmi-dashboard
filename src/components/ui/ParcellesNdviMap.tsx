"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polygon, Popup, TileLayer } from "react-leaflet";

import type { Parcelle } from "@/src/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ndviColor(ndvi: number | undefined): string {
  if (ndvi == null) return "#6b7280";
  if (ndvi >= 0.5)  return "#10b981";
  if (ndvi >= 0.3)  return "#f59e0b";
  return "#ef4444";
}

/** Extract Leaflet-format [[lat,lng]...] from a GeoJSON string (swaps lng/lat). */
function parsePolygonCoords(polygoneStr: string): [number, number][] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const geo: any = JSON.parse(polygoneStr);
    let coords: number[][] | undefined;

    if (geo.type === "FeatureCollection" && Array.isArray(geo.features)) {
      const first = geo.features[0];
      coords = first?.geometry?.coordinates?.[0];
    } else if (geo.type === "Feature") {
      coords = geo.geometry?.coordinates?.[0];
    } else if (geo.type === "Polygon") {
      coords = geo.coordinates?.[0];
    } else if (Array.isArray(geo)) {
      // Raw array — try to detect [lng,lat] vs [lat,lng] by value range
      // Côte d'Ivoire lng is negative (-8.5 to -2.5), lat is positive (4.5-10.5)
      // If first element[0] is negative → it's [lng, lat]
      coords = geo;
    }

    if (!coords || coords.length < 3) return null;

    return coords.map(([a, b]) => {
      // GeoJSON standard: [lng, lat]. Swap to [lat, lng] for Leaflet.
      return [b, a] as [number, number];
    });
  } catch {
    return null;
  }
}

/** Centroid of a polygon array or direct lat/lng field. */
function parcelleCentre(p: Parcelle): [number, number] | null {
  if (p.lat != null && p.lng != null) return [p.lat, p.lng];
  if (p.polygon && p.polygon.length > 0) {
    const latSum = p.polygon.reduce((s, pt) => s + pt.lat, 0);
    const lngSum = p.polygon.reduce((s, pt) => s + pt.lng, 0);
    return [latSum / p.polygon.length, lngSum / p.polygon.length];
  }
  return null;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ParcellesNdviMapProps {
  parcelles: Parcelle[];
  farmerNames: Record<string, string>;
  centerLat?: number;
  centerLng?: number;
}

// ─── Popup content ────────────────────────────────────────────────────────────

function ParcellePopup({
  p,
  farmerName,
  color,
}: {
  p: Parcelle;
  farmerName: string | undefined;
  color: string;
}) {
  return (
    <Popup>
      <div style={{ minWidth: 140 }}>
        <p style={{ fontWeight: 700, marginBottom: 2 }}>
          {p.name ?? p.id.slice(0, 10)}
        </p>
        {farmerName && (
          <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>{farmerName}</p>
        )}
        <p style={{ fontSize: 12 }}>{p.culture}</p>
        <p style={{ fontSize: 12, color, marginTop: 2 }}>
          NDVI: {p.ndvi != null ? p.ndvi.toFixed(3) : "—"}
        </p>
      </div>
    </Popup>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ParcellesNdviMap({
  parcelles,
  farmerNames,
  centerLat,
  centerLng,
}: ParcellesNdviMapProps) {
  const center: [number, number] =
    centerLat != null && centerLng != null ? [centerLat, centerLng] : [7.5, -5.5];

  return (
    <div style={{ position: "relative" }}>
      <MapContainer
        center={center}
        zoom={centerLat != null ? 10 : 6}
        style={{ height: 280, width: "100%", borderRadius: 8 }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {parcelles.map((p) => {
          const color  = ndviColor(p.ndvi);
          const farmer = farmerNames[p.farmerId];

          // Try polygon first (GeoJSON string)
          if (p.polygone) {
            const coords = parsePolygonCoords(p.polygone);
            if (coords) {
              return (
                <Polygon
                  key={p.id}
                  positions={coords}
                  pathOptions={{
                    color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 2,
                  }}
                >
                  <ParcellePopup p={p} farmerName={farmer} color={color} />
                </Polygon>
              );
            }
          }

          // Fallback: CircleMarker from polygon field or lat/lng
          const centre = parcelleCentre(p);
          if (!centre) return null;

          return (
            <CircleMarker
              key={p.id}
              center={centre}
              radius={8}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.8,
                weight: 1.5,
              }}
            >
              <ParcellePopup p={p} farmerName={farmer} color={color} />
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: 8,
          right: 8,
          zIndex: 1000,
          background: "rgba(17,24,39,0.85)",
          borderRadius: 6,
          padding: "5px 8px",
          fontSize: 11,
          display: "flex",
          gap: 10,
          backdropFilter: "blur(4px)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        {[
          { color: "#10b981", label: "BON (≥0.5)" },
          { color: "#f59e0b", label: "MOYEN (0.3–0.5)" },
          { color: "#ef4444", label: "FAIBLE (<0.3)" },
        ].map(({ color, label }) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color }} />
            <span style={{ color: "#d1d5db" }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
