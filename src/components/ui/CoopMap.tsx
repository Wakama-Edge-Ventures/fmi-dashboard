"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import type { Cooperative } from "@/src/types";
import { scoreColor } from "@/src/lib/utils";

interface CoopMapProps {
  coops: Cooperative[];
}

type CoopWithCoords = Cooperative & { lat?: number; lng?: number };

/** Deterministic scatter within CI bounds when API has no coordinates */
function getCoords(index: number): [number, number] {
  // Côte d'Ivoire: lat [4.5–10.5], lng [–8.5–-2.5]
  const lat = 4.5 + ((index * 2.3 + 1.1) % 6);
  const lng = -8.5 + ((index * 1.7 + 0.5) % 6);
  return [lat, lng];
}

export default function CoopMap({ coops }: CoopMapProps) {
  // API may return a wrapped object instead of a plain array
  const coopsList: Cooperative[] = Array.isArray(coops)
    ? coops
    : ((coops as unknown as Record<string, unknown>)?.data as Cooperative[]) ??
      ((coops as unknown as Record<string, unknown>)?.coops as Cooperative[]) ??
      [];

  return (
    <MapContainer
      center={[7.5, -5.5]}
      zoom={6}
      style={{ height: "100%", width: "100%", borderRadius: 12 }}
      scrollWheelZoom={false}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
      />

      {coopsList.map((coop, i) => {
        const c = coop as CoopWithCoords;
        const pos: [number, number] =
          c.lat != null && c.lng != null ? [c.lat, c.lng] : getCoords(i);
        const color = scoreColor(coop.avgScore ?? 0);
        const radius = 8 + Math.min((coop.totalFarmers ?? 1) / 20, 12);

        return (
          <CircleMarker
            key={coop.id}
            center={pos}
            radius={radius}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.75,
              weight: 2,
            }}
          >
            <Popup>
              <div style={{ minWidth: 160 }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{coop.nom}</p>
                <p style={{ color: "#6b7280", fontSize: 12 }}>{coop.region}</p>
                <p style={{ fontSize: 12, marginTop: 4 }}>
                  {coop.totalFarmers} agriculteurs
                </p>
                {coop.avgScore != null && (
                  <p style={{ fontSize: 12, color }}>
                    Score moyen : {coop.avgScore}
                  </p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
