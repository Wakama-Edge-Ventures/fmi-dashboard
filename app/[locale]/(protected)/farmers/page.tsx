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
import { getInstitutionId } from "@/src/lib/auth";
import {
  applyCustomWeights,
  getActiveConfig,
  hasCustomWeights,
  type InstitutionScoringConfig,
} from "@/src/lib/scoringConfig";
import { exportCSV, getFarmerDisplayName, getFarmerInitials, scoreColor, scoreLabel } from "@/src/lib/utils";
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

// Eligibility is now derived from scoring config (see state below)

const API_PAGE_SIZE = 20;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse rounded-lg ${className ?? ""}`} style={{ background: "#111a2e", ...style }} />;
}

function SkRow() {
  return (
    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <td key={i} style={{ padding: "10px 12px" }}>
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
      style={{
        height: 30,
        padding: "0 10px",
        background: "#0a1020",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 6,
        color: "#e8edf5",
        fontSize: 12,
        outline: "none",
        cursor: "pointer",
      }}
    >
      {children}
    </select>
  );
}

// ─── Page component ───────────────────────────────────────────────────────────

export default function FarmersPage() {
  const router   = useRouter();
  const pathname = usePathname();

  // ── Scoring config ───────────────────────────────────────────────────────────

  const [scoringConfig, setScoringConfig] = useState<InstitutionScoringConfig | null>(null);

  useEffect(() => {
    const id = getInstitutionId();
    setScoringConfig(getActiveConfig(id));
  }, []);

  // ── Data state ──────────────────────────────────────────────────────────────

  const [loading,     setLoading]     = useState(true);
  const [farmersList, setFarmersList] = useState<Farmer[]>([]);
  const [coops,       setCoops]       = useState<Cooperative[]>([]);
  const [scoreMap,    setScoreMap]    = useState<Record<string, WakamaScoreResult>>({});
  const [total,       setTotal]       = useState(0);
  const [error,       setError]       = useState<string | null>(null);

  // ── UI / pagination state ────────────────────────────────────────────────────

  const [showMap,       setShowMap]       = useState(false);
  const [search,        setSearch]        = useState("");
  const [debouncedSearch, setDebounced]   = useState("");
  const [scoreMin,      setScoreMin]      = useState(0);
  const [coopFilter,    setCoopFilter]    = useState("");
  const [regionFilter,  setRegionFilter]  = useState("");
  const [kycFilter,     setKycFilter]     = useState<"all" | "validated" | "pending">("all");
  const [apiPage,       setApiPage]       = useState(1);

  // ── Debounce search ─────────────────────────────────────────────────────────

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Locale prefix ───────────────────────────────────────────────────────────

  const localePrefix = useMemo(() => {
    const m = pathname.match(/^\/([a-z]{2})(\/|$)/);
    return m ? `/${m[1]}` : "";
  }, [pathname]);

  // ── Fetch (server-side page) ─────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [farmersRes, coopsRes] = await Promise.all([
        farmersApi.list({ limit: API_PAGE_SIZE, page: apiPage }),
        cooperativesApi.list(),
      ]);

      const fetchedFarmers = farmersRes.data;
      setFarmersList(fetchedFarmers);
      setTotal(farmersRes.total);
      setCoops(Array.isArray(coopsRes) ? coopsRes : []);

      // Fetch scores in parallel (best-effort)
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
  }, [apiPage]);

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

  // ── Client-side filtering (within current server page) ──────────────────────

  const filtered = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return farmersList.filter((f) => {
      if (q && !`${getFarmerDisplayName(f)} ${f.id}`.toLowerCase().includes(q)) return false;
      if (scoreMin > 0 && (scoreMap[f.id]?.score ?? 0) < scoreMin) return false;
      if (coopFilter && f.cooperativeId !== coopFilter) return false;
      if (regionFilter && f.region !== regionFilter) return false;
      if (kycFilter === "validated" && !f.cniUrl) return false;
      if (kycFilter === "pending"   && !!f.cniUrl) return false;
      return true;
    });
  }, [farmersList, debouncedSearch, scoreMin, coopFilter, regionFilter, kycFilter, scoreMap]);

  // ── KPI derived values ──────────────────────────────────────────────────────

  const scores    = useMemo(() => Object.values(scoreMap), [scoreMap]);
  const avgScore  = scores.length
    ? Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length)
    : 0;
  const kycCount  = farmersList.filter((f) => f.cniUrl).length;
  const eligCount = scores.filter((s) => s.score >= 300).length;

  // ── Server-side pagination ───────────────────────────────────────────────────

  const totalServerPages = Math.max(1, Math.ceil(total / API_PAGE_SIZE));

  // ── Export ───────────────────────────────────────────────────────────────────

  function handleExport() {
    exportCSV(
      filtered.map((f) => {
        const s = scoreMap[f.id];
        return {
          ID:          f.id,
          Nom:         f.nom,
          Prénom:      f.prenom,
          Région:      f.region,
          Village:     f.village,
          Coopérative: f.cooperativeId ? (coopNameMap.get(f.cooperativeId) ?? "—") : "—",
          Score:       s?.score ?? "",
          Niveau:      s ? scoreLabel(s.score) : "",
          KYC:         f.cniUrl ? "Validé" : "En attente",
          CreatedAt:   f.createdAt,
        } as Record<string, unknown>;
      }),
      "agriculteurs.csv"
    );
  }

  function goToFarmer(id: string) {
    router.push(`${localePrefix}/farmers/${id}`);
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Agriculteurs</p>
          <span className="mono" style={{ fontSize: 11, padding: "2px 8px", borderRadius: 9999, background: "rgba(16,185,129,0.1)", color: "#10b981" }}>
            {total.toLocaleString("fr-FR")}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setShowMap((v) => !v)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: showMap ? "rgba(16,185,129,0.1)" : "transparent",
              color: showMap ? "#10b981" : "#5a6a85",
              border: showMap ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.06)",
              cursor: "pointer",
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>map</span>
            Carte
          </button>
          <button
            onClick={handleExport}
            disabled={loading || filtered.length === 0}
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              height: 30, padding: "0 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
              background: "transparent", color: "#5a6a85",
              border: "1px solid rgba(255,255,255,0.06)",
              cursor: (loading || filtered.length === 0) ? "not-allowed" : "pointer",
              opacity: (loading || filtered.length === 0) ? 0.4 : 1,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>download</span>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", fontSize: 12, color: "#ef4444" }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
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
            sub={`${farmersList.length} sur cette page`}
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
            sub={`${farmersList.length > 0 ? Math.round((kycCount / farmersList.length) * 100) : 0}% de la page`}
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
        <div style={{ borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden", height: 320 }}>
          <PlatformMap farmers={filtered} coops={coops} />
        </div>
      )}

      {/* ── Filters bar ── */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {/* Search */}
        <div style={{ position: "relative" }}>
          <span
            className="material-symbols-outlined"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#3a4a60", pointerEvents: "none", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher nom, ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ height: 30, paddingLeft: 32, paddingRight: search ? 28 : 10, background: "#0a1020", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 6, color: "#e8edf5", fontSize: 12, outline: "none", width: 200 }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#3a4a60", padding: 0 }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>close</span>
            </button>
          )}
        </div>

        <FilterSelect value={String(scoreMin)} onChange={(v) => setScoreMin(Number(v))}>
          {SCORE_PRESETS.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </FilterSelect>

        <FilterSelect value={coopFilter} onChange={setCoopFilter}>
          <option value="">Toutes les coops</option>
          {coops.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
        </FilterSelect>

        <FilterSelect value={regionFilter} onChange={setRegionFilter}>
          <option value="">Toutes les régions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </FilterSelect>

        <FilterSelect value={kycFilter} onChange={(v) => setKycFilter(v as typeof kycFilter)}>
          <option value="all">KYC — Tous</option>
          <option value="validated">Validé</option>
          <option value="pending">En attente</option>
        </FilterSelect>

        {(debouncedSearch || scoreMin > 0 || coopFilter || regionFilter || kycFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setScoreMin(0); setCoopFilter(""); setRegionFilter(""); setKycFilter("all"); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 4, height: 30, padding: "0 10px", borderRadius: 6, fontSize: 11, color: "#5a6a85", background: "transparent", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>filter_alt_off</span>
            Reset
          </button>
        )}

        <span style={{ marginLeft: "auto", fontSize: 11, color: "#3a4a60" }}>
          {filtered.length !== farmersList.length
            ? `${filtered.length} / ${farmersList.length} sur page`
            : `${farmersList.length} agriculteurs`}
        </span>
      </div>

      {/* ── Table ── */}
      <div style={{ background: "#0d1423", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>

        {/* Table toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 11, color: "#5a6a85" }}>
            {loading
              ? "Chargement…"
              : filtered.length === 0
              ? "Aucun résultat"
              : `${filtered.length} agriculteur${filtered.length > 1 ? "s" : ""} sur cette page`}
          </p>
          <p className="mono" style={{ fontSize: 10, color: "#3a4a60" }}>
            {API_PAGE_SIZE} par page
          </p>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  "Agriculteur",
                  "Région / Village",
                  "Coopérative",
                  "Score Wakama",
                  "Éligibilité",
                  "KYC",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className="label-xs"
                    style={{ height: 32, padding: "0 12px", textAlign: "left", whiteSpace: "nowrap" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkRow key={i} />)
                : filtered.length === 0
                ? (
                  <tr>
                    <td colSpan={7} style={{ padding: "48px 12px", textAlign: "center", fontSize: 12, color: "#5a6a85" }}>
                      Aucun agriculteur ne correspond aux filtres sélectionnés
                    </td>
                  </tr>
                )
                : filtered.map((farmer) => {
                    const score   = scoreMap[farmer.id];
                    const sval    = score?.score;
                    const coopNom = farmer.cooperativeId
                      ? (coopNameMap.get(farmer.cooperativeId) ?? "—")
                      : "—";

                    return (
                      <tr
                        key={farmer.id}
                        style={{ height: 44, borderBottom: "1px solid rgba(255,255,255,0.03)", cursor: "pointer", transition: "background 120ms" }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "rgba(255,255,255,0.02)"; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "transparent"; }}
                        onClick={() => goToFarmer(farmer.id)}
                      >
                        {/* Farmer: avatar + nom + ID */}
                        <td style={{ padding: "0 12px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(16,185,129,0.12)", color: "#10b981", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                              {getFarmerInitials(farmer)}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 12, fontWeight: 500, color: "#e8edf5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                                {getFarmerDisplayName(farmer)}
                              </p>
                              <p className="mono" style={{ fontSize: 10, color: "#3a4a60" }}>
                                #{farmer.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Région / Village */}
                        <td style={{ padding: "0 12px" }}>
                          <p style={{ fontSize: 12, color: "#e8edf5" }}>{farmer.region}</p>
                          <p style={{ fontSize: 10, color: "#5a6a85" }}>{farmer.village}</p>
                        </td>

                        {/* Coopérative */}
                        <td style={{ padding: "0 12px", fontSize: 12, color: "#5a6a85" }}>
                          {coopNom}
                        </td>

                        {/* Score Wakama */}
                        <td style={{ padding: "0 12px" }}>
                          {sval != null ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: scoreColor(sval) }}>
                                  {sval}
                                </span>
                                <span style={{ fontSize: 10, fontWeight: 500, padding: "1px 5px", borderRadius: 4, color: scoreColor(sval), background: `${scoreColor(sval)}1a` }}>
                                  {scoreLabel(sval)}
                                </span>
                              </div>
                              <div style={{ width: 64, height: 2, borderRadius: 9999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                                <div style={{ height: "100%", borderRadius: 9999, width: `${sval / 10}%`, background: scoreColor(sval) }} />
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#3a4a60" }}>—</span>
                          )}
                        </td>

                        {/* Éligibilité — config-driven icons */}
                        <td style={{ padding: "0 12px" }}>
                          {(() => {
                            const adjScore = (score && scoringConfig)
                              ? applyCustomWeights({ c1: score.c1, c2: score.c2, c3: score.c3, c4: score.c4 }, scoringConfig)
                              : sval;
                            const products = scoringConfig?.products.filter((p) => p.active) ?? [];
                            return (
                              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                  {products.map((p) => {
                                    const ok = adjScore != null && adjScore >= p.minScore;
                                    return (
                                      <span
                                        key={p.id}
                                        title={`${p.name} ≥${p.minScore}`}
                                        className="material-symbols-outlined"
                                        style={{
                                          fontSize: 14,
                                          color: ok ? "#10b981" : "#3a4a60",
                                          fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 20',
                                        }}
                                      >
                                        {ok ? "check_circle" : "radio_button_unchecked"}
                                      </span>
                                    );
                                  })}
                                </div>
                                {scoringConfig && hasCustomWeights(scoringConfig) && adjScore != null && (
                                  <span style={{ fontSize: 9, color: "#06b6d4" }}>ajusté</span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* KYC */}
                        <td style={{ padding: "0 12px" }}>
                          {farmer.cniUrl ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 9999, background: "rgba(16,185,129,0.12)", color: "#10b981" }}>
                              Validé
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 9999, background: "rgba(245,158,11,0.12)", color: "#f59e0b" }}>
                              En attente
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "0 12px" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => goToFarmer(farmer.id)}
                            style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, background: "transparent", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#5a6a85" }}
                            title="Voir le dossier"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>
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

        {/* ── Server-side pagination ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <p style={{ fontSize: 11, color: "#5a6a85" }}>
            Page <span style={{ fontWeight: 600, color: "#e8edf5" }}>{apiPage}</span> sur{" "}
            <span style={{ fontWeight: 600, color: "#e8edf5" }}>{totalServerPages}</span>
            <span style={{ marginLeft: 8, color: "#3a4a60" }}>({total.toLocaleString("fr-FR")} au total)</span>
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {[
              { icon: "first_page", action: () => setApiPage(1), disabled: loading || apiPage === 1, title: "Première" },
              { icon: "chevron_left", action: () => setApiPage((p) => Math.max(1, p - 1)), disabled: loading || apiPage === 1 },
              { icon: "chevron_right", action: () => setApiPage((p) => Math.min(totalServerPages, p + 1)), disabled: loading || apiPage === totalServerPages },
              { icon: "last_page", action: () => setApiPage(totalServerPages), disabled: loading || apiPage === totalServerPages, title: "Dernière" },
            ].map((btn, i) => (
              <button
                key={i}
                onClick={btn.action}
                disabled={btn.disabled}
                title={btn.title}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: 5, background: "#0d1423", border: "1px solid rgba(255,255,255,0.06)", cursor: btn.disabled ? "not-allowed" : "pointer", opacity: btn.disabled ? 0.3 : 1, color: "#5a6a85" }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>{btn.icon}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
