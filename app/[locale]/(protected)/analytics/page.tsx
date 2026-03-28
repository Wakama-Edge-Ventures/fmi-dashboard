"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartTooltip from "@/src/components/ui/ChartTooltip";

import KPICard from "@/src/components/ui/KPICard";
import PageLoader from "@/src/components/ui/PageLoader";
import {
  creditRequests as creditRequestsApi,
  farmers as farmersApi,
  scores as scoresApi,
} from "@/src/lib/api";
import { formatFCFA } from "@/src/lib/utils";
import type { CreditRequest, Farmer, WakamaScoreResult } from "@/src/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const AXIS_TICK = { fill: "var(--text-secondary)", fontSize: 11 };

const MONTH_FR = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

const FILIERES_ORDER = ["Cacao", "Hévéa", "Anacarde", "Maïs", "Riz", "Autre"];
const FILIERE_COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#f97316", "#8b5cf6", "#6b7280"];

const DIST_BUCKETS = [
  { name: "0–299",   min: 0,   max: 299,  color: "#ef4444" },
  { name: "300–499", min: 300, max: 499,  color: "#f97316" },
  { name: "500–699", min: 500, max: 699,  color: "#f59e0b" },
  { name: "700+",    min: 700, max: 1000, color: "#10b981" },
];

