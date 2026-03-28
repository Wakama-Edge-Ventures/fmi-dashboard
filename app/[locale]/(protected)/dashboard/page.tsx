"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import ChartTooltip from "@/src/components/ui/ChartTooltip";

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
import { getInstitutionName } from "@/src/lib/auth";
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
    <div
      style={{
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#111a2e",
        borderRadius: 8,
      }}
    >
      <p style={{ fontSize: 12, color: "#3a4a60" }}>Chargement de la carte…</p>
    </div>
  ),
});

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Sk({ h = 80 }: { h?: number }) {
  return (
    <div
      className="animate-pulse"
      style={{ height: h, borderRadius: 8, background: "#111a2e" }}
    />
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MONTHS = ["Oct", "Nov", "Déc", "Jan", "Fév", "Mar"];

const STATUS_STYLES: Record<string, React.CSSProperties> = {
  PENDING:   { background: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  REVIEWING: { background: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  APPROVED:  { background: "rgba(16,185,129,0.12)",  color: "#10b981" },
  REJECTED:  { background: "rgba(239,68,68,0.12)",   color: "#ef4444" },
};

const STATUS_LABELS: Record<string, string> = {
  PENDING:   "En attente",
  REVIEWING: "En révision",
  APPROVED:  "Approuvé",
  REJECTED:  "Rejeté",
};

// ─── Recharts theme ──────────────────────────────────────────────────────────

// Chart tooltip now uses ChartTooltip component

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [institutionName, setInstitutionName] = useState("");

  useEffect(() => {
    setInstitutionName(getInstitutionName());
  }, []);

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

      const scoreSettled = await Promise.allSettled(
        fetchedFarmers.slice(0, 10).map((f) => scores.getFarmer(f.id))
      );
      const validScores = scoreSettled
        .filter(
          (r): r is PromiseFulfilledResult<WakamaScoreResult> =>
            r.status === "fulfilled"
        )
        .map((r) => r.value);

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

  // ── Derived ──────────────────────────────────────────────────────────────

  const avgScore =
    scoreResults.length > 0
      ? Math.round(
          scoreResults.reduce((acc, s) => acc + s.score, 0) / scoreResults.length
        )
      : 0;

  const pendingCount = creditList.filter((c) => c.statut === "PENDING").length;

  const sampleSize = scoreResults.length;
  const ratio      = sampleSize > 0 ? farmersTotal / sampleSize : 0;
  const eligible   = (min: number) =>
    Math.round(scoreResults.filter((s) => s.score >= min).length * ratio);

  const riskLow  = scoreResults.filter((s) => s.score >= 600).length;
  const riskMed  = scoreResults.filter((s) => s.score >= 400 && s.score < 600).length;
  const riskHigh = scoreResults.filter((s) => s.score < 400).length;
  const riskData = [
    { name: "Faible risque ≥600",  value: Math.max(riskLow, 1),  color: "#10b981" },
    { name: "Risque moyen 400–599", value: Math.max(riskMed, 1),  color: "#f59e0b" },
    { name: "Risque élevé <400",   value: Math.max(riskHigh, 1), color: "#ef4444" },
  ];

  const evolutionData = MONTHS.map((month) => ({ month, score: avgScore || 500 }));

  const scoreMap = new Map(scoreResults.map((s) => [s.farmerId, s.score]));

  const recentCredits = [...creditList]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);
  const recentAlerts = [...unreadAlerts].slice(0, 5);

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

  // ─── Card shell ──────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "#0d1423",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Tableau de bord</p>
          <p style={{ fontSize: 11, color: "#5a6a85", marginTop: 2 }}>
            {institutionName ? `${institutionName} · ` : ""}
            {lastUpdated
              ? `Mis à jour ${relativeTime(lastUpdated)}`
              : "Chargement des données…"}
          </p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            height: 30,
            padding: "0 12px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 500,
            color: "#5a6a85",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.5 : 1,
          }}
        >
          <span
            className={`material-symbols-outlined ${loading ? "animate-spin" : ""}`}
            style={{ fontSize: 14, fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}
          >
            refresh
          </span>
          Actualiser
        </button>
      </div>

      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 6,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.2)",
            fontSize: 12,
            color: "#ef4444",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
          {error}
        </div>
      )}

      {/* ── KPIs ── */}
      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => <Sk key={i} h={88} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}
          className="lg:grid-cols-4"
        >
          <KPICard label="Farmers actifs"      value={farmersTotal.toLocaleString("fr-FR")} sub="enregistrés"         icon="person"         color="#10b981" />
          <KPICard label="Score moyen"          value={avgScore > 0 ? avgScore : "—"}        sub={avgScore > 0 ? `sur ${sampleSize} scorés` : "en attente"} icon="grade" color={scoreColor(avgScore)} />
          <KPICard label="Alertes actives"      value={unreadAlerts.length}                  sub="non lues"            icon="notifications"  color={unreadAlerts.length > 0 ? "#ef4444" : "#10b981"} />
          <KPICard label="Demandes en attente"  value={pendingCount}                         sub="crédit à traiter"    icon="request_quote"  color="#f59e0b" />
        </div>
      )}

      {/* ── Éligibilité MFI ── */}
      <div>
        <p className="label-xs" style={{ marginBottom: 10 }}>Éligibilité produits MFI — estimation</p>
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {Array.from({ length: 4 }).map((_, i) => <Sk key={i} h={64} />)}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}
            className="lg:grid-cols-4"
          >
            {[
              { label: "REMUCI",      min: 300, color: "#f97316" },
              { label: "Baobab Prod", min: 400, color: "#f59e0b" },
              { label: "Baobab Camp", min: 600, color: "#10b981" },
              { label: "NSIA",        min: 700, color: "#06b6d4" },
            ].map(({ label, min, color }) => (
              <div key={label} style={{ ...cardStyle, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <div
                  style={{
                    width: 6,
                    height: 32,
                    borderRadius: 3,
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <div style={{ minWidth: 0 }}>
                  <p className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#e8edf5", lineHeight: 1 }}>
                    {sampleSize > 0 ? eligible(min).toLocaleString("fr-FR") : "—"}
                  </p>
                  <p style={{ fontSize: 10, color: "#5a6a85", marginTop: 3 }}>
                    {label} <span style={{ color: "#3a4a60" }}>≥{min}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Charts + Panel ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }} className="lg:grid-cols-5">

        {/* Charts — 3 cols */}
        <div className="lg:col-span-3" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Score Evolution */}
          <div style={cardStyle}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="label-xs">Évolution du score moyen</p>
            </div>
            <div style={{ padding: 16 }}>
              {loading ? (
                <Sk h={180} />
              ) : (
                <div style={{ width: "100%", height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={evolutionData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="areaGrad-score" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={scoreColor(avgScore)} stopOpacity={0.15} />
                          <stop offset="100%" stopColor={scoreColor(avgScore)} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="rgba(255,255,255,0.04)" strokeDasharray="0" vertical={false} />
                      <XAxis dataKey="month" stroke="transparent" tick={{ fill: "#5a6a85", fontSize: 10 }} />
                      <YAxis domain={[0, 1000]} stroke="transparent" tick={{ fill: "#5a6a85", fontSize: 10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke={scoreColor(avgScore)}
                        strokeWidth={1.5}
                        fill="url(#areaGrad-score)"
                        dot={false}
                        activeDot={{ r: 3, fill: scoreColor(avgScore), strokeWidth: 0 }}
                        name="Score moyen"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>

          {/* Risk Distribution */}
          <div style={cardStyle}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="label-xs">Distribution du risque</p>
            </div>
            <div style={{ padding: 16 }}>
              {loading ? (
                <Sk h={180} />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                  <div style={{ position: "relative", width: 160, height: 160, flexShrink: 0 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={riskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={44}
                          outerRadius={64}
                          dataKey="value"
                          paddingAngle={2}
                          strokeWidth={0}
                        >
                          {riskData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        pointerEvents: "none",
                      }}
                    >
                      <p className="mono" style={{ fontSize: 18, fontWeight: 600, color: "#e8edf5" }}>
                        {sampleSize}
                      </p>
                      <p style={{ fontSize: 10, color: "#5a6a85" }}>scorés</p>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                    {riskData.map((seg) => {
                      const pct = sampleSize > 0
                        ? Math.round((seg.value / sampleSize) * 100)
                        : 0;
                      return (
                        <div key={seg.name} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 11, color: "#5a6a85" }}>{seg.name}</span>
                            <span className="mono" style={{ fontSize: 11, fontWeight: 600, color: seg.color }}>
                              {seg.value} ({pct}%)
                            </span>
                          </div>
                          <div style={{ height: 3, borderRadius: 9999, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
                            <div style={{ height: "100%", borderRadius: 9999, width: `${pct}%`, background: seg.color, transition: "width 0.5s ease" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right panel — 2 cols */}
        <div className="lg:col-span-2" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Demandes récentes */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="label-xs">Demandes récentes</p>
              <span style={{ fontSize: 10, color: "#3a4a60" }}>{recentCredits.length} / {creditList.length}</span>
            </div>

            {loading ? (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => <Sk key={i} h={52} />)}
              </div>
            ) : recentCredits.length === 0 ? (
              <p style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "#3a4a60" }}>
                Aucune demande de crédit
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentCredits.map((cr) => {
                  const farmerScore = scoreMap.get(cr.farmerId);
                  const isPending   = cr.statut === "PENDING";
                  const isBusy      = processingId === cr.id;
                  const statusStyle = STATUS_STYLES[cr.statut] ?? {};
                  return (
                    <li
                      key={cr.id}
                      style={{ padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                    >
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <p className="mono" style={{ fontSize: 10, color: "#3a4a60", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            #{cr.farmerId.slice(0, 8)}…
                          </p>
                          <p style={{ fontSize: 13, fontWeight: 600, color: "#e8edf5", marginTop: 2 }}>
                            {formatFCFA(cr.montant)}
                          </p>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                          <span style={{ ...statusStyle, fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 9999 }}>
                            {STATUS_LABELS[cr.statut] ?? cr.statut}
                          </span>
                          {farmerScore != null && (
                            <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: scoreColor(farmerScore) }}>
                              {farmerScore}
                            </span>
                          )}
                        </div>
                      </div>

                      {isPending && (
                        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                          <button
                            onClick={() => void handleCredit(cr.id, "APPROVED")}
                            disabled={isBusy}
                            style={{
                              flex: 1,
                              height: 26,
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: 500,
                              background: "rgba(16,185,129,0.08)",
                              color: "#10b981",
                              border: "1px solid rgba(16,185,129,0.2)",
                              cursor: isBusy ? "not-allowed" : "pointer",
                              opacity: isBusy ? 0.5 : 1,
                            }}
                          >
                            Approuver
                          </button>
                          <button
                            onClick={() => void handleCredit(cr.id, "REJECTED")}
                            disabled={isBusy}
                            style={{
                              flex: 1,
                              height: 26,
                              borderRadius: 5,
                              fontSize: 11,
                              fontWeight: 500,
                              background: "rgba(239,68,68,0.08)",
                              color: "#ef4444",
                              border: "1px solid rgba(239,68,68,0.2)",
                              cursor: isBusy ? "not-allowed" : "pointer",
                              opacity: isBusy ? 0.5 : 1,
                            }}
                          >
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

          {/* Alertes récentes */}
          <div style={{ ...cardStyle, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <p className="label-xs">Alertes récentes</p>
              <span style={{ fontSize: 10, color: "#3a4a60" }}>{unreadAlerts.length} non lues</span>
            </div>

            {loading ? (
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                {Array.from({ length: 3 }).map((_, i) => <Sk key={i} h={40} />)}
              </div>
            ) : recentAlerts.length === 0 ? (
              <p style={{ padding: "24px 14px", textAlign: "center", fontSize: 12, color: "#3a4a60" }}>
                Aucune alerte non lue
              </p>
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {recentAlerts.map((alert) => (
                  <li key={alert.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                    <div style={{ marginTop: 1, flexShrink: 0 }}>
                      <AlertBadge severity={alert.severity} text="" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, color: "#e8edf5", lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {alert.message}
                      </p>
                      <p style={{ fontSize: 10, color: "#3a4a60", marginTop: 3 }}>
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

      {/* ── Platform Map ── */}
      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="label-xs">Carte de la plateforme</p>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#3a4a60" }}>
            <span>{farmersList.length} agriculteurs</span>
            <span>·</span>
            <span>{coopsList.length} coopératives</span>
            <span>·</span>
            <span>{allParcelles.length} parcelles</span>
          </div>
        </div>
        <div style={{ height: 380 }}>
          {loading ? (
            <div className="animate-pulse" style={{ height: "100%", background: "#111a2e" }} />
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
