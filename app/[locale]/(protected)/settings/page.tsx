"use client";

import { useEffect, useState } from "react";
import { auth as authApi } from "@/src/lib/api";
import type { AuthUser } from "@/src/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "account" | "apikeys" | "notifications" | "scoring";

interface NotifSettings {
  criticalAlerts:   boolean;
  scoreVariation:   boolean;
  newFarmer:        boolean;
  weeklyReport:     boolean;
  ndviAlert:        boolean;
}

interface ScoringWeights {
  c1: number; // Capacité
  c2: number; // Caractère
  c3: number; // Collatéral
  c4: number; // Conditions
}

interface EligibilityThresholds {
  remuci:       number;
  baobabProd:   number;
  baobabCamp:   number;
  nsia:         number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function maskKey(key: string): string {
  return key.slice(0, 8) + "•".repeat(24) + key.slice(-4);
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={[
        "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
        checked ? "bg-accent" : "bg-gray-700",
      ].join(" ")}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={[
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </button>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-bg-secondary overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="px-5 py-3.5 bg-bg-primary/30" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("account");

  // ── Account state ──
  const [user,       setUser]       = useState<AuthUser | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => {}).finally(() => setUserLoading(false));
  }, []);

  async function handleSaveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    await new Promise((r) => setTimeout(r, 800));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  // ── API Key state ──
  const API_KEY = "wk_live_sk_7f3a9e2b1c4d8f6a0e5b3c7d9f1a2b4c";
  const [keyVisible, setKeyVisible] = useState(false);
  const [copied,     setCopied]     = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(API_KEY).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Notification state ──
  const [notifs, setNotifs] = useState<NotifSettings>({
    criticalAlerts: true,
    scoreVariation: true,
    newFarmer:      false,
    weeklyReport:   true,
    ndviAlert:      false,
  });
  const [notifSaved, setNotifSaved] = useState(false);

