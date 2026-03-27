"use client";

import dynamic from "next/dynamic";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import KPICard from "@/src/components/ui/KPICard";
import {
  cooperatives as cooperativesApi,
  farmers as farmersApi,
  scores as scoresApi,
} from "@/src/lib/api";
import { exportCSV, initials, scoreColor, scoreLabel } from "@/src/lib/utils";
import type { Cooperative, Farmer, WakamaScoreResult } from "@/src/types";

// ─── Dynamic map (SSR disabled) ──────────────────────────────────────────────

const PlatformMap = dynamic(() => import("@/src/components/ui/PlatformMap"), {
  ssr: false,
  loading: () => <Sk className="h-full" />,
});

// ─── Constants ───────────────────────────────────────────────────────────────

const SCORE_PRESETS = [
  { value: 0,   label: "Tous" },
  { value: 300, label: "≥300 REMUCI" },
  { value: 400, label: "≥400 Baobab Prod" },
  { value: 600, label: "≥600 Campagne" },
  { value: 700, label: "≥700 NSIA" },
] as const;

const ELIGIBILITY = [
  { label: "R",  title: "REMUCI",      min: 300 },
  { label: "BP", title: "Baobab Prod", min: 400 },
  { label: "BC", title: "Baobab Camp", min: 600 },
  { label: "N",  title: "NSIA",        min: 700 },
];

