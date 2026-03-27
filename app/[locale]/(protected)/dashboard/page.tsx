"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import AlertBadge from "@/src/components/ui/AlertBadge";
import KPICard from "@/src/components/ui/KPICard";
import {
  alerts,
  cooperatives,
  creditRequests,
  farmers as farmersApi,
  parcelles as parcellesApi,
  scores,
} from "@/src/lib/api";
import { formatFCFA, relativeTime, scoreColor } from "@/src/lib/utils";
import type {
  Alert,
  Cooperative,
  CreditRequest,
  Farmer,
  Parcelle,
  WakamaScoreResult,
} from "@/src/types";

// ─── Dynamic Leaflet map (SSR disabled) ──────────────────────────────────────

const PlatformMap = dynamic(() => import("@/src/components/ui/PlatformMap"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-bg-tertiary rounded-xl">
      <p className="text-sm text-text-muted">Chargement de la carte…</p>
    </div>
  ),
});

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function Sk({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-bg-tertiary ${className ?? ""}`} />
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar"];

const STATUS_STYLES: Record<string, string> = {
  PENDING:   "bg-amber-500/10 text-amber-400 border border-amber-800",
  REVIEWING: "bg-blue-500/10 text-blue-400 border border-blue-800",
  APPROVED:  "bg-emerald-500/10 text-emerald-400 border border-emerald-800",
  REJECTED:  "bg-red-500/10 text-red-400 border border-red-800",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "En attente",
  REVIEWING: "En révision",
  APPROVED:  "Approuvé",
  REJECTED:  "Rejeté",
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [farmersTotal, setFarmersTotal] = useState(0);
  const [farmersList, setFarmersList]   = useState<Farmer[]>([]);
  const [coopsList, setCoopsList]       = useState<Cooperative[]>([]);
  const [allParcelles, setAllParcelles] = useState<Parcelle[]>([]);
  const [unreadAlerts, setUnreadAlerts] = useState<Alert[]>([]);
  const [creditList, setCreditList]     = useState<CreditRequest[]>([]);
  const [scoreResults, setScoreResults] = useState<WakamaScoreResult[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);
  const [error, setError]               = useState<string | null>(null);

  // ── Fetch all dashboard data in parallel ───────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [farmersRes, coopsRes, alertsRes, creditsRes] =
        await Promise.allSettled([
          farmersApi.list({ limit: 20 }),
          cooperatives.list(),
          alerts.list({ unreadOnly: true }),
          creditRequests.list(),
        ]);

      const fetchedFarmers =
        farmersRes.status === "fulfilled" ? farmersRes.value.data : [];
      const total =
        farmersRes.status === "fulfilled" ? farmersRes.value.total : 0;
      const coops =
        coopsRes.status === "fulfilled" ? coopsRes.value : [];
      const alertList =
        alertsRes.status === "fulfilled" ? alertsRes.value : [];
      const credits =
        creditsRes.status === "fulfilled" ? creditsRes.value : [];

      // Fetch scores for up to 10 farmers in parallel
      const scoreSettled = await Promise.allSettled(
        fetchedFarmers.slice(0, 10).map((f) => scores.getFarmer(f.id))
      );
      const validScores = scoreSettled
        .filter(
          (r): r is PromiseFulfilledResult<WakamaScoreResult> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);

      // Fetch parcelles for first 20 farmers (lazy, best-effort)
      const parcellesResults = await Promise.allSettled(
        fetchedFarmers.slice(0, 20).map((f) => parcellesApi.listByFarmer(f.id))
      );
      const allParcellesFlat = parcellesResults
        .filter(
          (r): r is PromiseFulfilledResult<Parcelle[]> => r.status === "fulfilled"
        )
        .flatMap((r) => r.value);

      setFarmersTotal(total);
      setFarmersList(fetchedFarmers);
      setCoopsList(coops);
      setAllParcelles(allParcellesFlat);
      setUnreadAlerts(alertList);
      setCreditList(credits);
      setScoreResults(validScores);
      setLastUpdated(new Date());
    } catch {
      setError("Erreur de chargement des données");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ── Derived values ─────────────────────────────────────────────────────────

  const avgScore =
    scoreResults.length > 0
      ? Math.round(
          scoreResults.reduce((acc, s) => acc + s.score, 0) / scoreResults.length
        )
      : 0;

  const pendingCount = creditList.filter((c) => c.statut === "PENDING").length;

  // MFI eligibility estimated from sample → extrapolated to total
  const sampleSize = scoreResults.length;
  const ratio      = sampleSize > 0 ? farmersTotal / sampleSize : 0;
  const eligible   = (min: number) =>
    Math.round(scoreResults.filter((s) => s.score >= min).length * ratio);

  // Risk distribution
  const riskLow  = scoreResults.filter((s) => s.score >= 600).length;
  const riskMed  = scoreResults.filter((s) => s.score >= 400 && s.score < 600).length;
  const riskHigh = scoreResults.filter((s) => s.score < 400).length;
  const riskData = [
    { name: "Faible risque ≥600", value: Math.max(riskLow, 1),  color: "#10b981" },
    { name: "Risque moyen 400-599",  value: Math.max(riskMed, 1),  color: "#f59e0b" },
    { name: "Risque élevé <400",  value: Math.max(riskHigh, 1), color: "#ef4444" },
  ];

  // Score evolution — flat baseline (current avg repeated over 6 months)
  const evolutionData = MONTHS.map((month) => ({
    month,
    score: avgScore || 500,
  }));

  // Score lookup map for credit requests table
  const scoreMap = new Map(scoreResults.map((s) => [s.farmerId, s.score]));

  // Recent items
  const recentCredits = [...creditList]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const recentAlerts = [...unreadAlerts].slice(0, 5);

  // ── Credit actions ─────────────────────────────────────────────────────────

  async function handleCredit(id: string, action: "APPROVED" | "REJECTED") {
    setProcessingId(id);
    try {
      await creditRequests.updateStatus(id, action);
      setCreditList((prev) =>
        prev.map((c) => (c.id === id ? { ...c, statut: action } : c))
      );
    } finally {
      setProcessingId(null);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Tableau de bord</h2>
          <p className="text-sm text-text-secondary mt-0.5">
            {lastUpdated
              ? `Mis à jour ${relativeTime(lastUpdated)}`
              : "Chargement des données…"}
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-gray-700 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary disabled:opacity-50 transition-colors"
        >
          <span
            className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}
            style={{ fontSize: 16 }}
          >
            refresh
          </span>
          Actualiser
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-800 text-sm text-red-400">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>error</span>
          {error}
        </div>
      )}

      {/* ── Section 1 — Main KPIs ── */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-36" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            label="Farmers actifs"
            value={farmersTotal.toLocaleString("fr-FR")}
            sub="enregistrés sur la plateforme"
            icon="person"
            color="#10b981"
          />
          <KPICard
            label="Score moyen"
            value={avgScore > 0 ? avgScore : "—"}
            sub={avgScore > 0 ? `sur ${scoreResults.length} scorés` : "en attente de données"}
            icon="grade"
            color={scoreColor(avgScore)}
          />
          <KPICard
            label="Alertes actives"
            value={unreadAlerts.length}
            sub="non lues"
            icon="notifications"
            color={unreadAlerts.length > 0 ? "#ef4444" : "#10b981"}
          />
          <KPICard
            label="Demandes en attente"
            value={pendingCount}
            sub="crédit à traiter"
            icon="request_quote"
            color="#f59e0b"
          />
        </div>
      )}

      {/* ── Section 2 — MFI Eligibility ── */}
      <div>
        <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider mb-3">
          Éligibilité produits MFI — estimation
        </h3>
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: "REMUCI",       min: 300, color: "#f97316", icon: "savings" },
              { label: "Baobab Prod",  min: 400, color: "#f59e0b", icon: "eco" },
              { label: "Baobab Camp",  min: 600, color: "#10b981", icon: "agriculture" },
              { label: "NSIA",         min: 700, color: "#3b82f6", icon: "verified" },
            ].map(({ label, min, color, icon }) => (
              <div
                key={label}
                className="rounded-xl bg-bg-secondary border border-gray-800 p-4 flex items-center gap-3"
              >
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
                  style={{ backgroundColor: `${color}1a` }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>
                    {icon}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xl font-bold font-mono text-text-primary leading-none">
                    {sampleSize > 0 ? eligible(min).toLocaleString("fr-FR") : "—"}
                  </p>
                  <p className="text-xs text-text-muted mt-0.5 truncate">
                    {label} <span className="text-text-muted">≥{min}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Section 3 — Charts + Sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Left 60% — Charts */}
        <div className="lg:col-span-3 space-y-4">

          {/* Score Evolution */}
          <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Évolution du score moyen
            </h3>
            {loading ? (
              <Sk className="h-48" />
            ) : (
              <div style={{ width: "100%", height: 300, minHeight: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={evolutionData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      stroke="#374151"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <YAxis
                      domain={[0, 1000]}
                      stroke="#374151"
                      tick={{ fill: "#6b7280", fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#111827",
                        border: "1px solid #374151",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "#9ca3af" }}
                      itemStyle={{ color: "#f9fafb" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={scoreColor(avgScore)}
                      strokeWidth={2.5}
                      dot={{ fill: scoreColor(avgScore), strokeWidth: 0, r: 4 }}
                      activeDot={{ r: 5 }}
                      name="Score moyen"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Risk Distribution */}
          <div className="rounded-xl bg-bg-secondary border border-gray-800 p-5">
            <h3 className="text-sm font-semibold text-text-primary mb-4">
              Distribution du risque
            </h3>
            {loading ? (
              <Sk className="h-48" />
            ) : (
              <div className="flex items-center gap-6">
                {/* Donut */}
                <div className="relative shrink-0" style={{ width: 200, height: 200 }}>
                  <div style={{ width: "100%", height: 200, minHeight: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskData}
                        cx="50%"
                        cy="50%"
                        innerRadius={52}
                        outerRadius={78}
                        dataKey="value"
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {riskData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#111827",
                          border: "1px solid #374151",
                          borderRadius: 8,
                          fontSize: 12,
                        }}
                        itemStyle={{ color: "#f9fafb" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  </div>
                  {/* Center text */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-2xl font-bold font-mono text-text-primary leading-none">
                      {sampleSize}
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">scorés</p>
                  </div>
                </div>

                {/* Legend */}
                <div className="space-y-3 flex-1">
                  {riskData.map((seg) => {
                    const pct = sampleSize > 0
                      ? Math.round((seg.value / sampleSize) * 100)
                      : 0;
                    return (
                      <div key={seg.name} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-text-secondary">{seg.name}</span>
                          <span className="font-mono font-semibold" style={{ color: seg.color }}>
                            {seg.value} ({pct}%)
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: seg.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right 40% — Credit requests + Alerts */}
        <div className="lg:col-span-2 space-y-4">

          {/* Recent Credit Requests */}
          <div className="rounded-xl bg-bg-secondary border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-text-primary">Demandes récentes</h3>
              <span className="text-xs text-text-muted">{recentCredits.length} / {creditList.length}</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-14" />)}
              </div>
            ) : recentCredits.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Aucune demande de crédit
              </p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {recentCredits.map((cr) => {
                  const farmerScore = scoreMap.get(cr.farmerId);
                  const isPending   = cr.statut === "PENDING";
                  const isBusy      = processingId === cr.id;
                  return (
                    <li key={cr.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="min-w-0">
                          <p className="text-xs font-mono text-text-muted truncate">
                            #{cr.farmerId.slice(0, 8)}…
                          </p>
                          <p className="text-sm font-semibold text-text-primary">
                            {formatFCFA(cr.montant)}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[cr.statut] ?? ""}`}>
                            {STATUS_LABELS[cr.statut] ?? cr.statut}
                          </span>
                          {farmerScore != null && (
                            <span
                              className="text-xs font-mono font-bold"
                              style={{ color: scoreColor(farmerScore) }}
                            >
                              {farmerScore}
                            </span>
                          )}
                        </div>
                      </div>

                      {isPending && (
                        <div className="flex gap-2 mt-2">
                          <button
                            onClick={() => void handleCredit(cr.id, "APPROVED")}
                            disabled={isBusy}
                            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-800 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                            Approuver
                          </button>
                          <button
                            onClick={() => void handleCredit(cr.id, "REJECTED")}
                            disabled={isBusy}
                            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-800 hover:bg-red-500/20 disabled:opacity-50 transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 12 }}>cancel</span>
                            Rejeter
                          </button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Recent Alerts */}
          <div className="rounded-xl bg-bg-secondary border border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-text-primary">Alertes récentes</h3>
              <span className="text-xs text-text-muted">{unreadAlerts.length} non lues</span>
            </div>

            {loading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 4 }).map((_, i) => <Sk key={i} className="h-10" />)}
              </div>
            ) : recentAlerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-text-muted">
                Aucune alerte non lue
              </p>
            ) : (
              <ul className="divide-y divide-gray-800">
                {recentAlerts.map((alert) => (
                  <li key={alert.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="mt-0.5 shrink-0">
                      <AlertBadge severity={alert.severity} text="" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary leading-snug line-clamp-2">
                        {alert.message}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {relativeTime(alert.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* ── Section 4 — Platform Map ── */}
      <div className="rounded-xl bg-bg-secondary border border-gray-800 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-text-primary">
            Carte de la plateforme
          </h3>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span>{farmersList.length} agriculteurs</span>
            <span>·</span>
            <span>{coopsList.length} coopératives</span>
            <span>·</span>
            <span>{allParcelles.length} parcelles</span>
          </div>
        </div>
        <div style={{ height: 400 }}>
          {loading ? (
            <Sk className="h-full rounded-none" />
          ) : (
            <PlatformMap
              farmers={farmersList}
              coops={coopsList}
              parcelles={allParcelles}
            />
          )}
        </div>
      </div>
    </div>
  );
}
