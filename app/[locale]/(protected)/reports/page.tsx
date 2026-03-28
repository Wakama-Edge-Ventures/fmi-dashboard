"use client";

import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = "Portefeuille" | "Scoring" | "NDVI" | "Risque" | "Crédit";
type ReportFormat = "PDF" | "Excel" | "CSV";
type ReportPeriod = "Ce mois" | "Trimestre" | "Année" | "Personnalisé";
type ReportStatus = "ready" | "generating" | "failed";
type Tab = "generated" | "scheduled" | "templates";

interface GeneratedReport {
  id: string;
  name: string;
  type: ReportType;
  size: string;
  date: string;
  status: ReportStatus;
}

interface ScheduledReport {
  id: string;
  name: string;
  frequency: string;
  nextRun: string;
  active: boolean;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ReportType;
}

// ─── Static data ──────────────────────────────────────────────────────────────

const GENERATED_REPORTS: GeneratedReport[] = [
  { id: "r1", name: "Portefeuille MFI — Mars 2026",      type: "Portefeuille", size: "1.2 MB", date: "2026-03-25", status: "ready" },
  { id: "r2", name: "Scoring Farmers — Fév 2026",         type: "Scoring",      size: "845 KB", date: "2026-03-01", status: "ready" },
  { id: "r3", name: "NDVI Global — T1 2026",              type: "NDVI",         size: "3.4 MB", date: "2026-02-28", status: "ready" },
  { id: "r4", name: "Risque Portefeuille — Jan 2026",     type: "Risque",       size: "620 KB", date: "2026-02-01", status: "ready" },
  { id: "r5", name: "Demandes de crédit — Mars 2026",     type: "Crédit",       size: "290 KB", date: "2026-03-20", status: "ready" },
];

const SCHEDULED_REPORTS: ScheduledReport[] = [
  { id: "s1", name: "Rapport mensuel portefeuille", frequency: "Mensuel",      nextRun: "2026-04-01", active: true  },
  { id: "s2", name: "Scoring hebdomadaire",         frequency: "Hebdomadaire", nextRun: "2026-03-31", active: true  },
  { id: "s3", name: "Alerte NDVI critique",         frequency: "Quotidien",    nextRun: "2026-03-29", active: false },
];

const TEMPLATES: ReportTemplate[] = [
  { id: "t1", name: "Rapport Farmer",        description: "Fiche individuelle complète avec score, parcelles et historique crédit", icon: "person",         type: "Scoring"      },
  { id: "t2", name: "Rapport Coopérative",   description: "Synthèse coopérative : membres, score moyen, éligibilité, NDVI",         icon: "groups",        type: "Portefeuille" },
  { id: "t3", name: "Rapport NDVI",          description: "État sanitaire des cultures par zone géographique et période",            icon: "satellite_alt", type: "NDVI"         },
  { id: "t4", name: "Rapport Risque",        description: "Distribution des risques, alertes actives et recommandations",           icon: "shield",        type: "Risque"       },
  { id: "t5", name: "Rapport IoT",           description: "Données capteurs terrain : température, humidité, disponibilité",        icon: "sensors",       type: "Portefeuille" },
  { id: "t6", name: "Rapport Crédit",        description: "Pipeline demandes, taux d'approbation, volume accordé",                  icon: "request_quote", type: "Crédit"       },
];

const STATUS_STYLES: Record<ReportStatus, { container: string; text: string; label: string }> = {
  ready:      { container: "bg-emerald-500/10 border-emerald-800", text: "text-emerald-400", label: "Prêt"          },
  generating: { container: "bg-amber-500/10 border-amber-800",     text: "text-amber-400",   label: "Génération…"   },
  failed:     { container: "bg-red-500/10 border-red-800",         text: "text-red-400",     label: "Échec"         },
};

const REPORT_TYPES: ReportType[]   = ["Portefeuille", "Scoring", "NDVI", "Risque", "Crédit"];
const REPORT_FORMATS: ReportFormat[] = ["PDF", "Excel", "CSV"];
const REPORT_PERIODS: ReportPeriod[] = ["Ce mois", "Trimestre", "Année", "Personnalisé"];

// ─── Generate modal ───────────────────────────────────────────────────────────

