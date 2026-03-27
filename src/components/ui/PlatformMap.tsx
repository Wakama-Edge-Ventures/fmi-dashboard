"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import { scoreColor } from "@/src/lib/utils";
import type { Cooperative, Farmer, Parcelle } from "@/src/types";

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformMapProps {
  farmers: Farmer[];
  coops: Cooperative[];
  parcelles?: Parcelle[];
}

// ─── Coordinate helpers ───────────────────────────────────────────────────────

type CoopWithCoords = Cooperative & { lat?: number; lng?: number };

/** Deterministic scatter for farmers within CI bounds */
function farmerCoords(index: number): [number, number] {
  const lat = 4.8 + ((index * 1.91 + 0.73) % 5.4);
  const lng = -8.2 + ((index * 2.13 + 0.31) % 5.4);
  return [lat, lng];
}

/** Deterministic scatter for coops within CI bounds */
function coopCoords(index: number): [number, number] {
  const lat = 4.5 + ((index * 2.3 + 1.1) % 6);
  const lng = -8.5 + ((index * 1.7 + 0.5) % 6);
  return [lat, lng];
}

/** Centroid of a parcelle polygon, with deterministic fallback */
function parcelleCoords(parcelle: Parcelle, index: number): [number, number] {
  if (parcelle.polygon && parcelle.polygon.length > 0) {
    const lat =
      parcelle.polygon.reduce((s, p) => s + p.lat, 0) / parcelle.polygon.length;
    const lng =
      parcelle.polygon.reduce((s, p) => s + p.lng, 0) / parcelle.polygon.length;
    return [lat, lng];
  }
  const lat = 5.0 + ((index * 1.43 + 0.41) % 5.0);
  const lng = -8.0 + ((index * 1.81 + 0.62) % 5.0);
  return [lat, lng];
}

/** Normalise a potential API-wrapped array */
function toArray<T>(raw: T[] | unknown): T[] {
  if (Array.isArray(raw)) return raw;
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj?.data)) return obj.data as T[];
  if (Array.isArray(obj?.coops)) return obj.coops as T[];
  return [];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PlatformMap({
  farmers,
  coops,
  parcelles = [],
}: PlatformMapProps) {
  const farmersList   = toArray<Farmer>(farmers);
  const coopsList     = toArray<Cooperative>(coops);
  const parcellesList = toArray<Parcelle>(parcelles);

  // Green square DivIcon for cooperatives
  const coopIcon = useMemo(
    () =>
      L.divIcon({
        html: '<div style="width:12px;height:12px;background:#10b981;border:2px solid rgba(255,255,255,0.55);border-radius:2px;"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        className: "",
      }),
    []
  );

  return (
    <div style={{ position: "relative", height: "100%", width: "100%" }}>
      <MapContainer
        center={[7.5, -5.5]}
        zoom={6}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
        />

        {/* ── Farmers — blue circle radius 6 ── */}
        {farmersList.map((farmer, i) => (
          <CircleMarker
            key={farmer.id}
            center={farmerCoords(i)}
            radius={6}
            pathOptions={{
              color: "#3b82f6",
              fillColor: "#3b82f6",
              fillOpacity: 0.8,
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>
                  {farmer.prenom} {farmer.nom}
                </p>
                <p style={{ color: "#6b7280", fontSize: 12 }}>{farmer.region}</p>
                {farmer.village && (
                  <p style={{ color: "#9ca3af", fontSize: 11 }}>{farmer.village}</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* ── Cooperatives — green square DivIcon ── */}
        {coopsList.map((coop, i) => {
          const c = coop as CoopWithCoords;
          const pos: [number, number] =
            c.lat != null && c.lng != null ? [c.lat, c.lng] : coopCoords(i);
          const color = scoreColor(coop.avgScore ?? 0);
          return (
            <Marker key={coop.id} position={pos} icon={coopIcon}>
              <Popup>
                <div style={{ minWidth: 150 }}>
                  <p style={{ fontWeight: 700, marginBottom: 2 }}>{coop.nom}</p>
                  <p style={{ color: "#6b7280", fontSize: 12 }}>{coop.region}</p>
                  <p style={{ fontSize: 12, marginTop: 4 }}>
                    {coop.totalFarmers} membres
                  </p>
                  {coop.avgScore != null && (
                    <p style={{ fontSize: 12, color }}>
                      Score moyen : {coop.avgScore}
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* ── Parcelles — orange dot radius 4 ── */}
        {parcellesList.map((parcelle, i) => (
          <CircleMarker
            key={parcelle.id}
            center={parcelleCoords(parcelle, i)}
            radius={4}
            pathOptions={{
              color: "#f97316",
              fillColor: "#f97316",
              fillOpacity: 0.75,
              weight: 1,
            }}
          >
            <Popup>
              <div style={{ minWidth: 120 }}>
                <p style={{ fontWeight: 700, marginBottom: 2 }}>{parcelle.culture}</p>
                <p style={{ fontSize: 12 }}>
                  {parcelle.surface} ha — {parcelle.stade}
                </p>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      {/* ── Legend (bottom-right overlay) ── */}
      <div
        style={{ position: "absolute", bottom: 28, right: 10, zIndex: 1000 }}
        className="rounded-lg border border-gray-700 bg-bg-secondary/90 backdrop-blur-sm px-3 py-2.5 text-xs space-y-1.5 pointer-events-none"
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0 bg-blue-500" />
          <span className="text-text-secondary">
            Agriculteurs ({farmersList.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm shrink-0"
            style={{ background: "#10b981", border: "1px solid rgba(255,255,255,0.4)" }}
          />
          <span className="text-text-secondary">
            Coopératives ({coopsList.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full shrink-0" style={{ background: "#f97316" }} />
          <span className="text-text-secondary">
            Parcelles ({parcellesList.length})
          </span>
        </div>
      </div>
    </div>
  );
}
