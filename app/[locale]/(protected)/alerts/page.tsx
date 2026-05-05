"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import KPICard from "@/src/components/ui/KPICard";
import PageLoader from "@/src/components/ui/PageLoader";
import {
  alerts as alertsApi,
  cooperatives as cooperativesApi,
  farmers as farmersApi,
} from "@/src/lib/api";
import { canMarkAlerts, isReadOnly } from "@/src/lib/auth";
import { relativeTime } from "@/src/lib/utils";
import type { Alert, AlertSeverity, AlertType, Cooperative, Farmer } from "@/src/types";

// ─── Severity helpers ─────────────────────────────────────────────────────────

function severityColor(s: AlertSeverity): string {
  if (s === "HIGH"     || s === "CRITICAL") return "#ef4444";
  if (s === "MEDIUM"   || s === "WARNING")  return "#f59e0b";
  if (s === "LOW"      || s === "INFO")     return "#10b981";
  return "#6b7280";
}

function severityIcon(s: AlertSeverity): string {
  if (s === "HIGH"   || s === "CRITICAL") return "error";
  if (s === "MEDIUM" || s === "WARNING")  return "warning";
  return "info";
}

function severityLabel(s: AlertSeverity): string {
  if (s === "HIGH"   || s === "CRITICAL") return "HIGH";
  if (s === "MEDIUM" || s === "WARNING")  return "MEDIUM";
  if (s === "LOW"    || s === "INFO")     return "LOW";
  return s;
}

function isCritical(s: AlertSeverity): boolean {
  return s === "HIGH" || s === "CRITICAL";
}

function isHighOrCritical(a: Alert): boolean {
  return isCritical(a.severity);
}

// ─── Type badge ───────────────────────────────────────────────────────────────

const TYPE_COLORS: Record<string, string> = {
  METEO:  "#3b82f6",
  SCORE:  "#8b5cf6",
  CREDIT: "#f59e0b",
  IOT:    "#10b981",
  SYSTEM: "#6b7280",
};

function typeColor(t: AlertType | undefined): string {
  return t ? (TYPE_COLORS[t] ?? "#6b7280") : "#6b7280";
}

// ─── Severity filter normalization ────────────────────────────────────────────

type SevFilter = "Toutes" | "HIGH" | "MEDIUM" | "LOW";
type TypeFilter = "Toutes" | AlertType;

function matchesSevFilter(a: Alert, f: SevFilter): boolean {
  if (f === "Toutes") return true;
  return severityLabel(a.severity) === f;
}

