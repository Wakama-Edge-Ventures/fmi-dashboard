"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import KPICard from "@/src/components/ui/KPICard";
import PageLoader from "@/src/components/ui/PageLoader";
import {
  cooperatives as cooperativesApi,
  scores as scoresApi,
} from "@/src/lib/api";
import {
  formatScore,
  initials,
  scoreColor,
} from "@/src/lib/utils";
import type { Cooperative, CoopScoreResult } from "@/src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreMap = Record<string, CoopScoreResult>;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CooperativesPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "fr";

  // ── Data state ──
  const [coops,    setCoops]    = useState<Cooperative[]>([]);
  const [scoreMap, setScoreMap] = useState<ScoreMap>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);

  // ── Filter state ──
  const [search,    setSearch]    = useState("");
  const [scoreMin,  setScoreMin]  = useState<number | "">("");
  const [filiere,   setFiliere]   = useState("Tous");
  const [certif,    setCertif]    = useState("Tous");

  // ── Fetch ──
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const coopsData = await cooperativesApi.list();
        const coopsList: Cooperative[] = Array.isArray(coopsData)
          ? coopsData
          : (coopsData as { data?: Cooperative[] })?.data ?? [];

        setCoops(coopsList);

        const scoreResults = await Promise.allSettled(
          coopsList.map((c) => scoresApi.getCoop(c.id))
        );

        const map: ScoreMap = {};
        coopsList.forEach((c, i) => {
          const r = scoreResults[i];
          if (r.status === "fulfilled") map[c.id] = r.value;
        });
        setScoreMap(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Derived filter options ──
  const filiereOptions = useMemo(() => {
    const unique = Array.from(
      new Set(coops.map((c) => c.filiere).filter(Boolean))
    ) as string[];
    return ["Tous", ...unique.sort()];
  }, [coops]);

  // ── Filtered list ──
  const filtered = useMemo(() => {
    return coops.filter((c) => {
      const q = search.toLowerCase();
      const coopNameSearch = (c.name ?? c.nom ?? "").toLowerCase();
      if (q && !coopNameSearch.includes(q) && !c.region.toLowerCase().includes(q)) return false;

      const avg = scoreMap[c.id]?.avgScore ?? c.avgScore ?? 0;
      if (scoreMin !== "" && avg < scoreMin) return false;

      if (filiere !== "Tous" && c.filiere !== filiere) return false;

      if (certif === "Certifiée" && c.certification === "Aucune certification") return false;
      if (certif === "Non certifiée" && c.certification && c.certification !== "Aucune certification") return false;

      return true;
    });
  }, [coops, scoreMap, search, scoreMin, filiere, certif]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const scores = coops
      .map((c) => scoreMap[c.id]?.avgScore ?? c.avgScore ?? 0)
      .filter((s) => s > 0);
    const avgPortfolio = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
    const eligibles = coops.filter(
      (c) => (scoreMap[c.id]?.avgScore ?? c.avgScore ?? 0) >= 600
    ).length;
    const totalFarmers = coops.reduce(
      (sum, c) => sum + (scoreMap[c.id]?.totalFarmers ?? c.totalFarmers ?? 0),
      0
    );
    return { total: coops.length, avgPortfolio, eligibles, totalFarmers };
  }, [coops, scoreMap]);

  // ── Loading ──
  if (loading) return <PageLoader message="Chargement des coopératives…" />;

  // ── Error ──
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-medium">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-accent hover:underline"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>
            Coopératives
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Réseau partenaire — {coops.length} coopératives enregistrées
          </p>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total coopératives"
          value={kpis.total}
          icon="groups"
        />
        <KPICard
          label="Score moyen portefeuille"
          value={kpis.avgPortfolio}
          icon="equalizer"
          color={scoreColor(kpis.avgPortfolio)}
        />
        <KPICard
          label="Éligibles crédit bancaire"
          value={kpis.eligibles}
          icon="verified"
          color="#10b981"
        />
        <KPICard
          label="Farmers couverts"
          value={kpis.totalFarmers.toLocaleString("fr-FR")}
          icon="person"
        />
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
            style={{ fontSize: 18 }}
          >
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher par nom ou région…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-bg-secondary border border-gray-700 text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent"
          />
        </div>

        {/* Score minimum */}
        <select
          value={scoreMin}
          onChange={(e) => setScoreMin(e.target.value === "" ? "" : Number(e.target.value))}
          className="rounded-lg bg-bg-secondary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">Score : Tous</option>
          <option value={300}>≥ 300</option>
          <option value={600}>≥ 600</option>
        </select>

        {/* Filière */}
        <select
          value={filiere}
          onChange={(e) => setFiliere(e.target.value)}
          className="rounded-lg bg-bg-secondary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {filiereOptions.map((f) => (
            <option key={f} value={f}>
              {f === "Tous" ? "Filière : Tous" : f}
            </option>
          ))}
        </select>

        {/* Certification */}
        <select
          value={certif}
          onChange={(e) => setCertif(e.target.value)}
          className="rounded-lg bg-bg-secondary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="Tous">Certification : Tous</option>
          <option value="Certifiée">Certifiée</option>
          <option value="Non certifiée">Non certifiée</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-transparent" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  "Coopérative",
                  "Région",
                  "Filière",
                  "Membres",
                  "Score moyen",
                  "Éligibles",
                  "Certification",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-text-muted">
                      <span
                        className="material-symbols-outlined"
                        style={{ fontSize: 40 }}
                      >
                        groups
                      </span>
                      <p className="text-sm">Aucune coopérative trouvée</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((coop) => {
                  const score = scoreMap[coop.id];
                  const avgScore = score?.avgScore ?? coop.avgScore ?? 0;
                  const members = score?.totalFarmers ?? coop.totalFarmers ?? 0;
                  const eligible = score?.eligible ?? 0;
                  const isCertified =
                    coop.certification && coop.certification !== "Aucune certification";

                  return (
                    <tr
                      key={coop.id}
                      className="bg-bg-secondary hover:bg-bg-tertiary transition-colors"
                    >
                      {/* Coopérative */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: "#3b82f620", color: "#3b82f6", border: "1px solid #3b82f640" }}
                          >
                            {(() => {
                              const coopName = coop.name ?? coop.nom ?? "Inconnu";
                              const parts = coopName.split(" ");
                              return initials(parts[0] ?? "", parts[1] ?? "");
                            })()}
                          </div>
                          <div>
                            <p className="font-medium text-text-primary leading-tight">
                              {coop.name ?? coop.nom ?? "—"}
                            </p>
                            <p className="text-xs text-text-muted font-mono">
                              {coop.id.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Région */}
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {coop.region}
                      </td>

                      {/* Filière */}
                      <td className="px-4 py-3">
                        {coop.filiere ? (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
                            {coop.filiere}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Membres */}
                      <td className="px-4 py-3 font-mono text-text-primary text-right tabular-nums">
                        {members.toLocaleString("fr-FR")}
                      </td>

                      {/* Score moyen */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {avgScore > 0 ? (
                          <span
                            className={`px-2 py-0.5 rounded-full border text-xs font-medium font-mono ${formatScore(avgScore)}`}
                          >
                            {avgScore}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Éligibles */}
                      <td className="px-4 py-3 text-text-secondary text-right tabular-nums font-mono">
                        {eligible > 0 ? (
                          <span className="text-emerald-400 font-semibold">{eligible}</span>
                        ) : (
                          <span className="text-text-muted">0</span>
                        )}
                      </td>

                      {/* Certification */}
                      <td className="px-4 py-3">
                        {isCertified ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium w-fit">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 13, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 16' }}
                            >
                              verified
                            </span>
                            Certifiée
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">Non certifiée</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/cooperatives/${coop.id}`}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-bg-tertiary hover:bg-accent/10 border border-gray-700 hover:border-accent/40 transition-colors"
                          title="Voir la fiche"
                        >
                          <span
                            className="material-symbols-outlined text-text-secondary hover:text-accent"
                            style={{ fontSize: 18 }}
                          >
                            visibility
                          </span>
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-4 py-3 bg-bg-tertiary" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
            <p className="text-xs text-text-muted">
              {filtered.length} coopérative{filtered.length > 1 ? "s" : ""} affichée{filtered.length > 1 ? "s" : ""}
              {filtered.length !== coops.length && ` sur ${coops.length}`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
