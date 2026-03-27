"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import KPICard from "@/src/components/ui/KPICard";
import {
  cooperatives as cooperativesApi,
  farmers as farmersApi,
  scores as scoresApi,
} from "@/src/lib/api";
import { formatFCFA, scoreColor, scoreLabel } from "@/src/lib/utils";
import type { Farmer, WakamaScoreResult } from "@/src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type ScoreEntry = { farmer: Farmer; score: WakamaScoreResult };
type Weights    = { c1: number; c2: number; c3: number; c4: number };

const DEFAULT_WEIGHTS: Weights = { c1: 25, c2: 25, c3: 25, c4: 25 };
const LS_KEY = "wakama_fmi_scoring_weights";

// ─── Distribution buckets ────────────────────────────────────────────────────

const BUCKETS = [
  { name: "0–200",   min: 0,   max: 200,  color: "#ef4444" },
  { name: "200–300", min: 200, max: 300,  color: "#ef4444" },
  { name: "300–400", min: 300, max: 400,  color: "#f59e0b" },
  { name: "400–600", min: 400, max: 600,  color: "#f59e0b" },
  { name: "600–700", min: 600, max: 700,  color: "#10b981" },
  { name: "700+",    min: 700, max: 1001, color: "#10b981" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-bg-tertiary ${className}`} />;
}

/**
 * Custom score using the spec formula:
 *   (scoreCN * weight / 100) * 10  — capped at 1000.
 * Falls back to c1/c2/c3/c4 when the scoreC* variants are absent.
 */
function calcCustomScore(score: WakamaScoreResult, w: Weights): number {
  const c1 = score.scoreC1 ?? score.c1 ?? 0;
  const c2 = score.scoreC2 ?? score.c2 ?? 0;
  const c3 = score.scoreC3 ?? score.c3 ?? 0;
  const c4 = score.scoreC4 ?? score.c4 ?? 0;
  return Math.min(
    1000,
    Math.round(
      (c1 * w.c1 / 100 + c2 * w.c2 / 100 + c3 * w.c3 / 100 + c4 * w.c4 / 100) * 10
    )
  );
}

/** Compact revenue display for KPI card value field */
function compactFCFA(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mrd`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(0)} M`;
  return Math.round(n).toLocaleString("fr-FR");
}

const TOOLTIP_STYLE = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: 8,
  fontSize: 12,
};

const C_LABELS: Record<keyof Weights, string> = {
  c1: "C1 — Capacité",
  c2: "C2 — Caractère",
  c3: "C3 — Collatéral",
  c4: "C4 — Conditions",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ScoringPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "fr";

  const [loading, setLoading]           = useState(true);
  const [entries, setEntries]           = useState<ScoreEntry[]>([]);
  const [weights, setWeights]           = useState<Weights>(DEFAULT_WEIGHTS);
  const [weightsApplied, setWeightsApplied] = useState(false);
  const [thresholds, setThresholds]     = useState({
    minScore: 300,
    maxDebt: 35,
    anciennete: "Aucune",
  });

  const weightTotal = weights.c1 + weights.c2 + weights.c3 + weights.c4;

  // ── Load saved weights ─────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        setWeights(JSON.parse(saved) as Weights);
        setWeightsApplied(true);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        // Round 1 — farmers + coops in parallel
        const [farmersRes] = await Promise.allSettled([
          farmersApi.list({ limit: 100 }),
          cooperativesApi.list(),
        ]);
        const farmersData =
          farmersRes.status === "fulfilled"
            ? farmersRes.value
            : { data: [], total: 0, page: 1, limit: 100 };

        // Round 2 — scores for every farmer
        const scoreResults = await Promise.allSettled(
          farmersData.data.map((f) => scoresApi.getFarmer(f.id))
        );

        const built: ScoreEntry[] = [];
        scoreResults.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value && farmersData.data[i]) {
            built.push({ farmer: farmersData.data[i], score: r.value });
          }
        });
        setEntries(built);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  // ── Derived ────────────────────────────────────────────────────────────────

  const avgScore = useMemo(
    () =>
      entries.length
        ? Math.round(entries.reduce((s, e) => s + e.score.score, 0) / entries.length)
        : 0,
    [entries]
  );

  const eligibles = useMemo(
    () => entries.filter((e) => e.score.score >= 300),
    [entries]
  );

  const highRisk = useMemo(
    () =>
      entries
        .filter((e) => e.score.score < 300)
        .sort((a, b) => a.score.score - b.score.score),
    [entries]
  );

  const totalRevenu = useMemo(
    () => entries.reduce((s, e) => s + (e.score.details?.c1?.revenuEstime ?? 0), 0),
    [entries]
  );

  const distribution = useMemo(
    () =>
      BUCKETS.map((b) => ({
        ...b,
        count: entries.filter(
          (e) => e.score.score >= b.min && e.score.score < b.max
        ).length,
      })),
    [entries]
  );

  const byFiliere = useMemo(() => {
    const map: Record<string, { total: number; count: number }> = {};
    entries.forEach(({ score }) => {
      const culture =
        score.details?.c1?.culturesPrincipales?.[0] ?? "Autre";
      if (!map[culture]) map[culture] = { total: 0, count: 0 };
      map[culture].total += score.score;
      map[culture].count += 1;
    });
    return Object.entries(map)
      .map(([culture, { total, count }]) => ({
        culture,
        avgScore: Math.round(total / count),
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);
  }, [entries]);

  const byRegion = useMemo(() => {
    const map: Record<string, { scores: number[]; revenu: number }> = {};
    entries.forEach(({ farmer, score }) => {
      const region = farmer.region || "Inconnu";
      if (!map[region]) map[region] = { scores: [], revenu: 0 };
      map[region].scores.push(score.score);
      map[region].revenu += score.details?.c1?.revenuEstime ?? 0;
    });
    return Object.entries(map)
      .map(([region, { scores, revenu }]) => ({
        region,
        count: scores.length,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
        eligibleCount: scores.filter((s) => s >= 300).length,
        revenuTotal: revenu,
      }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  const customPreview = useMemo(() => {
    if (weightTotal !== 100 || !entries.length) return null;
    const withCustom = entries.map((e) => ({
      ...e,
      customScore: calcCustomScore(e.score, weights),
    }));
    const eligible = withCustom.filter((e) => e.customScore >= thresholds.minScore);
    // FIX 3: avg is over eligible entries only
    const avgCustom =
      eligible.length > 0
        ? Math.round(
            eligible.reduce((s, e) => s + e.customScore, 0) / eligible.length
          )
        : 0;
    const avgMontant =
      eligible.length > 0
        ? Math.round(
            eligible.reduce((s, e) => s + (e.score.montantMax ?? 0), 0) / eligible.length
          )
        : 0;
    return { eligible: eligible.length, avgCustom, avgMontant, total: entries.length };
  }, [entries, weights, thresholds.minScore, weightTotal]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function setWeight(key: keyof Weights, val: number) {
    setWeights((w) => ({ ...w, [key]: val }));
    setWeightsApplied(false);
  }

  function handleApply() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(weights)); } catch { /* ignore */ }
    setWeightsApplied(true);
  }

  function handleReset() {
    setWeights(DEFAULT_WEIGHTS);
    setWeightsApplied(false);
    try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
  }

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Sk className="h-10 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Sk key={i} className="h-28" />)}
        </div>
        <div className="grid grid-cols-2 gap-6">
          <Sk className="h-72" />
          <Sk className="h-72" />
        </div>
        <Sk className="h-52" />
        <Sk className="h-72" />
        <Sk className="h-52" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="text-lg font-bold text-text-primary">Scoring & Risques</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Analyse du portefeuille · {entries.length} agriculteur{entries.length !== 1 ? "s" : ""} scorés
        </p>
      </div>

      {/* ═══════════════════════════════════ SECTION 1 — KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Score moyen portefeuille"
          value={avgScore}
          sub="/1000"
          icon="grade"
          color={scoreColor(avgScore)}
        />
        <KPICard
          label="Farmers éligibles (≥300)"
          value={eligibles.length}
          sub={
            entries.length
              ? `${Math.round((eligibles.length / entries.length) * 100)}% du portefeuille`
              : "—"
          }
          icon="check_circle"
          color="#10b981"
        />
        <KPICard
          label="Haut risque (<300)"
          value={highRisk.length}
          sub={
            entries.length
              ? `${Math.round((highRisk.length / entries.length) * 100)}% du portefeuille`
              : "—"
          }
          icon="warning"
          color="#ef4444"
        />
        <KPICard
          label="Revenu total estimé"
          value={compactFCFA(totalRevenu)}
          sub="FCFA — portefeuille"
          icon="payments"
          color="#10b981"
        />
      </div>

      {/* ═══════════════════════════════════ SECTION 2 — Charts */}
      <div className="grid grid-cols-2 gap-6">

        {/* Distribution des scores */}
        <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Distribution des scores
          </h3>
          <div style={{ width: "100%", height: 260, minHeight: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={distribution}
                margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#374151"
                  tick={{ fill: "#6b7280", fontSize: 10 }}
                />
                <YAxis stroke="#374151" tick={{ fill: "#6b7280", fontSize: 11 }} />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  labelStyle={{ color: "#9ca3af" }}
                  itemStyle={{ color: "#f9fafb" }}
                  formatter={(v) => [v, "Agriculteurs"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Agriculteurs">
                  {distribution.map((b, i) => (
                    <Cell key={i} fill={b.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Score par filière — horizontal bars */}
        <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-4">
            Score moyen par filière
          </h3>
          {byFiliere.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-sm text-text-muted">
              Données filière non disponibles
            </div>
          ) : (
            <div style={{ width: "100%", height: 260, minHeight: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={byFiliere}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 8, bottom: 0 }}
                >
                  <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" horizontal={false} />
                  <XAxis
                    type="number"
                    domain={[0, 1000]}
                    stroke="#374151"
                    tick={{ fill: "#6b7280", fontSize: 10 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="culture"
                    width={88}
                    stroke="#374151"
                    tick={{ fill: "#9ca3af", fontSize: 11 }}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelStyle={{ color: "#9ca3af" }}
                    itemStyle={{ color: "#f9fafb" }}
                    formatter={(v) => [v, "Score moyen"]}
                  />
                  <Bar dataKey="avgScore" radius={[0, 4, 4, 0]} name="Score moyen">
                    {byFiliere.map((d, i) => (
                      <Cell key={i} fill={scoreColor(d.avgScore)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════ SECTION 3 — By Region */}
      <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          Score par région
        </h3>
        {byRegion.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">Aucune donnée régionale</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Région", "Nb farmers", "Score moyen", "% Éligibles", "Revenu total estimé"].map((h) => (
                    <th
                      key={h}
                      className="pb-2.5 pr-4 text-left text-xs font-medium text-text-muted uppercase tracking-wide last:pr-0"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {byRegion.map((row) => {
                  const eligPct = Math.round((row.eligibleCount / row.count) * 100);
                  const barColor =
                    eligPct >= 60 ? "#10b981" : eligPct >= 40 ? "#f59e0b" : "#ef4444";
                  return (
                    <tr key={row.region} className="hover:bg-bg-tertiary/30 transition-colors">
                      <td className="py-3 pr-4 font-medium text-text-primary">
                        {row.region}
                      </td>
                      <td className="py-3 pr-4 font-mono text-text-secondary">
                        {row.count}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className="font-mono font-semibold"
                          style={{ color: scoreColor(row.avgScore) }}
                        >
                          {row.avgScore}
                        </span>
                        <span className="text-text-muted text-xs ml-1">
                          — {scoreLabel(row.avgScore)}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${eligPct}%`, backgroundColor: barColor }}
                            />
                          </div>
                          <span className="text-xs font-mono text-text-secondary w-8">
                            {eligPct}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 font-mono text-text-secondary text-xs">
                        {formatFCFA(row.revenuTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════ SECTION 4 — Formula Adjuster */}
      <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
        <div className="mb-5">
          <h3 className="text-sm font-bold text-text-primary">
            ⚙️ Personnaliser les critères de scoring
          </h3>
          <p className="text-xs text-text-secondary mt-1">
            Adaptez la pondération du Wakama Score à vos critères internes
          </p>
        </div>

        <div className="grid grid-cols-2 gap-8">

          {/* Left — sliders */}
          <div className="space-y-5">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Pondération des composantes
            </p>

            {(["c1", "c2", "c3", "c4"] as const).map((key) => (
              <div key={key}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-text-secondary">{C_LABELS[key]}</span>
                  <span className="text-sm font-mono font-semibold text-text-primary w-10 text-right">
                    {weights[key]}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={50}
                  value={weights[key]}
                  onChange={(e) => setWeight(key, Number(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ accentColor: "#10b981" }}
                />
              </div>
            ))}

            {/* Total indicator */}
            <div
              className={`flex items-center justify-between rounded-lg px-4 py-2.5 border ${
                weightTotal === 100
                  ? "bg-emerald-500/10 border-emerald-800"
                  : "bg-amber-500/10 border-amber-800"
              }`}
            >
              <span className={`text-sm font-medium ${weightTotal === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                {weightTotal === 100 ? "✅ Pondération valide" : "⚠️ Total doit être 100%"}
              </span>
              <span className={`font-mono font-bold text-sm ${weightTotal === 100 ? "text-emerald-400" : "text-amber-400"}`}>
                {weightTotal}%
              </span>
            </div>
          </div>

          {/* Right — thresholds + preview */}
          <div className="space-y-4">
            <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
              Seuils personnalisés
            </p>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs text-text-secondary mb-1.5 block">
                  Score minimum acceptable
                </span>
                <input
                  type="number"
                  value={thresholds.minScore}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, minScore: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="text-xs text-text-secondary mb-1.5 block">
                  Taux endettement max (%)
                </span>
                <input
                  type="number"
                  value={thresholds.maxDebt}
                  onChange={(e) =>
                    setThresholds((t) => ({ ...t, maxDebt: Number(e.target.value) }))
                  }
                  className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
                />
              </label>
            </div>

            <label className="block">
              <span className="text-xs text-text-secondary mb-1.5 block">
                Ancienneté minimum
              </span>
              <select
                value={thresholds.anciennete}
                onChange={(e) =>
                  setThresholds((t) => ({ ...t, anciennete: e.target.value }))
                }
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
              >
                <option>Aucune</option>
                <option>6 mois</option>
                <option>1 an</option>
                <option>2 ans</option>
              </select>
            </label>

            {/* Preview */}
            {customPreview ? (
              <div className="rounded-lg bg-bg-tertiary border border-gray-700 p-4">
                <p className="text-xs text-text-muted font-medium mb-3">
                  Avec vos critères :
                </p>
                <div className="space-y-2">
                  <p className="text-sm text-text-primary">
                    →{" "}
                    <span className="font-mono font-semibold">{customPreview.eligible}</span>{" "}
                    farmers éligibles{" "}
                    <span className="text-text-muted text-xs">
                      ({Math.round((customPreview.eligible / customPreview.total) * 100)}%)
                    </span>
                  </p>
                  <p className="text-sm text-text-primary">
                    → Score moyen ajusté :{" "}
                    <span
                      className="font-mono font-semibold"
                      style={{ color: scoreColor(customPreview.avgCustom) }}
                    >
                      {customPreview.avgCustom}
                    </span>
                  </p>
                  {customPreview.avgMontant > 0 && (
                    <p className="text-sm text-text-primary">
                      → Montant moyen suggéré :{" "}
                      <span className="font-mono font-semibold text-accent">
                        {formatFCFA(customPreview.avgMontant)}
                      </span>
                    </p>
                  )}
                </div>
              </div>
            ) : weightTotal !== 100 ? (
              <div className="rounded-lg bg-bg-tertiary border border-amber-800/40 p-4">
                <p className="text-xs text-amber-400">
                  Ajustez les poids pour qu'ils totalisent 100% afin de voir l'aperçu
                </p>
              </div>
            ) : null}

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleReset}
                className="flex-1 rounded-lg border border-gray-700 px-3 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Réinitialiser
              </button>
              <button
                disabled={weightTotal !== 100}
                onClick={handleApply}
                className="flex-1 rounded-lg bg-accent hover:bg-accent-hover px-3 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {weightsApplied ? "✅ Appliqué" : "Appliquer mes critères"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════ SECTION 5 — High risk farmers */}
      <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
        <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
          ⚠️ Farmers à surveiller
          <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-800 text-red-400 text-xs font-mono">
            {highRisk.length}
          </span>
        </h3>

        {highRisk.length === 0 ? (
          <p className="text-sm text-text-muted text-center py-8">
            Aucun farmer à haut risque dans le portefeuille 🎉
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {["Nom", "Score", "Région", "Culture principale", "Dernière activité", ""].map(
                    (h) => (
                      <th
                        key={h}
                        className="pb-2.5 pr-4 text-left text-xs font-medium text-text-muted uppercase tracking-wide last:pr-0 last:text-right"
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {highRisk.slice(0, 10).map(({ farmer, score }) => (
                  <tr key={farmer.id} className="hover:bg-bg-tertiary/30 transition-colors">
                    <td className="py-3 pr-4 font-medium text-text-primary">
                      {farmer.firstName ?? farmer.prenom}{" "}
                      {farmer.lastName ?? farmer.nom}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className="font-mono font-bold text-sm"
                        style={{ color: scoreColor(score.score) }}
                      >
                        {score.score}
                      </span>
                      <span
                        className="ml-1.5 px-1.5 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-800"
                      >
                        FAIBLE
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {farmer.region || "—"}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {score.details?.c1?.culturesPrincipales?.[0] ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-text-muted text-xs">
                      {score.updatedAt
                        ? new Date(score.updatedAt).toLocaleDateString("fr-FR")
                        : "—"}
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/${locale}/farmers/${farmer.id}`}
                        className="text-xs text-accent hover:text-accent-hover transition-colors"
                      >
                        Voir fiche →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