function GenerateModal({ onClose }: { onClose: () => void }) {
  const [type,   setType]   = useState<ReportType>("Portefeuille");
  const [period, setPeriod] = useState<ReportPeriod>("Ce mois");
  const [format, setFormat] = useState<ReportFormat>("PDF");
  const [busy,   setBusy]   = useState(false);
  const [done,   setDone]   = useState(false);

  async function handleGenerate() {
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1500));
    setBusy(false);
    setDone(true);
    setTimeout(onClose, 1200);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-bg-secondary shadow-2xl" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 className="text-base font-semibold text-text-primary">Générer un rapport</h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Type</label>
            <div className="flex flex-wrap gap-2">
              {REPORT_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => setType(t)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                    type === t
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "bg-bg-primary border-gray-800 text-text-secondary hover:border-gray-700",
                  ].join(" ")}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Période */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Période</label>
            <div className="flex flex-wrap gap-2">
              {REPORT_PERIODS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={[
                    "px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                    period === p
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "bg-bg-primary border-gray-800 text-text-secondary hover:border-gray-700",
                  ].join(" ")}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Format */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-text-secondary uppercase tracking-wide">Format</label>
            <div className="flex gap-2">
              {REPORT_FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={[
                    "px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors",
                    format === f
                      ? "bg-accent/15 border-accent/40 text-accent"
                      : "bg-bg-primary border-gray-800 text-text-secondary hover:border-gray-700",
                  ].join(" ")}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary border border-gray-800 hover:border-gray-700 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleGenerate}
            disabled={busy || done}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-60 transition-colors"
          >
            {busy && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {done ? "Généré ✓" : busy ? "Génération…" : "Générer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("generated");
  const [showModal, setShowModal] = useState(false);
  const [scheduled, setScheduled] = useState(SCHEDULED_REPORTS);

  function toggleScheduled(id: string) {
    setScheduled((prev) =>
      prev.map((s) => (s.id === id ? { ...s, active: !s.active } : s))
    );
  }

  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "generated",  label: "Générés",   icon: "description"   },
    { key: "scheduled",  label: "Planifiés",  icon: "schedule"      },
    { key: "templates",  label: "Modèles",    icon: "dashboard_customize" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Rapports</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            Générez et planifiez vos rapports MFI
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          Générer rapport
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={[
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary",
            ].join(" ")}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                fontVariationSettings: activeTab === tab.key
                  ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20'
                  : '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 20',
              }}
            >
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Générés ── */}
      {activeTab === "generated" && (
        <div className="rounded-xl bg-bg-secondary overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-primary/40" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Nom</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Taille</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-muted uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/60">
              {GENERATED_REPORTS.map((r) => {
                const s = STATUS_STYLES[r.status];
                return (
                  <tr key={r.id} className="hover:bg-bg-hover transition-colors">
                    <td className="px-4 py-3.5 text-text-primary font-medium">{r.name}</td>
                    <td className="px-4 py-3.5 text-text-secondary">{r.type}</td>
                    <td className="px-4 py-3.5 text-text-muted font-mono text-xs">{r.size}</td>
                    <td className="px-4 py-3.5 text-text-secondary">
                      {new Date(r.date).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${s.container} ${s.text}`}>
                        {r.status === "generating" && (
                          <span className="w-2 h-2 rounded-full border border-current border-t-transparent animate-spin" />
                        )}
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          title="Télécharger"
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>download</span>
                        </button>
                        <button
                          title="Partager"
                          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>share</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Tab: Planifiés ── */}
      {activeTab === "scheduled" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {scheduled.map((s) => (
            <div key={s.id} className="rounded-xl bg-bg-secondary p-5 space-y-4" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-text-primary">{s.name}</p>
                  <p className="text-xs text-text-muted mt-0.5">{s.frequency}</p>
                </div>
                {/* Toggle */}
                <button
                  onClick={() => toggleScheduled(s.id)}
                  className={[
                    "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
                    s.active ? "bg-accent" : "bg-gray-700",
                  ].join(" ")}
                  role="switch"
                  aria-checked={s.active}
                >
                  <span
                    className={[
                      "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform",
                      s.active ? "translate-x-4" : "translate-x-0",
                    ].join(" ")}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>schedule</span>
                Prochaine exécution : {new Date(s.nextRun).toLocaleDateString("fr-FR")}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Modèles ── */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="rounded-xl bg-bg-secondary p-5 space-y-4 transition-colors" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 shrink-0">
                  <span
                    className="material-symbols-outlined text-accent"
                    style={{
                      fontSize: 20,
                      fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                    }}
                  >
                    {t.icon}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.type}</p>
                </div>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed">{t.description}</p>
              <button
                onClick={() => setShowModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-gray-800 text-text-secondary hover:bg-bg-hover hover:text-text-primary hover:border-gray-700 transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                Générer
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && <GenerateModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