  function handleSaveNotifs() {
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 2500);
  }

  // ── Scoring state ──
  const [weights, setWeights] = useState<ScoringWeights>({ c1: 25, c2: 25, c3: 25, c4: 25 });
  const [thresholds, setThresholds] = useState<EligibilityThresholds>({
    remuci: 300, baobabProd: 400, baobabCamp: 600, nsia: 700,
  });
  const [scoringSaved, setScoringSaved] = useState(false);

  const weightTotal = weights.c1 + weights.c2 + weights.c3 + weights.c4;

  function handleSaveScoring() {
    if (weightTotal !== 100) return;
    setScoringSaved(true);
    setTimeout(() => setScoringSaved(false), 2500);
  }

  // ── Tabs ──
  const TABS: { key: Tab; label: string; icon: string }[] = [
    { key: "account",       label: "Compte",        icon: "manage_accounts" },
    { key: "apikeys",       label: "API Keys",       icon: "key"             },
    { key: "notifications", label: "Notifications",  icon: "notifications"   },
    { key: "scoring",       label: "Scoring",        icon: "grade"           },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }}>Paramètres</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Gérez votre compte, vos clés API et les paramètres de scoring
        </p>
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

      {/* ── Tab: Compte ── */}
      {activeTab === "account" && (
        <div className="max-w-lg space-y-5">
          {userLoading ? (
            <div className="flex items-center gap-3 text-text-secondary py-4">
              <div className="w-5 h-5 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-sm">Chargement du profil…</span>
            </div>
          ) : (
            <Section title="Profil">
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted">Prénom</label>
                    <input
                      type="text"
                      defaultValue={user?.email?.split("@")[0] ?? ""}
                      className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-gray-800 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs text-text-muted">Nom</label>
                    <input
                      type="text"
                      defaultValue=""
                      className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-gray-800 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-text-muted">Email</label>
                  <input
                    type="email"
                    defaultValue={user?.email ?? ""}
                    className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-gray-800 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-text-muted">Organisation</label>
                  <input
                    type="text"
                    defaultValue="Wakama MFI"
                    className="w-full px-3 py-2 rounded-lg bg-bg-primary border border-gray-800 text-text-primary text-sm focus:outline-none focus:border-accent/60 transition-colors"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-text-muted">Rôle</label>
                  <input
                    type="text"
                    readOnly
                    value={user?.role ?? "—"}
                    className="w-full px-3 py-2 rounded-lg bg-bg-primary/50 border border-gray-800 text-text-muted text-sm cursor-not-allowed"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-60 transition-colors"
                  >
                    {saving && <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />}
                    {saved ? "Enregistré ✓" : saving ? "Enregistrement…" : "Enregistrer"}
                  </button>
                </div>
              </form>
            </Section>
          )}
        </div>
      )}

      {/* ── Tab: API Keys ── */}
      {activeTab === "apikeys" && (
        <div className="max-w-xl space-y-5">
          <Section title="Clé API Wakama">
            <div className="space-y-4">
              {/* Key display */}
              <div>
                <label className="text-xs text-text-muted mb-1.5 block">Clé d'accès</label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 px-3 py-2 rounded-lg bg-bg-primary border border-gray-800 text-xs font-mono text-text-secondary overflow-hidden text-ellipsis whitespace-nowrap">
                    {keyVisible ? API_KEY : maskKey(API_KEY)}
                  </code>
                  <button
                    onClick={() => setKeyVisible((v) => !v)}
                    className="p-2 rounded-lg border border-gray-800 text-text-muted hover:text-text-primary hover:bg-bg-hover transition-colors"
                    title={keyVisible ? "Masquer" : "Afficher"}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                      {keyVisible ? "visibility_off" : "visibility"}
                    </span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-800 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                      {copied ? "check" : "content_copy"}
                    </span>
                    {copied ? "Copié" : "Copier"}
                  </button>
                </div>
              </div>

              {/* Usage */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-bg-primary border border-gray-800 px-4 py-3">
                  <p className="text-xs text-text-muted">Appels aujourd'hui</p>
                  <p className="text-xl font-bold text-text-primary mt-0.5 font-mono">247</p>
                </div>
                <div className="rounded-lg bg-bg-primary border border-gray-800 px-4 py-3">
                  <p className="text-xs text-text-muted">Appels ce mois</p>
                  <p className="text-xl font-bold text-text-primary mt-0.5 font-mono">5 832</p>
                </div>
              </div>

              {/* Curl example */}
              <div>
                <p className="text-xs text-text-muted mb-1.5">Exemple d'utilisation</p>
                <pre className="px-4 py-3 rounded-lg bg-bg-primary border border-gray-800 text-xs text-emerald-400 font-mono overflow-x-auto whitespace-pre-wrap">
{`curl -H "Authorization: Bearer ${keyVisible ? API_KEY : maskKey(API_KEY)}" \\
  https://api.wakama.farm/v1/farmers`}
                </pre>
              </div>
            </div>
          </Section>
        </div>
      )}

      {/* ── Tab: Notifications ── */}
      {activeTab === "notifications" && (
        <div className="max-w-lg space-y-5">
          <Section title="Préférences de notification">
            <div className="space-y-4">
              {(
                [
                  { key: "criticalAlerts",  label: "Alertes critiques",              sub: "NDVI, météo extrême, perte de score importante"  },
                  { key: "scoreVariation",  label: "Variation de score",              sub: "Notification si variation > 10% sur un farmer"   },
                  { key: "newFarmer",       label: "Nouveau farmer enregistré",       sub: "Chaque nouvelle inscription dans votre portefeuille" },
                  { key: "weeklyReport",    label: "Rapport hebdomadaire",             sub: "Résumé du portefeuille envoyé chaque lundi"      },
                  { key: "ndviAlert",       label: "Alerte NDVI dégradé",             sub: "Notification si NDVI parcelle < 0.35"           },
                ] as { key: keyof NotifSettings; label: string; sub: string }[]
              ).map(({ key, label, sub }) => (
                <div key={key} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{sub}</p>
                  </div>
                  <Toggle
                    checked={notifs[key]}
                    onChange={(v) => setNotifs((n) => ({ ...n, [key]: v }))}
                  />
                </div>
              ))}
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={handleSaveNotifs}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              {notifSaved ? "Enregistré ✓" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Scoring ── */}
      {activeTab === "scoring" && (
        <div className="max-w-lg space-y-5">
          {/* Pondération C1/C2/C3/C4 */}
          <Section title="Pondération des composantes">
            <div className="space-y-4">
              <p className="text-xs text-text-muted">
                Ajustez la pondération de chaque composante du score Wakama (total = 100%)
              </p>
              {(
                [
                  { key: "c1", label: "C1 — Capacité",    color: "#10b981" },
                  { key: "c2", label: "C2 — Caractère",   color: "#3b82f6" },
                  { key: "c3", label: "C3 — Collatéral",  color: "#f59e0b" },
                  { key: "c4", label: "C4 — Conditions",  color: "#8b5cf6" },
                ] as { key: keyof ScoringWeights; label: string; color: string }[]
              ).map(({ key, label, color }) => (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm text-text-secondary">{label}</label>
                    <span className="text-sm font-mono font-semibold" style={{ color }}>
                      {weights[key]}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={weights[key]}
                    onChange={(e) =>
                      setWeights((w) => ({ ...w, [key]: Number(e.target.value) }))
                    }
                    className="w-full h-1.5 rounded-full appearance-none bg-gray-800 cursor-pointer"
                    style={{ accentColor: color }}
                  />
                </div>
              ))}

              <div className={[
                "flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium",
                weightTotal === 100
                  ? "bg-emerald-500/10 border border-emerald-800 text-emerald-400"
                  : "bg-red-500/10 border border-red-800 text-red-400",
              ].join(" ")}>
                <span>Total</span>
                <span className="font-mono">{weightTotal}%</span>
              </div>
              {weightTotal !== 100 && (
                <p className="text-xs text-red-400">Le total doit être égal à 100%</p>
              )}
            </div>
          </Section>

          {/* Seuils d'éligibilité */}
          <Section title="Seuils d'éligibilité">
            <div className="space-y-3">
              {(
                [
                  { key: "remuci",     label: "REMUCI"             },
                  { key: "baobabProd", label: "Baobab Agri Prod"   },
                  { key: "baobabCamp", label: "Baobab Agri Camp"   },
                  { key: "nsia",       label: "NSIA Pack Paysan"   },
                ] as { key: keyof EligibilityThresholds; label: string }[]
              ).map(({ key, label }) => (
                <div key={key} className="flex items-center gap-3">
                  <label className="flex-1 text-sm text-text-secondary">{label}</label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-text-muted">≥</span>
                    <input
                      type="number"
                      min={0}
                      max={1000}
                      value={thresholds[key]}
                      onChange={(e) =>
                        setThresholds((t) => ({ ...t, [key]: Number(e.target.value) }))
                      }
                      className="w-20 px-2 py-1.5 rounded-lg bg-bg-primary border border-gray-800 text-text-primary text-sm font-mono text-right focus:outline-none focus:border-accent/60 transition-colors"
                    />
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="flex justify-end">
            <button
              onClick={handleSaveScoring}
              disabled={weightTotal !== 100}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 transition-colors"
            >
              {scoringSaved ? "Enregistré ✓" : "Enregistrer"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
