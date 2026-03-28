"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import KPICard from "@/src/components/ui/KPICard";
import PageLoader from "@/src/components/ui/PageLoader";
import { ndviColor, ndviStatut } from "@/src/components/ui/NdviMap";
import {
  farmers as farmersApi,
  parcelles as parcellesApi,
} from "@/src/lib/api";
import { relativeTime } from "@/src/lib/utils";
import type { Farmer, Parcelle } from "@/src/types";

// ─── Dynamic map (no SSR) ─────────────────────────────────────────────────────

const NdviMapDynamic = dynamic(
  () => import("@/src/components/ui/NdviMap"),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────────────────────

type EnrichedParcelle = Parcelle & {
  farmerName: string;
  farmerRegion: string;
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NdviPage() {
  useParams(); // locale available if needed via params.locale

  // ── Data state ──
  const [allParcelles, setAllParcelles] = useState<EnrichedParcelle[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // ── UI state ──
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [filterCulture, setFilterCulture] = useState("Tous");
  const [filterRegion,  setFilterRegion]  = useState("Tous");
  const [ndviMin,       setNdviMin]       = useState(0);
  const [ndviMax,       setNdviMax]       = useState(1);
  const [sortDir,       setSortDir]       = useState<"asc" | "desc">("desc");
  const [page,          setPage]          = useState(0);

  const PAGE_SIZE = 20;
  const tableBodyRef = useRef<HTMLTableSectionElement>(null);

  // ── Fetch ──
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const farmersData = await farmersApi.list({ limit: 100 });
        const farmerList: Farmer[] = farmersData.data ?? [];

        const parcellesResults = await Promise.allSettled(
          farmerList.slice(0, 50).map((f) => parcellesApi.listByFarmer(f.id))
        );

        const enriched: EnrichedParcelle[] = [];
        farmerList.slice(0, 50).forEach((f, i) => {
          const r = parcellesResults[i];
          if (r.status !== "fulfilled") return;
          const ps: Parcelle[] = Array.isArray(r.value)
            ? r.value
            : (r.value as { data?: Parcelle[] })?.data ?? [];

          const name   = `${f.firstName ?? f.prenom ?? ""} ${f.lastName ?? f.nom ?? ""}`.trim() || "—";
          const region = f.region ?? "—";
          ps.forEach((p) => enriched.push({ ...p, farmerName: name, farmerRegion: region }));
        });

        setAllParcelles(enriched);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Scroll selected row into view ──
  useEffect(() => {
    if (!selectedId || !tableBodyRef.current) return;
    const row = tableBodyRef.current.querySelector(`[data-id="${selectedId}"]`);
    if (row) row.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  // ── Filter options ──
  const cultures = useMemo(() => {
    const u = Array.from(new Set(allParcelles.map((p) => p.culture).filter(Boolean))).sort();
    return ["Tous", ...u];
  }, [allParcelles]);

  const regions = useMemo(() => {
    const u = Array.from(new Set(allParcelles.map((p) => p.farmerRegion).filter((r) => r !== "—"))).sort();
    return ["Tous", ...u];
  }, [allParcelles]);

  // ── Filtered + sorted + paginated ──
  const filtered = useMemo(() => {
    return allParcelles.filter((p) => {
      if (filterCulture !== "Tous" && p.culture !== filterCulture) return false;
      if (filterRegion  !== "Tous" && p.farmerRegion !== filterRegion) return false;
      const ndvi = p.ndvi ?? -1;
      if (ndvi < ndviMin || ndvi > ndviMax) return false;
      return true;
    });
  }, [allParcelles, filterCulture, filterRegion, ndviMin, ndviMax]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a.ndvi ?? -1;
      const bv = b.ndvi ?? -1;
      return sortDir === "desc" ? bv - av : av - bv;
    });
  }, [filtered, sortDir]);

  const totalPages  = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage    = Math.min(page, totalPages - 1);
  const paginated   = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const withNdvi = allParcelles.filter((p) => p.ndvi != null);
    const avgNdvi  = withNdvi.length > 0
      ? withNdvi.reduce((s, p) => s + p.ndvi!, 0) / withNdvi.length
      : 0;
    const critical = allParcelles.filter((p) => p.ndvi != null && p.ndvi < 0.2).length;
    const latestCreated = allParcelles.reduce(
      (max, p) => (p.createdAt > max ? p.createdAt : max),
      ""
    );
    return {
      total:   allParcelles.length,
      avgNdvi: avgNdvi.toFixed(3),
      critical,
      lastSync: latestCreated ? relativeTime(latestCreated) : "—",
    };
  }, [allParcelles]);

  // ── farmerNames map for map component ──
  const farmerNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    allParcelles.forEach((p) => { m[p.farmerId] = p.farmerName; });
    return m;
  }, [allParcelles]);

  function handleFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => { setter(v); setPage(0); };
  }

  // ── Loading ──
  if (loading) return <PageLoader message="Chargement des données NDVI…" />;

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height: "calc(100vh - 112px)" }}>
        <div className="text-center space-y-2">
          <p className="text-red-400 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-accent hover:underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 overflow-hidden"
      style={{ height: "calc(100vh - 112px)" }}
    >
      {/* ── Page header ── */}
      <div className="flex-shrink-0 flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>NDVI Satellite</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Indice de végétation normalisé — {allParcelles.length} parcelles
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="flex-shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total parcelles"
          value={kpis.total}
          icon="grid_view"
          color="#3b82f6"
        />
        <KPICard
          label="NDVI moyen"
          value={kpis.avgNdvi}
          icon="satellite_alt"
          color="#10b981"
        />
        <KPICard
          label="Parcelles critiques"
          value={kpis.critical}
          icon="warning"
          color="#ef4444"
        />
        <KPICard
          label="Dernière sync"
          value={kpis.lastSync}
          icon="sync"
          color="#8b5cf6"
        />
      </div>

      {/* ── Main: map + table ── */}
      <div className="flex-1 min-h-0 flex gap-4">

        {/* LEFT 60% — Map */}
        <div
          className="rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: "1px solid rgba(255,255,255,0.06)", width: "60%" }}
        >
          <NdviMapDynamic
            parcelles={allParcelles}
            farmerNames={farmerNameMap}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>

        {/* RIGHT 40% — Filters + Table + Pagination */}
        <div className="flex-1 flex flex-col min-h-0 rounded-xl bg-bg-secondary overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>

          {/* Filter bar */}
          <div className="flex-shrink-0 p-3 space-y-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex flex-wrap items-center gap-2">
              {/* Culture */}
              <select
                value={filterCulture}
                onChange={(e) => handleFilterChange(setFilterCulture)(e.target.value)}
                className="rounded-lg bg-bg-tertiary border border-gray-700 px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {cultures.map((c) => (
                  <option key={c} value={c}>
                    {c === "Tous" ? "Culture : Tous" : c}
                  </option>
                ))}
              </select>

              {/* Région */}
              <select
                value={filterRegion}
                onChange={(e) => handleFilterChange(setFilterRegion)(e.target.value)}
                className="rounded-lg bg-bg-tertiary border border-gray-700 px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {regions.map((r) => (
                  <option key={r} value={r}>
                    {r === "Tous" ? "Région : Tous" : r}
                  </option>
                ))}
              </select>

              {/* Sort toggle */}
              <button
                onClick={() => { setSortDir((d) => (d === "desc" ? "asc" : "desc")); setPage(0); }}
                className="flex items-center gap-1 rounded-lg bg-bg-tertiary border border-gray-700 px-2 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:border-accent/40 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                  {sortDir === "desc" ? "arrow_downward" : "arrow_upward"}
                </span>
                NDVI
              </button>

              {/* Result count */}
              <span className="ml-auto text-xs text-text-muted">
                {filtered.length} parcelle{filtered.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* NDVI range sliders */}
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted flex-shrink-0">NDVI</span>
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={ndviMin}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    handleFilterChange(setNdviMin)(Math.min(v, ndviMax - 0.01));
                  }}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs font-mono text-text-muted w-8 text-right">{ndviMin.toFixed(2)}</span>
                <span className="text-xs text-text-muted">→</span>
                <input
                  type="range"
                  min={0} max={1} step={0.01}
                  value={ndviMax}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    handleFilterChange(setNdviMax)(Math.max(v, ndviMin + 0.01));
                  }}
                  className="flex-1 accent-accent"
                />
                <span className="text-xs font-mono text-text-muted w-8 text-right">{ndviMax.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-text-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 36 }}>satellite_alt</span>
                <p className="text-sm">Aucune parcelle trouvée</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bg-tertiary" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {[
                      { label: "Farmer" },
                      { label: "Culture" },
                      { label: "Surface (ha)" },
                      {
                        label: "NDVI",
                        sortable: true,
                        onClick: () => { setSortDir((d) => (d === "desc" ? "asc" : "desc")); setPage(0); },
                      },
                      { label: "Statut" },
                      { label: "Région" },
                    ].map(({ label, sortable, onClick }) => (
                      <th
                        key={label}
                        onClick={onClick}
                        className={[
                          "px-3 py-2.5 text-left font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap",
                          sortable ? "cursor-pointer hover:text-text-primary select-none" : "",
                        ].join(" ")}
                      >
                        <span className="flex items-center gap-1">
                          {label}
                          {sortable && (
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                              {sortDir === "desc" ? "arrow_downward" : "arrow_upward"}
                            </span>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody ref={tableBodyRef} className="divide-y divide-gray-800">
                  {paginated.map((p) => {
                    const isSelected = p.id === selectedId;
                    const color      = ndviColor(p.ndvi);
                    const statut     = ndviStatut(p.ndvi);

                    return (
                      <tr
                        key={p.id}
                        data-id={p.id}
                        onClick={() => setSelectedId(p.id)}
                        className={[
                          "cursor-pointer transition-colors",
                          isSelected
                            ? "bg-accent/10 border-l-2 border-l-accent"
                            : "bg-bg-secondary hover:bg-bg-tertiary",
                        ].join(" ")}
                      >
                        {/* Farmer */}
                        <td className="px-3 py-2.5 text-text-primary font-medium truncate max-w-[100px]">
                          {p.farmerName}
                        </td>

                        {/* Culture */}
                        <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                          {p.culture}
                        </td>

                        {/* Surface */}
                        <td className="px-3 py-2.5 font-mono text-text-secondary text-right tabular-nums">
                          {p.surface?.toFixed(1) ?? "—"}
                        </td>

                        {/* NDVI */}
                        <td className="px-3 py-2.5 font-mono font-semibold text-right tabular-nums" style={{ color }}>
                          {p.ndvi != null ? p.ndvi.toFixed(3) : "—"}
                        </td>

                        {/* Statut */}
                        <td className="px-3 py-2.5">
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{
                              color,
                              backgroundColor: `${color}18`,
                              border: `1px solid ${color}40`,
                            }}
                          >
                            {statut}
                          </span>
                        </td>

                        {/* Région */}
                        <td className="px-3 py-2.5 text-text-secondary whitespace-nowrap">
                          {p.farmerRegion}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          <div className="flex-shrink-0 px-3 py-2.5 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs text-text-muted">
              Page {safePage + 1} / {totalPages}
              <span className="ml-2">
                ({safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, sorted.length)} sur {sorted.length})
              </span>
            </p>
            <div className="flex items-center gap-1">
              <button
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-bg-tertiary border border-gray-700 text-text-secondary hover:text-text-primary hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const offset = Math.max(0, Math.min(safePage - 2, totalPages - 5));
                const pg = i + offset;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={[
                      "w-7 h-7 flex items-center justify-center rounded-lg border text-xs font-mono transition-colors",
                      pg === safePage
                        ? "bg-accent/10 border-accent/40 text-accent"
                        : "bg-bg-tertiary border-gray-700 text-text-secondary hover:border-accent/40 hover:text-text-primary",
                    ].join(" ")}
                  >
                    {pg + 1}
                  </button>
                );
              })}
              <button
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="w-7 h-7 flex items-center justify-center rounded-lg bg-bg-tertiary border border-gray-700 text-text-secondary hover:text-text-primary hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