const PRODUCTS = [
  { name: "REMUCI",          label: "REMUCI\n≥300",       threshold: 300, color: "#f59e0b" },
  { name: "Baobab Agri Prod",label: "Baobab Prod\n≥400",  threshold: 400, color: "#84cc16" },
  { name: "Baobab Agri Camp",label: "Baobab Camp\n≥600",  threshold: 600, color: "#10b981" },
  { name: "NSIA Pack Paysan",label: "NSIA\n≥700",         threshold: 700, color: "#059669" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compactFCFA(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)} Mrd FCFA`;
  if (n >= 1_000_000)     return `${(n / 1_000_000).toFixed(1)} M FCFA`;
  if (n >= 1_000)         return `${Math.round(n / 1_000)} K FCFA`;
  return formatFCFA(n);
}

function normalizeCulture(c: string): string {
  const l = c.toLowerCase().trim();
  if (l.includes("cacao"))    return "Cacao";
  if (l.includes("hév") || l.includes("hev") || l.includes("caout")) return "Hévéa";
  if (l.includes("anacarde") || l.includes("noix de cajou")) return "Anacarde";
  if (l.includes("maïs") || l.includes("mais"))  return "Maïs";
  if (l.includes("riz"))      return "Riz";
  return "Autre";
}

// ─── Chart card wrapper ───────────────────────────────────────────────────────

function ChartCard({
  title,
  sub,
  height = 300,
  children,
}: {
  title: string;
  sub?: string;
  height?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-bg-secondary p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {sub && <p className="text-xs text-text-muted mt-0.5">{sub}</p>}
      </div>
      <div style={{ width: "100%", height, minHeight: height }}>
        {children}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  // ── Data state ──
  const [farmers,   setFarmers]   = useState<Farmer[]>([]);
  const [scoreMap,  setScoreMap]  = useState<Record<string, WakamaScoreResult>>({});
  const [credits,   setCredits]   = useState<CreditRequest[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [scoresLoading, setScoresLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        // Phase 1: farmers + credits in parallel
        const [farmersData, creditsData] = await Promise.all([
          farmersApi.list({ limit: 200 }),
          creditRequestsApi.list().catch(() => [] as CreditRequest[]),
        ]);

        const farmerList: Farmer[] = farmersData.data ?? [];
        setFarmers(farmerList);

        const creditList: CreditRequest[] = Array.isArray(creditsData)
          ? creditsData
          : (creditsData as { data?: CreditRequest[] })?.data ?? [];
        setCredits(creditList);

        setLoading(false);

        // Phase 2: scores (can take longer, don't block page)
        setScoresLoading(true);
        const scoreResults = await Promise.allSettled(
          farmerList.map((f) => scoresApi.getFarmer(f.id))
        );
        const map: Record<string, WakamaScoreResult> = {};
        farmerList.forEach((f, i) => {
          const r = scoreResults[i];
          if (r.status === "fulfilled") map[f.id] = r.value;
        });
        setScoreMap(map);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
        setLoading(false);
      } finally {
        setScoresLoading(false);
      }
    }
    load();
  }, []);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const scoreValues = Object.values(scoreMap).map((s) => s.score);
    const avgScore = scoreValues.length > 0
      ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
      : 0;
    const eligible = scoreValues.filter((s) => s >= 300).length;
    const eligRate = scoreValues.length > 0
      ? Math.round((eligible / scoreValues.length) * 100)
      : 0;
    const volumeCredit = credits.reduce((sum, c) => sum + (c.montant ?? 0), 0);
    return { totalFarmers: farmers.length, avgScore, eligRate, volumeCredit };
  }, [farmers, scoreMap, credits]);

  // ── Distribution des scores ──
  const distributionData = useMemo(() => {
    const counts = DIST_BUCKETS.map((b) => ({ ...b, count: 0 }));
    Object.values(scoreMap).forEach((s) => {
      const bucket = counts.find((b) => s.score >= b.min && s.score <= b.max);
      if (bucket) bucket.count++;
    });
    return counts;
  }, [scoreMap]);

  // ── Répartition par filière ──
  const filiereData = useMemo(() => {
    const counts: Record<string, number> = Object.fromEntries(
      FILIERES_ORDER.map((f) => [f, 0])
    );
    Object.values(scoreMap).forEach((s) => {
      const cultures = s.details?.c1?.culturesPrincipales ?? [];
      if (cultures.length === 0) {
        counts["Autre"]++;
      } else {
        const normalized = normalizeCulture(cultures[0]);
        counts[normalized] = (counts[normalized] ?? 0) + 1;
      }
    });
    // If no score detail data, fall back to farmers count spread
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total === 0) {
      farmers.forEach((_, i) => {
        counts[FILIERES_ORDER[i % (FILIERES_ORDER.length - 1)]]++;
      });
    }
    return FILIERES_ORDER
      .map((name) => ({ name, value: counts[name] ?? 0 }))
      .filter((d) => d.value > 0);
  }, [scoreMap, farmers]);

  // ── Score moyen par région ──
  const regionData = useMemo(() => {
    const regionScores: Record<string, number[]> = {};
    farmers.forEach((f) => {
      const region = f.region;
      if (!region) return;
      const s = scoreMap[f.id];
      if (!s) return;
      if (!regionScores[region]) regionScores[region] = [];
      regionScores[region].push(s.score);
    });
    return Object.entries(regionScores)
      .map(([region, scores]) => ({
        region: region.length > 14 ? region.slice(0, 13) + "…" : region,
        avgScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      }))
      .sort((a, b) => b.avgScore - a.avgScore)
      .slice(0, 8);
  }, [farmers, scoreMap]);

  // ── Nouveaux farmers par mois (6 derniers mois) ──
  const monthlyData = useMemo(() => {
    const now = new Date();
    const months: { key: string; month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key:   `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
        month: `${MONTH_FR[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        count: 0,
      });
    }
    farmers.forEach((f) => {
      if (!f.createdAt) return;
      const d = new Date(f.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = months.find((m) => m.key === key);
      if (entry) entry.count++;
    });
    return months.map(({ month, count }) => ({ month, count }));
  }, [farmers]);

  // ── Éligibilité par produit MFI ──
  const eligibilityData = useMemo(() => {
    const scores = Object.values(scoreMap).map((s) => s.score);
    return PRODUCTS.map((p) => ({
      name:  p.name,
      label: p.label,
      color: p.color,
      count: scores.filter((s) => s >= p.threshold).length,
    }));
  }, [scoreMap]);

  // ── Loading ──
  if (loading) return <PageLoader message="Chargement des données analytiques…" />;

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-medium">{error}</p>
          <button onClick={() => window.location.reload()} className="text-sm text-accent hover:underline">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  // ── Shared score-loading overlay ──
  const ScoresLoadingBadge = scoresLoading ? (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs">
      <span className="w-2.5 h-2.5 rounded-full border border-accent border-t-transparent animate-spin" />
      Calcul des scores…
    </span>
  ) : null;

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Analytiques</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Tableau de bord analytique — {farmers.length} agriculteurs
          </p>
        </div>
        {ScoresLoadingBadge}
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total farmers"
          value={kpis.totalFarmers.toLocaleString("fr-FR")}
          icon="person"
          color="#3b82f6"
        />
        <KPICard
          label="Score Wakama moyen"
          value={kpis.avgScore > 0 ? kpis.avgScore : "—"}
          icon="grade"
          color="#10b981"
        />
        <KPICard
          label="Taux d'éligibilité MFI"
          value={kpis.eligRate > 0 ? `${kpis.eligRate}%` : "—"}
          icon="verified"
          color="#8b5cf6"
        />
        <KPICard
          label="Volume crédit demandé"
          value={kpis.volumeCredit > 0 ? compactFCFA(kpis.volumeCredit) : "—"}
          icon="payments"
          color="#f59e0b"
        />
      </div>

      {/* ── Row 1: Distribution + Filière ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Distribution des scores */}
        <ChartCard
          title="Distribution des scores Wakama"
          sub="Nombre de farmers par tranche de score"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={distributionData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                {distributionData.map((entry, i) => (
                  <linearGradient key={i} id={`barGrad-dist-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.5} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="name" stroke="transparent" tick={AXIS_TICK} />
              <YAxis stroke="transparent" tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => [`${v}`, "Farmers"]} />}
              />
              <Bar dataKey="count" name="Farmers" radius={[4, 4, 0, 0]} maxBarSize={72}>
                {distributionData.map((entry, i) => (
                  <Cell key={i} fill={`url(#barGrad-dist-${i})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Répartition par filière */}
        <ChartCard
          title="Répartition par filière"
          sub="Cultures principales des farmers scorés"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filiereData}
                cx="42%"
                cy="50%"
                outerRadius={95}
                innerRadius={55}
                dataKey="value"
                paddingAngle={3}
                strokeWidth={0}
                label={false}
              >
                {filiereData.map((entry, i) => (
                  <Cell
                    key={i}
                    fill={FILIERE_COLORS[FILIERES_ORDER.indexOf(entry.name)] ?? "#6b7280"}
                  />
                ))}
              </Pie>
              <Tooltip
                content={<ChartTooltip formatter={(v) => [`${v}`, "Farmers"]} />}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconType="circle"
                iconSize={8}
                formatter={(value) => (
                  <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Row 2: Région + Mensuel ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Score moyen par région */}
        <ChartCard
          title="Score moyen par région"
          sub="Top 8 régions — score Wakama moyen"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={regionData}
              layout="vertical"
              margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="barGrad-region" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" horizontal={false} />
              <XAxis type="number" domain={[0, 1000]} stroke="transparent" tick={AXIS_TICK} />
              <YAxis
                type="category"
                dataKey="region"
                width={110}
                stroke="transparent"
                tick={AXIS_TICK}
              />
              <Tooltip
                content={<ChartTooltip formatter={(v) => [`${v}`, "Score moyen"]} />}
              />
              <Bar
                dataKey="avgScore"
                name="Score moyen"
                fill="url(#barGrad-region)"
                radius={[0, 4, 4, 0]}
                maxBarSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Nouveaux farmers par mois */}
        <ChartCard
          title="Nouveaux farmers enregistrés"
          sub="6 derniers mois"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={monthlyData}
              margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
            >
              <defs>
                <linearGradient id="areaGrad-monthly" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" vertical={false} />
              <XAxis dataKey="month" stroke="transparent" tick={AXIS_TICK} />
              <YAxis stroke="transparent" tick={AXIS_TICK} allowDecimals={false} />
              <Tooltip
                content={<ChartTooltip formatter={(v) => [`${v}`, "Nouveaux farmers"]} />}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#areaGrad-monthly)"
                dot={false}
                activeDot={{ r: 3, fill: "#10b981", strokeWidth: 0 }}
                name="Nouveaux farmers"
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      {/* ── Row 3: Éligibilité par produit (full width) ── */}
      <ChartCard
        title="Éligibilité par produit MFI"
        sub="Nombre de farmers atteignant le seuil de score pour chaque produit de crédit"
        height={280}
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={eligibilityData}
            margin={{ top: 4, right: 16, left: -8, bottom: 24 }}
          >
            <defs>
              {eligibilityData.map((entry, i) => (
                <linearGradient key={i} id={`barGrad-elig-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={entry.color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={entry.color} stopOpacity={0.5} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" vertical={false} />
            <XAxis dataKey="name" stroke="transparent" tick={AXIS_TICK} interval={0} />
            <YAxis stroke="transparent" tick={AXIS_TICK} allowDecimals={false} />
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(v) => [`${v}`, "Farmers éligibles"]}
                  labelFormatter={(label) => {
                    const p = PRODUCTS.find((x) => x.name === label);
                    return p ? `${label} (≥ ${p.threshold})` : label;
                  }}
                />
              }
            />
            <Bar dataKey="count" name="Farmers éligibles" radius={[6, 6, 0, 0]} maxBarSize={100}>
              {eligibilityData.map((entry, i) => (
                <Cell key={i} fill={`url(#barGrad-elig-${i})`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ── Footer note ── */}
      <p className="text-xs text-text-muted text-center pb-2">
        Données calculées sur {farmers.length} farmers · {Object.keys(scoreMap).length} scores disponibles
        {credits.length > 0 && ` · ${credits.length} demandes de crédit`}
      </p>

    </div>
  );
}
