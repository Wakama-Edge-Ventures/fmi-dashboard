"use client";

import "leaflet/dist/leaflet.css";
import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";

import { parcelleCentre, parsePolygonCoords } from "@/src/lib/geoUtils";
import type { Parcelle } from "@/src/types";

// ─── NDVI color scale (4 tiers) ───────────────────────────────────────────────

export function ndviColor(ndvi: number | undefined | null): string {
  if (ndvi == null) return "#6b7280"; // gray — no data
  if (ndvi >= 0.6)  return "#10b981"; // excellent
  if (ndvi >= 0.4)  return "#84cc16"; // bon
  if (ndvi >= 0.2)  return "#f59e0b"; // moyen
  return "#ef4444";                   // faible
}

export function ndviStatut(ndvi: number | undefined | null): string {
  if (ndvi == null) return "—";
  if (ndvi >= 0.6)  return "Excellent";
  if (ndvi >= 0.4)  return "Bon";
  if (ndvi >= 0.2)  return "Moyen";
  return "Faible";
}

// ─── MapFlyController ─────────────────────────────────────────────────────────

interface FlyControllerProps {
  selectedId: string | null;
  parcelles: Parcelle[];
}

function MapFlyController({ selectedId, parcelles }: FlyControllerProps) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const p = parcelles.find((x) => x.id === selectedId);
    if (!p) return;
    const centre = parcelleCentre(p);
    if (centre) map.flyTo(centre, 13, { animate: true, duration: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  return null;
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
      <div style={{ minWidth: 170 }}>
        {farmerName && (
          <p style={{ fontWeight: 700, marginBottom: 2 }}>{farmerName}</p>
        )}
        <p style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
          {p.name ?? p.id.slice(0, 12)}
        </p>
        <p style={{ fontSize: 12 }}>Culture : {p.culture}</p>
        <p style={{ fontSize: 12 }}>Surface : {p.surface?.toFixed(1) ?? "—"} ha</p>
        <p style={{ fontSize: 12, color, fontWeight: 600, marginTop: 4 }}>
          NDVI : {p.ndvi != null ? p.ndvi.toFixed(3) : "—"}
        </p>
        <p style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>
          {ndviStatut(p.ndvi)} · Màj {p.createdAt?.slice(0, 10) ?? "—"}
        </p>
      </div>
    </Popup>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface NdviMapProps {
  parcelles: Parcelle[];
  farmerNames: Record<string, string>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NdviMap({
  parcelles,
  farmerNames,
  selectedId,
  onSelect,
}: NdviMapProps) {
  return (
    <MapContainer
      center={[7.5, -5.5]}
      zoom={6}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      <MapFlyController selectedId={selectedId} parcelles={parcelles} />

      {parcelles.map((p) => {
        const color      = ndviColor(p.ndvi);
        const isSelected = p.id === selectedId;
        const farmer     = farmerNames[p.farmerId];

        // Polygon from GeoJSON string
        if (p.polygone) {
          const coords = parsePolygonCoords(p.polygone);
          if (coords) {
            return (
              <Polygon
                key={p.id}
                positions={coords}
                pathOptions={{
                  color:       isSelected ? "#ffffff" : color,
                  fillColor:   color,
                  fillOpacity: isSelected ? 0.7 : 0.4,
                  weight:      isSelected ? 3   : 2,
                }}
                eventHandlers={{ click: () => onSelect(p.id) }}
              >
                <ParcellePopup p={p} farmerName={farmer} color={color} />
              </Polygon>
            );
          }
        }

        // Fallback: CircleMarker
        const centre = parcelleCentre(p);
        if (!centre) return null;

        return (
          <CircleMarker
            key={p.id}
            center={centre}
            radius={isSelected ? 10 : 7}
            pathOptions={{
              color:       isSelected ? "#ffffff" : color,
              fillColor:   color,
              fillOpacity: isSelected ? 0.9 : 0.75,
              weight:      isSelected ? 2.5 : 1.5,
            }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <ParcellePopup p={p} farmerName={farmer} color={color} />
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