const PAGE_SIZES = [10, 25, 50] as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg bg-bg-tertiary ${className ?? ""}`} style={style} />;
}

function SkRow() {
  return (
    <tr className="border-b border-gray-800">
      {Array.from({ length: 8 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Sk className="h-4" style={{ width: `${50 + (i * 17) % 40}%` } as React.CSSProperties} />
        </td>
      ))}
    </tr>
  );
}

// ─── Select helper ────────────────────────────────────────────────────────────

function FilterSelect({
  value,
  onChange,
  children,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 rounded-lg bg-bg-tertiary border border-gray-700 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors ${className ?? ""}`}
    >
      {children}
    </select>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function FarmersPage() {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Data state ──────────────────────────────────────────────────────────────

  const [loading, setLoading]     = useState(true);
  const [farmersList, setFarmersList] = useState<Farmer[]>([]);
  const [coops, setCoops]         = useState<Cooperative[]>([]);
  const [scoreMap, setScoreMap]   = useState<Record<string, WakamaScoreResult>>({});
  const [total, setTotal]         = useState(0);
  const [error, setError]         = useState<string | null>(null);

  // ── UI state ────────────────────────────────────────────────────────────────

  const [showMap, setShowMap]         = useState(false);
  const [search, setSearch]           = useState("");
  const [debouncedSearch, setDebounced] = useState("");
  const [scoreMin, setScoreMin]       = useState(0);
  const [coopFilter, setCoopFilter]   = useState("");
  const [regionFilter, setRegionFilter] = useState("");
  const [kycFilter, setKycFilter]     = useState<"all" | "validated" | "pending">("all");
  const [page, setPage]               = useState(1);
  const [pageSize, setPageSize]       = useState<10 | 25 | 50>(10);

  // ── Debounce search ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Locale prefix ───────────────────────────────────────────────────────────

  const localePrefix = useMemo(() => {
    const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
    return m ? `/${m[1]}` : "";
  }, [pathname]);

  // ── Fetch ───────────────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [farmersRes, coopsRes] = await Promise.all([
        farmersApi.list({ limit: 50 }),
        cooperativesApi.list(),
      ]);

      const fetchedFarmers = farmersRes.data;
      setFarmersList(fetchedFarmers);
      setTotal(farmersRes.total);
      setCoops(Array.isArray(coopsRes) ? coopsRes : []);

      // Fetch all scores in parallel (best-effort)
      const settled = await Promise.allSettled(
        fetchedFarmers.map((f) => scoresApi.getFarmer(f.id))
      );
      const map: Record<string, WakamaScoreResult> = {};
      settled.forEach((r, i) => {
        if (r.status === "fulfilled") map[fetchedFarmers[i].id] = r.value;
      });
      setScoreMap(map);
    } catch {
      setError("Impossible de charger les agriculteurs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // ── Derived lookups ─────────────────────────────────────────────────────────

  const coopNameMap = useMemo(
    () => new Map(coops.map((c) => [c.id, c.nom])),
    [coops]
  );

  const regions = useMemo(
    () => [...new Set(farmersList.map((f) => f.region).filter(Boolean))].sort(),
    [farmersList]
  );

  // ── Client-side filtering ───────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return farmersList.filter((f) => {
      if (q && !`${f.nom} ${f.prenom} ${f.id}`.toLowerCase().includes(q)) return false;
      if (scoreMin > 0 && (scoreMap[f.id]?.score ?? 0) < scoreMin) return false;
      if (coopFilter && f.cooperativeId !== coopFilter) return false;
      if (regionFilter && f.region !== regionFilter) return false;
      if (kycFilter === "validated" && !f.cniUrl) return false;
      if (kycFilter === "pending"   && !!f.cniUrl) return false;
      return true;
    });
  }, [farmersList, debouncedSearch, scoreMin, coopFilter, regionFilter, kycFilter, scoreMap]);

  // ── KPI derived values ──────────────────────────────────────────────────────

  const scores      = useMemo(() => Object.values(scoreMap), [scoreMap]);
  const avgScore    = scores.length
    ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
    : 0;
  const kycCount    = farmersList.filter((f) => f.cniUrl).length;
  const eligCount   = scores.filter((s) => s.score >= 300).length;

  // ── Pagination ──────────────────────────────────────────────────────────────

  const totalPages  = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage    = Math.min(page, totalPages);
  const paginated   = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  function resetPage() { setPage(1); }

  // ── Export ───────────────────────────────────────────────────────────────────

  function handleExport() {
    exportCSV(
      filtered.map((f) => {
        const s = scoreMap[f.id];
        return {
          ID:             f.id,
          Nom:            f.nom,
          Prénom:         f.prenom,
          Région:         f.region,
          Village:        f.village,
          Coopérative:    f.cooperativeId ? (coopNameMap.get(f.cooperativeId) ?? "—") : "—",
          Score:          s?.score ?? "",
          Niveau:         s ? scoreLabel(s.score) : "",
          KYC:            f.cniUrl ? "Validé" : "En attente",
          CreatedAt:      f.createdAt,
        } as Record<string, unknown>;
      }),
      "agriculteurs.csv"
    );
  }

  // ── Navigate to farmer detail ────────────────────────────────────────────────

  function goToFarmer(id: string) {
    router.push(`${localePrefix}/farmers/${id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-text-primary">Agriculteurs</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/30 text-xs font-semibold text-accent font-mono">
            {total.toLocaleString("fr-FR")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMap((v) => !v)}
            className={[
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border transition-colors",
              showMap
                ? "bg-accent/10 text-accent border-accent/30"
                : "bg-bg-secondary text-text-secondary border-gray-700 hover:bg-bg-hover hover:text-text-primary",
            ].join(" ")}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              map
            </span>
            Voir carte
          </button>
          <button
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-bg-secondary text-text-secondary border border-gray-700 hover:bg-bg-hover hover:text-text-primary disabled:opacity-40 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              download
            </span>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-800 text-sm text-red-400">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      {/* ── KPI row ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-32" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Total agriculteurs"
            value={total.toLocaleString("fr-FR")}
            sub={`${farmersList.length} chargés`}
            icon="groups"
            color="#10b981"
          />
          <KPICard
            label="Score moyen"
            value={avgScore > 0 ? avgScore : "—"}
            sub={`sur ${scores.length} scorés`}
            icon="grade"
            color={scoreColor(avgScore)}
          />
          <KPICard
            label="KYC validés"
            value={kycCount}
            sub={`${farmersList.length > 0 ? Math.round((kycCount / farmersList.length) * 100) : 0}% du portefeuille`}
            icon="verified_user"
            color="#3b82f6"
          />
          <KPICard
            label="Éligibles crédit"
            value={eligCount}
            sub="score ≥300 (REMUCI)"
            icon="request_quote"
            color="#f59e0b"
          />
        </div>
      )}

      {/* ── Carte toggle ── */}
      {showMap && (
        <div className="rounded-xl border border-gray-800 overflow-hidden" style={{ height: 320 }}>
          <PlatformMap farmers={filtered} coops={coops} />
        </div>
      )}

      {/* ── Filters bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <span
            className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-text-muted pointer-events-none"
            style={{ fontSize: 16 }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher nom, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-3 py-2 rounded-lg bg-bg-tertiary border border-gray-700 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors w-52"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
            </button>
          )}
        </div>

        {/* Score min */}
        <FilterSelect value={String(scoreMin)} onChange={(v) => { setScoreMin(Number(v)); resetPage(); }}>
          {SCORE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </FilterSelect>

        {/* Coopérative */}
        <FilterSelect value={coopFilter} onChange={(v) => { setCoopFilter(v); resetPage(); }}>
          <option value="">Toutes les coops</option>
          {coops.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </FilterSelect>

        {/* Région */}
        <FilterSelect value={regionFilter} onChange={(v) => { setRegionFilter(v); resetPage(); }}>
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </FilterSelect>

        {/* KYC */}
        <FilterSelect value={kycFilter} onChange={(v) => { setKycFilter(v as typeof kycFilter); resetPage(); }}>
          <option value="all">KYC — Tous</option>
          <option value="validated">Validé</option>
          <option value="pending">En attente</option>
        </FilterSelect>

        {/* Active filter count + clear */}
        {(debouncedSearch || scoreMin > 0 || coopFilter || regionFilter || kycFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setScoreMin(0); setCoopFilter(""); setRegionFilter(""); setKycFilter("all"); resetPage(); }}
            className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs text-text-secondary border border-gray-700 hover:bg-bg-hover transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>filter_alt_off</span>
            Réinitialiser
          </button>
        )}

        <span className="ml-auto text-xs text-text-muted">
          {filtered.length !== farmersList.length
            ? `${filtered.length} / ${farmersList.length} agriculteurs`
            : `${farmersList.length} agriculteurs`}
        </span>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl border border-gray-800 overflow-hidden bg-bg-secondary">

        {/* Table toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>Afficher</span>
            {PAGE_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => { setPageSize(s); resetPage(); }}
                className={[
                  "px-2 py-0.5 rounded font-medium transition-colors",
                  pageSize === s
                    ? "bg-accent text-white"
                    : "hover:bg-bg-hover text-text-secondary",
                ].join(" ")}
              >
                {s}
              </button>
            ))}
            <span>par page</span>
          </div>
          <p className="text-xs text-text-muted">
            {filtered.length === 0
              ? "Aucun résultat"
              : `${(safePage - 1) * pageSize + 1}–${Math.min(safePage * pageSize, filtered.length)} sur ${filtered.length}`}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-gray-900">
                {[
                  "Agriculteur",
                  "Région / Village",
                  "Coopérative",
                  "Score Wakama",
                  "Éligibilité",
                  "KYC",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkRow key={i} />)
                : paginated.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center text-sm text-text-muted">
                      Aucun agriculteur ne correspond aux filtres sélectionnés
                    </td>
                  </tr>
                )
                : paginated.map((farmer) => {
                    const score   = scoreMap[farmer.id];
                    const sval    = score?.score;
                    const coopNom = farmer.cooperativeId
                      ? (coopNameMap.get(farmer.cooperativeId) ?? "—")
                      : "—";

                    return (
                      <tr
                        key={farmer.id}
                        className="border-b border-gray-800 last:border-0 hover:bg-gray-800/40 cursor-pointer transition-colors"
                        onClick={() => goToFarmer(farmer.id)}
                      >
                        {/* Farmer: avatar + nom + ID */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20 text-accent text-xs font-bold shrink-0">
                              {initials(farmer.nom, farmer.prenom)}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-text-primary truncate max-w-36">
                                {farmer.prenom} {farmer.nom}
                              </p>
                              <p className="text-xs font-mono text-text-muted truncate">
                                #{farmer.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Région / Village */}
                        <td className="px-4 py-3">
                          <p className="text-text-primary text-sm">{farmer.region}</p>
                          <p className="text-text-muted text-xs">{farmer.village}</p>
                        </td>

                        {/* Coopérative */}
                        <td className="px-4 py-3">
                          <span className="text-sm text-text-secondary">{coopNom}</span>
                        </td>

                        {/* Score Wakama */}
                        <td className="px-4 py-3">
                          {sval != null ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className="text-sm font-bold font-mono"
                                  style={{ color: scoreColor(sval) }}
                                >
                                  {sval}
                                </span>
                                <span
                                  className="text-xs px-1.5 py-0.5 rounded font-medium"
                                  style={{
                                    color: scoreColor(sval),
                                    backgroundColor: `${scoreColor(sval)}1a`,
                                  }}
                                >
                                  {scoreLabel(sval)}
                                </span>
                              </div>
                              <div className="w-20 h-1 rounded-full bg-bg-tertiary overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${sval / 10}%`,
                                    backgroundColor: scoreColor(sval),
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">—</span>
                          )}
                        </td>

                        {/* Éligibilité — 4 icons */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {ELIGIBILITY.map(({ label, title, min }) => {
                              const ok = sval != null && sval >= min;
                              return (
                                <span
                                  key={label}
                                  title={`${title} ≥${min}`}
                                  className="material-symbols-outlined transition-opacity"
                                  style={{
                                    fontSize: 16,
                                    color: ok ? "#10b981" : "#374151",
                                    fontVariationSettings:
                                      '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                                  }}
                                >
                                  {ok ? "check_circle" : "radio_button_unchecked"}
                                </span>
                              );
                            })}
                          </div>
                        </td>

                        {/* KYC */}
                        <td className="px-4 py-3">
                          {farmer.cniUrl ? (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-800">
                              <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}>
                                check_circle
                              </span>
                              Validé
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-800">
                              <span className="material-symbols-outlined" style={{ fontSize: 11, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}>
                                schedule
                              </span>
                              En attente
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => goToFarmer(farmer.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
                            title="Voir le dossier"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                              visibility
                            </span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>

        {/* ── Pagination ── */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <p className="text-xs text-text-muted">
              Page {safePage} sur {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={safePage === 1}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Première page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>first_page</span>
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage === 1}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
              </button>

              {/* Page numbers with ellipsis */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "…" ? (
                    <span key={`e-${i}`} className="px-1 text-xs text-text-muted">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className={[
                        "flex items-center justify-center w-7 h-7 rounded-md text-xs font-medium transition-colors",
                        p === safePage
                          ? "bg-accent text-white"
                          : "text-text-secondary hover:bg-bg-hover",
                      ].join(" ")}
                    >
                      {p}
                    </button>
                  )
                )}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage === totalPages}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={safePage === totalPages}
                className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Dernière page"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>last_page</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