const PAGE_SIZE = 20;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "fr";
  const canPatchAlerts = canMarkAlerts();
  const readOnly = isReadOnly();

  // ── Data state ──
  const [allAlerts,  setAllAlerts]  = useState<Alert[]>([]);
  const [farmerMap,  setFarmerMap]  = useState<Record<string, Farmer>>({});
  const [coopMap,    setCoopMap]    = useState<Record<string, Cooperative>>({});
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  // ── UI state ──
  const [sevFilter,     setSevFilter]     = useState<SevFilter>("Toutes");
  const [typeFilter,    setTypeFilter]    = useState<TypeFilter>("Toutes");
  const [unreadOnly,    setUnreadOnly]    = useState(false);
  const [expandedId,    setExpandedId]    = useState<string | null>(null);
  const [page,          setPage]          = useState(0);

  // ── Fetch ──
  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [alertsData, farmersData, coopsData] = await Promise.all([
          alertsApi.list(),
          farmersApi.list({ limit: 100 }).catch(() => ({ data: [] as Farmer[] })),
          cooperativesApi.list().catch(() => [] as Cooperative[]),
        ]);

        const alertList: Alert[] = Array.isArray(alertsData)
          ? alertsData
          : (alertsData as { data?: Alert[] })?.data ?? [];

        setAllAlerts(alertList.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));

        const fm: Record<string, Farmer> = {};
        (farmersData.data ?? []).forEach((f) => { fm[f.id] = f; });
        setFarmerMap(fm);

        const cm: Record<string, Cooperative> = {};
        const coopList: Cooperative[] = Array.isArray(coopsData)
          ? coopsData
          : (coopsData as { data?: Cooperative[] })?.data ?? [];
        coopList.forEach((c) => { cm[c.id] = c; });
        setCoopMap(cm);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur de chargement");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Mark single alert as read (optimistic) ──
  async function handleMarkRead(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!canPatchAlerts) return;
    setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    try {
      await alertsApi.markRead(id);
    } catch {
      // Revert on failure
      setAllAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: false } : a)));
    }
  }

  // ── Mark all as read ──
  async function handleMarkAllRead() {
    if (!canPatchAlerts) return;
    setMarkingAll(true);
    setAllAlerts((prev) => prev.map((a) => ({ ...a, read: true })));
    try {
      await alertsApi.markAllRead();
    } catch {
      // Revert
      setAllAlerts((prev) => prev.map((a) => ({ ...a, read: false })));
    } finally {
      setMarkingAll(false);
    }
  }

  // ── KPIs ──
  const kpis = useMemo(() => ({
    total:    allAlerts.length,
    unread:   allAlerts.filter((a) => !a.read).length,
    critical: allAlerts.filter((a) => isHighOrCritical(a)).length,
  }), [allAlerts]);

  // ── Unique alert types from data ──
  const alertTypes = useMemo(() => {
    const types = Array.from(new Set(allAlerts.map((a) => a.type).filter(Boolean))) as AlertType[];
    return ["Toutes" as TypeFilter, ...types.sort()];
  }, [allAlerts]);

  // ── Filtered + paginated ──
  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (!matchesSevFilter(a, sevFilter)) return false;
      if (typeFilter !== "Toutes" && a.type !== typeFilter) return false;
      if (unreadOnly && a.read) return false;
      return true;
    });
  }, [allAlerts, sevFilter, typeFilter, unreadOnly]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage   = Math.min(page, totalPages - 1);
  const paginated  = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  function resetPage() { setPage(0); }

  // ── Loading ──
  if (loading) return <PageLoader message="Chargement des alertes…" />;

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

  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Alertes</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Centre de notifications — {kpis.unread > 0
              ? `${kpis.unread} non lue${kpis.unread > 1 ? "s" : ""}`
              : "tout lu"}
          </p>
        </div>
      </div>

      {readOnly && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 text-sm text-amber-300">
          Mode READONLY : marquage des alertes désactivé.
        </div>
      )}

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total alertes"
          value={kpis.total}
          icon="notifications"
          color="#3b82f6"
        />
        <KPICard
          label="Non lues"
          value={kpis.unread}
          icon="mark_email_unread"
          color="#f59e0b"
        />
        <KPICard
          label="Critiques"
          value={kpis.critical}
          icon="error"
          color="#ef4444"
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-bg-secondary p-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Sévérité */}
        <select
          value={sevFilter}
          onChange={(e) => { setSevFilter(e.target.value as SevFilter); resetPage(); }}
          className="rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {(["Toutes", "HIGH", "MEDIUM", "LOW"] as SevFilter[]).map((s) => (
            <option key={s} value={s}>
              {s === "Toutes" ? "Sévérité : Toutes" : s}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value as TypeFilter); resetPage(); }}
          className="rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {alertTypes.map((t) => (
            <option key={t} value={t}>
              {t === "Toutes" ? "Type : Toutes" : t}
            </option>
          ))}
        </select>

        {/* Unread toggle */}
        <button
          onClick={() => { setUnreadOnly((v) => !v); resetPage(); }}
          className={[
            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
            unreadOnly
              ? "bg-accent/10 border-accent/40 text-accent"
              : "bg-bg-tertiary border-gray-700 text-text-secondary hover:text-text-primary hover:border-gray-600",
          ].join(" ")}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: unreadOnly ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' : '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            mark_email_unread
          </span>
          Non lues seulement
        </button>

        {/* Count */}
        <span className="text-sm text-text-muted">
          {filtered.length} alerte{filtered.length !== 1 ? "s" : ""}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Mark all read */}
        {kpis.unread > 0 && canPatchAlerts && (
          <button
            onClick={handleMarkAllRead}
            disabled={markingAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {markingAll ? (
              <span className="w-4 h-4 rounded-full border-2 border-emerald-400 border-t-transparent animate-spin" />
            ) : (
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>done_all</span>
            )}
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* ── Alert cards ── */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-text-muted">
          <span className="material-symbols-outlined" style={{ fontSize: 48 }}>notifications_off</span>
          <p className="text-base">Aucune alerte</p>
          {(sevFilter !== "Toutes" || typeFilter !== "Toutes" || unreadOnly) && (
            <button
              onClick={() => { setSevFilter("Toutes"); setTypeFilter("Toutes"); setUnreadOnly(false); }}
              className="text-sm text-accent hover:underline"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {paginated.map((alert) => {
            const color    = severityColor(alert.severity);
            const icon     = severityIcon(alert.severity);
            const isExpanded = expandedId === alert.id;
            const farmer   = alert.farmerId ? farmerMap[alert.farmerId] : undefined;
            const coop     = alert.coopId   ? coopMap[alert.coopId]     : undefined;
            const farmerDisplayName = farmer
              ? `${farmer.firstName ?? farmer.prenom ?? ""} ${farmer.lastName ?? farmer.nom ?? ""}`.trim() || farmer.id
              : null;
            const coopDisplayName = coop
              ? (coop.name ?? coop.nom ?? coop.id)
              : null;

            return (
              <div
                key={alert.id}
                onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                className={[
                  "rounded-xl border bg-bg-secondary cursor-pointer transition-all duration-200",
                  alert.read ? "" : "border-l-4",
                ].join(" ")}
                style={alert.read ? { border: "1px solid rgba(255,255,255,0.06)" } : { borderLeftColor: "#10b981", borderTopColor: "rgba(255,255,255,0.06)", borderRightColor: "rgba(255,255,255,0.06)", borderBottomColor: "rgba(255,255,255,0.06)" }}
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Severity icon */}
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 18, color, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
                    >
                      {icon}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Row 1: title + badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-text-primary">
                        {alert.title ?? alert.message.slice(0, 60)}
                      </p>
                      {/* Severity badge */}
                      <span
                        className="px-1.5 py-0.5 rounded text-xs font-bold"
                        style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                      >
                        {severityLabel(alert.severity)}
                      </span>
                      {/* Type badge */}
                      {alert.type && (
                        <span
                          className="px-1.5 py-0.5 rounded text-xs font-medium"
                          style={{
                            color: typeColor(alert.type),
                            backgroundColor: `${typeColor(alert.type)}18`,
                            border: `1px solid ${typeColor(alert.type)}30`,
                          }}
                        >
                          {alert.type}
                        </span>
                      )}
                      {/* Unread dot */}
                      {!alert.read && (
                        <span className="w-2 h-2 rounded-full bg-accent flex-shrink-0" />
                      )}
                    </div>

                    {/* Row 2: message (collapsed = 1 line, expanded = full) */}
                    <p
                      className={[
                        "text-sm text-text-secondary mt-1",
                        isExpanded ? "" : "truncate",
                      ].join(" ")}
                    >
                      {alert.message}
                    </p>

                    {/* Row 3: farmer / coop / timestamp */}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {farmerDisplayName && (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>person</span>
                          {farmerDisplayName}
                        </span>
                      )}
                      {coopDisplayName && (
                        <span className="flex items-center gap-1 text-xs text-text-muted">
                          <span className="material-symbols-outlined" style={{ fontSize: 13 }}>groups</span>
                          {coopDisplayName}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-text-muted">
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>schedule</span>
                        {relativeTime(alert.createdAt)}
                      </span>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div
                        className="mt-3 rounded-lg bg-bg-tertiary border border-gray-700 p-3 space-y-2 text-xs"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-muted">ID alerte</span>
                          <span className="font-mono text-text-secondary">{alert.id}</span>
                        </div>
                        {alert.farmerId && (
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted">Farmer</span>
                            <Link
                              href={`/${locale}/farmers/${alert.farmerId}`}
                              className="font-mono text-accent hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {farmerDisplayName ?? alert.farmerId}
                            </Link>
                          </div>
                        )}
                        {alert.coopId && (
                          <div className="flex items-center gap-2">
                            <span className="text-text-muted">Coopérative</span>
                            <Link
                              href={`/${locale}/cooperatives/${alert.coopId}`}
                              className="font-mono text-accent hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {coopDisplayName ?? alert.coopId}
                            </Link>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Créée le</span>
                          <span className="text-text-secondary">
                            {new Date(alert.createdAt).toLocaleString("fr-FR")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-text-muted">Statut</span>
                          <span className={alert.read ? "text-text-muted" : "text-accent font-semibold"}>
                            {alert.read ? "Lu" : "Non lu"}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: mark read + expand chevron */}
                  <div className="flex-shrink-0 flex items-center gap-2">
                    {!alert.read && canPatchAlerts && (
                      <button
                        onClick={(e) => handleMarkRead(alert.id, e)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-accent/10 border border-accent/30 text-accent text-xs font-medium hover:bg-accent/20 transition-colors whitespace-nowrap"
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: 13 }}>check</span>
                        Marquer lu
                      </button>
                    )}
                    {!alert.read && !canPatchAlerts && (
                      <span className="text-xs text-text-muted whitespace-nowrap">
                        Lecture seule
                      </span>
                    )}
                    <span
                      className="material-symbols-outlined text-text-muted transition-transform duration-200"
                      style={{
                        fontSize: 18,
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      }}
                    >
                      expand_more
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-text-muted">
            Page {safePage + 1} / {totalPages}
            <span className="ml-2 text-text-muted">
              ({safePage * PAGE_SIZE + 1}–{Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} sur {filtered.length})
            </span>
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-secondary border border-gray-700 text-text-secondary hover:text-text-primary hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const offset = Math.max(0, Math.min(safePage - 3, totalPages - 7));
              const pg = i + offset;
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={[
                    "w-8 h-8 flex items-center justify-center rounded-lg border text-sm font-mono transition-colors",
                    pg === safePage
                      ? "bg-accent/10 border-accent/40 text-accent"
                      : "bg-bg-secondary border-gray-700 text-text-secondary hover:border-accent/40 hover:text-text-primary",
                  ].join(" ")}
                >
                  {pg + 1}
                </button>
              );
            })}
            <button
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-bg-secondary border border-gray-700 text-text-secondary hover:text-text-primary hover:border-accent/40 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
