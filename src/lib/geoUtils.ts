import type { Parcelle } from "@/src/types";

// ─── Polygon parsing ──────────────────────────────────────────────────────────

/**
 * Parse a GeoJSON string into Leaflet-format [[lat,lng]...] coordinates.
 * Handles Feature, FeatureCollection, Polygon, and raw array forms.
 * GeoJSON uses [lng,lat] — this function swaps to [lat,lng] for Leaflet.
 */
export function parsePolygonCoords(polygoneStr: string): [number, number][] | null {
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

    // GeoJSON [lng, lat] → Leaflet [lat, lng]
    return coords.map(([a, b]) => [b, a] as [number, number]);
  } catch {
    return null;
  }
}

// ─── Centroid ─────────────────────────────────────────────────────────────────

/**
 * Return a [lat, lng] centre for a parcelle.
 * Priority: direct lat/lng → polygone GeoJSON centroid → polygon[] centroid.
 */
export function parcelleCentre(p: Parcelle): [number, number] | null {
  if (p.lat != null && p.lng != null) return [p.lat, p.lng];

  if (p.polygone) {
    const coords = parsePolygonCoords(p.polygone);
    if (coords && coords.length > 0) {
      const latSum = coords.reduce((s, [lat]) => s + lat, 0);
      const lngSum = coords.reduce((s, [, lng]) => s + lng, 0);
      return [latSum / coords.length, lngSum / coords.length];
    }
  }

  if (p.polygon && p.polygon.length > 0) {
    const latSum = p.polygon.reduce((s, pt) => s + pt.lat, 0);
    const lngSum = p.polygon.reduce((s, pt) => s + pt.lng, 0);
    return [latSum / p.polygon.length, lngSum / p.polygon.length];
  }

  return null;
}
