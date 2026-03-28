"use client";

import dynamic from "next/dynamic";
import PageLoader from "@/src/components/ui/PageLoader";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  cooperatives as cooperativesApi,
  farmers as farmersApi,
  iot as iotApi,
  parcelles as parcellesApi,
  scores as scoresApi,
} from "@/src/lib/api";
import {
  formatFCFA,
  formatScore,
  initials,
  relativeTime,
  scoreColor,
  scoreLabel,
} from "@/src/lib/utils";
import type {
  Cooperative,
  CoopScoreResult,
  Farmer,
  IotNode,
  Parcelle,
  WakamaScoreResult,
} from "@/src/types";

const ParcellesNdviMap = dynamic(
  () => import("@/src/components/ui/ParcellesNdviMap"),
  { ssr: false }
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function farmerName(f: Farmer): string {
  const first = f.firstName ?? f.prenom ?? "";
  const last  = f.lastName  ?? f.nom   ?? "";
  return `${first} ${last}`.trim() || "—";
}

function eligibilityProducts(score: number): string[] {
  const products: string[] = [];
  if (score >= 300) products.push("REMUCI");
  if (score >= 400) products.push("Baobab Prod");
  if (score >= 600) products.push("Baobab Camp");
  if (score >= 700) products.push("NSIA");
  return products;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CooperativeDetailPage() {
  const params = useParams();
  const id     = params.id     as string;
  const locale = (params.locale as string) ?? "fr";

  // ── Data state ──
  const [coop,       setCoop]       = useState<Cooperative | null>(null);
  const [coopScore,  setCoopScore]  = useState<CoopScoreResult | null>(null);
  const [farmers,    setFarmers]    = useState<Farmer[]>([]);
  const [scoreMap,   setScoreMap]   = useState<Record<string, WakamaScoreResult>>({});
  const [iotNodes,     setIotNodes]     = useState<IotNode[]>([]);
  const [allParcelles, setAllParcelles] = useState<Parcelle[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [coopData, coopScoreData, farmersData] = await Promise.all([
          cooperativesApi.get(id),
          scoresApi.getCoop(id).catch(() => null),
          farmersApi.list({ cooperativeId: id, limit: 100 }),
        ]);

        setCoop(coopData);
        setCoopScore(coopScoreData);

        const farmerList: Farmer[] = farmersData.data ?? [];
        setFarmers(farmerList);

        // Fetch individual farmer scores + IoT nodes in parallel
        const [farmerScoreResults, nodesData] = await Promise.all([
          Promise.allSettled(farmerList.map((f) => scoresApi.getFarmer(f.id))),
          iotApi.nodes(id).catch(() => null),
        ]);

        const map: Record<string, WakamaScoreResult> = {};
        farmerList.forEach((f, i) => {
          const r = farmerScoreResults[i];
          if (r.status === "fulfilled") map[f.id] = r.value;
        });
        setScoreMap(map);

        // Fetch parcelles for first 20 farmers
        const parcellesResults = await Promise.allSettled(
          farmerList.slice(0, 20).map((f) => parcellesApi.listByFarmer(f.id))
        );
        const allParcelles: Parcelle[] = parcellesResults
          .filter((r): r is PromiseFulfilledResult<Parcelle[]> => r.status === "fulfilled")
          .flatMap((r) => r.value ?? []);
        setAllParcelles(allParcelles);

        // API may return array, single node object, or wrapped response
        const normalized: IotNode[] = Array.isArray(nodesData)
          ? nodesData
          : nodesData && (nodesData as IotNode).id
            ? [nodesData as IotNode]
            : (nodesData as { data?: IotNode[] } | null)?.data ?? [];
        setIotNodes(normalized);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  // ── Derived ──
  const coopName = useMemo(
    () => (coop ? (coop.name ?? coop.nom ?? "Inconnu") : ""),
    [coop]
  );

  const sortedFarmers = useMemo(
    () =>
      [...farmers].sort(
        (a, b) => (scoreMap[b.id]?.score ?? 0) - (scoreMap[a.id]?.score ?? 0)
      ),
    [farmers, scoreMap]
  );

  const farmerNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    farmers.forEach((f) => { m[f.id] = farmerName(f); });
    return m;
  }, [farmers]);

  const ndviSorted = useMemo(
    () =>
      [...allParcelles]
        .filter((p) => p.ndvi != null)
        .sort((a, b) => (a.ndvi ?? 0) - (b.ndvi ?? 0))
        .slice(0, 10),
    [allParcelles]
  );

  const financials = useMemo(() => {
    let surfaceTotale     = 0;
    let revenuTotal       = 0;
    let capaciteRembours  = 0;
    const culturesSet     = new Set<string>();

    farmers.forEach((f) => {
      const s = scoreMap[f.id];
      if (!s) return;
      surfaceTotale    += s.details?.c1?.surfaceTotale ?? 0;
      revenuTotal      += s.details?.c1?.revenuEstime  ?? 0;
      capaciteRembours += s.montantMax ?? 0;
      (s.details?.c1?.culturesPrincipales ?? []).forEach((c) => culturesSet.add(c));
    });

    return {
      surfaceTotale,
      revenuTotal,
      capaciteRembours,
      montantMaxCampagne: Math.round(capaciteRembours * 0.30),
      cultures: Array.from(culturesSet).sort(),
    };
  }, [farmers, scoreMap]);

  const productCounts = useMemo(() => {
    const counts = { remuci: 0, baobabProd: 0, baobabCamp: 0, nsia: 0 };
    farmers.forEach((f) => {
      const score = scoreMap[f.id]?.score ?? 0;
      if (score >= 300) counts.remuci++;
      if (score >= 400) counts.baobabProd++;
      if (score >= 600) counts.baobabCamp++;
      if (score >= 700) counts.nsia++;
    });
    return counts;
  }, [farmers, scoreMap]);

  // ── Loading ──
  if (loading) return <PageLoader message="Chargement de la coopérative…" />;

  // ── Error ──
  if (error || !coop) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <p className="text-red-400 font-medium">{error ?? "Coopérative introuvable"}</p>
          <Link href={`/${locale}/cooperatives`} className="text-sm text-accent hover:underline">
            ← Retour aux coopératives
          </Link>
        </div>
      </div>
    );
  }

  const avgScore = coopScore?.avgScore ?? 0;
  const avgColor = scoreColor(avgScore);

  return (
    <div className="space-y-6 p-6">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Link
            href={`/${locale}/cooperatives`}
            className="inline-flex items-center gap-1 text-sm text-text-secondary hover:text-accent transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Coopératives
          </Link>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>{coopName}</h1>
            {coop.filiere && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium">
                {coop.filiere}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted font-mono">{id}</p>
        </div>
        <button
          disabled
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-secondary border border-gray-700 text-text-secondary text-sm opacity-60 cursor-not-allowed"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>picture_as_pdf</span>
          Rapport PDF
        </button>
      </div>

      {/* ── Section 1: Profile + Score ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* LEFT — Profil */}
        <div className="lg:col-span-3 rounded-xl border border-gray-800 bg-bg-secondary p-6 space-y-5">
          {/* Avatar + name */}
          <div className="flex items-center gap-4">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold flex-shrink-0"
              style={{
                backgroundColor: "#3b82f620",
                color: "#3b82f6",
                border: "2px solid #3b82f640",
              }}
            >
              {(() => {
                const parts = coopName.split(" ");
                return initials(parts[0] ?? "", parts[1] ?? "");
              })()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">{coopName}</h2>
              <p className="text-sm text-text-muted font-mono mt-0.5">{id.slice(0, 16)}…</p>
            </div>
          </div>

          {/* Info rows */}
          <div className="space-y-3">
            {[
              { icon: "location_on",    label: "Région",              value: coop.region },
              { icon: "agriculture",    label: "Filière",             value: coop.filiere ?? "—" },
              { icon: "groups",         label: "Membres actifs",      value: coopScore?.totalFarmers?.toString() ?? coop.totalFarmers?.toString() ?? "—" },
              { icon: "calendar_month", label: "Ancienneté",          value: relativeTime(coop.foundedAt ?? coop.createdAt) },
              { icon: "verified",       label: "Certification",       value: coop.certification ?? "Aucune" },
              { icon: "description",    label: "RCCM",                value: coop.rccm ?? "—" },
              {
                icon: "handshake",
                label: "Contrats acheteurs",
                value: coop.contratAcheteurs === true
                  ? "✅ Oui"
                  : coop.contratAcheteurs === false
                    ? "❌ Non"
                    : "—",
              },
              {
                icon: "gps_fixed",
                label: "GPS",
                value: coop.lat != null && coop.lng != null
                  ? `${coop.lat.toFixed(4)}, ${coop.lng.toFixed(4)}`
                  : "❌ Non renseigné",
              },
            ].map(({ icon, label, value }) => (
              <div key={label} className="flex items-start gap-3">
                <span
                  className="material-symbols-outlined text-text-muted mt-0.5 flex-shrink-0"
                  style={{ fontSize: 18 }}
                >
                  {icon}
                </span>
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-xs text-text-muted w-36 flex-shrink-0">{label}</span>
                  <span className="text-sm text-text-primary">{value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — Score portefeuille */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-bg-secondary p-6 space-y-5">
          <h2 className="label-xs">
            Score Wakama Portefeuille
          </h2>

          {/* Big score */}
          <div className="flex flex-col items-center gap-2 py-2">
            <span className="text-6xl font-bold font-mono" style={{ color: avgColor }}>
              {avgScore}
            </span>
            <span className="text-sm text-text-muted">/1000</span>
            <span
              className="px-3 py-1 rounded-full border text-sm font-bold tracking-wider"
              style={{
                color: avgColor,
                backgroundColor: `${avgColor}1a`,
                borderColor: `${avgColor}40`,
              }}
            >
              {avgScore > 0 ? scoreLabel(avgScore) : "—"}
            </span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Scorés",    value: coopScore?.totalFarmers ?? 0 },
              { label: "Éligibles", value: coopScore?.eligible ?? 0 },
              {
                label: "Taux",
                value: coopScore?.eligibiliteRate != null
                  ? `${coopScore.eligibiliteRate}%`
                  : coopScore?.totalFarmers
                    ? `${Math.round(((coopScore.eligible ?? 0) / coopScore.totalFarmers) * 100)}%`
                    : "—",
              },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-bg-tertiary p-3 text-center">
                <p className="text-lg font-bold font-mono text-text-primary">{value}</p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Éligibilité produits */}
          <div className="space-y-2">
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">
              Éligibilité produits
            </p>
            {[
              { label: "REMUCI",       threshold: "≥ 300", count: productCounts.remuci,     color: "#f59e0b" },
              { label: "Baobab Prod",  threshold: "≥ 400", count: productCounts.baobabProd, color: "#3b82f6" },
              { label: "Baobab Camp",  threshold: "≥ 600", count: productCounts.baobabCamp, color: "#8b5cf6" },
              { label: "NSIA",         threshold: "≥ 700", count: productCounts.nsia,        color: "#10b981" },
            ].map(({ label, threshold, count, color }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  {label}
                  <span className="text-text-muted text-xs ml-1">{threshold}</span>
                </span>
                <span className="font-mono font-semibold" style={{ color }}>
                  {count}
                </span>
              </div>
            ))}
          </div>

          {/* Revenu estimé */}
          {financials.revenuTotal > 0 && (
            <div className="rounded-lg bg-bg-tertiary p-3">
              <p className="text-xs text-text-muted mb-1">Revenu total estimé</p>
              <p className="text-base font-bold font-mono text-emerald-400">
                {formatFCFA(financials.revenuTotal)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: IoT & Terrain + Parcelles NDVI ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT — IoT nodes */}
        <div className="rounded-xl border border-gray-800 bg-bg-secondary p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">Données terrain</h2>
            {iotNodes.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-bg-tertiary border border-gray-700 text-text-secondary text-xs font-mono">
                {iotNodes.length} nœud{iotNodes.length > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {iotNodes.length === 0 ? (
            <div className="rounded-lg bg-bg-tertiary border border-gray-700 p-4 space-y-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 18 }}>
                  sensors_off
                </span>
                <p className="text-sm text-text-secondary">Aucun nœud IoT connecté</p>
              </div>
              <p className="text-xs text-text-muted font-mono pl-6">
                Nœuds disponibles via /v1/iot/node?coopId={id}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {iotNodes.map((node) => {
                const isLive   = (node.status ?? "LIVE") === "LIVE";
                const lastSync = node.lastSyncAt ?? node.lastSeen;
                const reading  = node.readings?.[0];

                return (
                  <div
                    key={node.id}
                    className="rounded-lg bg-bg-tertiary border border-gray-700 p-4 space-y-4"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="material-symbols-outlined"
                          style={{
                            fontSize: 18,
                            color: isLive ? "#10b981" : "#ef4444",
                            fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                          }}
                        >
                          sensors
                        </span>
                        <span className="text-sm font-medium text-text-primary font-mono">
                          {node.nodeCode ?? node.type ?? node.id.slice(0, 12)}
                        </span>
                      </div>
                      <span
                        className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isLive
                            ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                            : "bg-red-500/10 border border-red-500/30 text-red-400"
                        }`}
                      >
                        {isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        {isLive ? "LIVE" : "OFFLINE"}
                      </span>
                    </div>

                    {/* Metadata */}
                    <div className="space-y-1.5 text-xs">
                      {[
                        { icon: "battery_5_bar", label: "Batterie",         value: node.batterie != null ? `${node.batterie}%` : "—" },
                        { icon: "wifi",           label: "Connectivité",     value: node.connectivity ?? "—" },
                        { icon: "sync",           label: "Dernière sync",    value: relativeTime(lastSync) },
                        { icon: "data_usage",     label: "Lectures totales", value: node.totalReadings?.toLocaleString("fr-FR") ?? "—" },
                        { icon: "gps_fixed",      label: "GPS",              value: `${node.lat.toFixed(4)}, ${node.lng.toFixed(4)}` },
                      ].map(({ icon, label, value }) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-text-muted flex-shrink-0" style={{ fontSize: 14 }}>{icon}</span>
                          <span className="text-text-muted w-28 flex-shrink-0">{label}</span>
                          <span className="font-mono text-text-secondary truncate">{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Latest reading */}
                    {reading && (
                      <div className="border-t border-gray-700 pt-3 space-y-1.5">
                        <p className="text-xs text-text-muted uppercase tracking-wider font-semibold mb-2">Dernière mesure</p>
                        {[
                          { icon: "device_thermostat", label: "Température",  value: `${reading.temperature}°C`, color: "#f59e0b" },
                          { icon: "water_drop",         label: "Humidité air", value: `${reading.humidity}%`,    color: "#3b82f6" },
                          { icon: "grass",              label: "Humidité sol", value: `${reading.soilMoisture}%`,color: "#10b981" },
                          ...(reading.rssi != null
                            ? [{ icon: "speed", label: "RSSI", value: `${reading.rssi} dBm`, color: "#8b5cf6" }]
                            : []),
                        ].map(({ icon, label, value, color }) => (
                          <div key={label} className="flex items-center gap-2 text-xs">
                            <span className="material-symbols-outlined flex-shrink-0" style={{ fontSize: 14, color }}>{icon}</span>
                            <span className="text-text-muted w-28 flex-shrink-0">{label}</span>
                            <span className="font-mono font-semibold text-text-primary">{value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* RIGHT — Parcelles & NDVI */}
        <div className="rounded-xl border border-gray-800 bg-bg-secondary p-6 space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-text-primary">Parcelles & NDVI</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-bg-tertiary border border-gray-700 text-text-secondary text-xs font-mono">
              {allParcelles.length}
            </span>
          </div>

          {/* Map */}
          <div className="rounded-lg overflow-hidden" style={{ height: 280 }}>
            <ParcellesNdviMap
              parcelles={allParcelles}
              farmerNames={farmerNameMap}
              centerLat={coop.lat}
              centerLng={coop.lng}
            />
          </div>

          {/* NDVI summary table */}
          {ndviSorted.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-800">
                    {["Farmer", "Parcelle", "Culture", "NDVI", "Statut"].map((h) => (
                      <th key={h} className="px-2 py-2 text-left text-text-muted font-semibold uppercase tracking-wider whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {ndviSorted.map((p) => {
                    const ndvi   = p.ndvi!;
                    const color  = ndvi >= 0.5 ? "#10b981" : ndvi >= 0.3 ? "#f59e0b" : "#ef4444";
                    const statut = ndvi >= 0.5 ? "BON"     : ndvi >= 0.3 ? "MOYEN"   : "FAIBLE";
                    return (
                      <tr key={p.id} className="hover:bg-bg-tertiary transition-colors">
                        <td className="px-2 py-2 text-text-secondary truncate max-w-[100px]">
                          {farmerNameMap[p.farmerId] ?? "—"}
                        </td>
                        <td className="px-2 py-2 font-mono text-text-muted">
                          {p.name ?? p.id.slice(0, 8)}
                        </td>
                        <td className="px-2 py-2 text-text-secondary">{p.culture}</td>
                        <td className="px-2 py-2 font-mono font-semibold" style={{ color }}>
                          {ndvi.toFixed(3)}
                        </td>
                        <td className="px-2 py-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-semibold"
                            style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}40` }}
                          >
                            {statut}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg bg-bg-tertiary border border-gray-700 p-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 18 }}>satellite_alt</span>
              <p className="text-sm text-text-secondary">Aucune donnée NDVI disponible</p>
            </div>
          )}
        </div>

      </div>

      {/* ── Section 3: Capacité financière ── */}
      <div className="rounded-xl border border-gray-800 bg-bg-secondary p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">Capacité de financement</h2>
          <span className="text-xs text-text-muted italic">Basé sur prix officiels CI</span>
        </div>

        {/* 4 stat boxes */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Surface totale",             value: `${financials.surfaceTotale.toFixed(1)} ha`, icon: "straighten",    color: "#3b82f6" },
            { label: "Revenu total estimé",         value: formatFCFA(financials.revenuTotal),          icon: "payments",      color: "#10b981" },
            { label: "Capacité remboursement",      value: formatFCFA(financials.capaciteRembours),     icon: "account_balance",color: "#8b5cf6" },
            { label: "Montant max crédit campagne", value: formatFCFA(financials.montantMaxCampagne),   icon: "credit_score",  color: "#f59e0b" },
          ].map(({ label, value, icon, color }) => (
            <div key={label} className="rounded-lg bg-bg-tertiary p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined" style={{ fontSize: 18, color }}>{icon}</span>
                <p className="text-xs text-text-muted">{label}</p>
              </div>
              <p className="text-lg font-bold font-mono text-text-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* Cultures principales */}
        {financials.cultures.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Cultures principales</p>
            <div className="flex flex-wrap gap-2">
              {financials.cultures.map((c) => (
                <span key={c} className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Farmers membres ── */}
      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <div className="bg-bg-secondary px-6 py-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-base font-bold text-text-primary">Agriculteurs membres</h2>
          <span className="px-2.5 py-0.5 rounded-full bg-bg-tertiary border border-gray-700 text-text-secondary text-xs font-mono">
            {farmers.length}
          </span>
        </div>

        {farmers.length === 0 ? (
          <div className="bg-bg-secondary px-6 py-16 text-center">
            <div className="flex flex-col items-center gap-2 text-text-muted">
              <span className="material-symbols-outlined" style={{ fontSize: 40 }}>person_off</span>
              <p className="text-sm">Aucun agriculteur enregistré</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-tertiary border-b border-gray-800">
                  {["Nom", "Score", "Région", "Culture", "KYC", "Éligibilité", "Actions"].map((h) => (
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
                {sortedFarmers.map((farmer) => {
                  const s         = scoreMap[farmer.id];
                  const score     = s?.score ?? 0;
                  const products  = eligibilityProducts(score);
                  const cultures  = s?.details?.c1?.culturesPrincipales ?? [];
                  const hasKyc    = !!(farmer.cniUrl || farmer.attestationUrl);

                  return (
                    <tr key={farmer.id} className="bg-bg-secondary hover:bg-bg-tertiary transition-colors">
                      {/* Nom */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{
                              backgroundColor: "#10b98120",
                              color: "#10b981",
                              border: "1px solid #10b98140",
                            }}
                          >
                            {initials(
                              farmer.firstName ?? farmer.prenom ?? "",
                              farmer.lastName  ?? farmer.nom   ?? ""
                            )}
                          </div>
                          <span className="text-text-primary font-medium">{farmerName(farmer)}</span>
                        </div>
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {score > 0 ? (
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium font-mono ${formatScore(score)}`}>
                            {score}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Région */}
                      <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                        {farmer.region ?? "—"}
                      </td>

                      {/* Culture */}
                      <td className="px-4 py-3">
                        {cultures.length > 0 ? (
                          <span className="text-text-secondary text-xs">
                            {cultures.slice(0, 2).join(", ")}
                            {cultures.length > 2 && (
                              <span className="text-text-muted"> +{cultures.length - 2}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* KYC */}
                      <td className="px-4 py-3">
                        {hasKyc ? (
                          <span className="flex items-center gap-1 text-emerald-400 text-xs font-medium">
                            <span
                              className="material-symbols-outlined"
                              style={{ fontSize: 14, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 16' }}
                            >
                              check_circle
                            </span>
                            Complet
                          </span>
                        ) : (
                          <span className="text-amber-500 text-xs">Incomplet</span>
                        )}
                      </td>

                      {/* Éligibilité */}
                      <td className="px-4 py-3">
                        {products.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {products.map((p) => (
                              <span
                                key={p}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"
                              >
                                {p}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">Non éligible</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/farmers/${farmer.id}`}
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
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
}
