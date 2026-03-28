"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import SliderInput from "@/src/components/ui/SliderInput";
import RangeConfig from "@/src/components/ui/RangeConfig";
import {
  getActiveConfig,
  saveConfigLocally,
  DEFAULT_CONFIG,
  DEFAULT_PRODUCTS,
  applyCustomWeights,
  type InstitutionScoringConfig,
  type InstitutionProduct,
} from "@/src/lib/scoringConfig";
import { getInstitutionId, getInstitutionName } from "@/src/lib/auth";
import { saveScoringConfig } from "@/src/lib/api";
import { formatFCFA, scoreColor } from "@/src/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  "Pondération 4C",
  "Règles par critère",
  "Produits & Taux",
  "Conditions crédit",
  "Profil de risque",
];

const C_COLORS = {
  c1: "#10b981",
  c2: "#06b6d4",
  c3: "#f59e0b",
  c4: "#8b5cf6",
};

const DEFAULT_CROP_PRICES: Record<string, number> = {
  Cacao: 1500,
  Hévéa: 800,
  Anacarde: 600,
  Maïs: 200,
  Riz: 300,
  Manioc: 120,
};

const FILIERE_LABELS = ["CACAO", "HEVEA", "ANACARDE", "MAIS", "RIZ", "MANIOC", "AUTRE"];
const GARANTIE_TYPES = ["NANTISSEMENT", "CAUTION", "HYPOTHEQUE"];

const EXAMPLE_FARMERS = [
  { label: "Excellent", scores: { c1: 220, c2: 200, c3: 210, c4: 190 } },
  { label: "Moyen", scores: { c1: 140, c2: 120, c3: 130, c4: 110 } },
  { label: "Faible", scores: { c1: 60, c2: 55, c3: 45, c4: 50 } },
];

const API_BASE = "https://api.wakama.farm";

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--bg-input)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text-primary)",
  fontSize: 12,
  padding: "5px 10px",
  outline: "none",
  fontFamily: "var(--font-mono), monospace",
  width: "100%",
};

// ─── Helper components ────────────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl bg-bg-secondary p-5"
      style={{ border: "1px solid var(--border)" }}
    >
      {title && (
        <p
          style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase" as const,
            color: "var(--text-muted)",
            marginBottom: 16,
          }}
        >
          {title}
        </p>
      )}
      {children}
    </div>
  );
}

function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</span>
      <button
        onClick={() => onChange(!value)}
        style={{
          width: 36,
          height: 20,
          borderRadius: 10,
          border: "none",
          cursor: "pointer",
          background: value ? "#10b981" : "var(--bg-badge)",
          position: "relative",
          transition: "background 150ms",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: value ? 18 : 2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "white",
            transition: "left 150ms",
          }}
        />
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScoringConfigPage() {
  // Locale (unused in display but required by Next.js route)
  useParams();

  // ── State ──────────────────────────────────────────────────────────────────
  const [config, setConfig] = useState<InstitutionScoringConfig | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [saved, setSaved] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState("default");
  const [institutionName, setInstitutionName] = useState("");

  // Accordion open state for Tab 2
  const [openAccordion, setOpenAccordion] = useState<number>(0);

  // Product expand state for Tab 3
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = getInstitutionId() ?? "default";
    const name = getInstitutionName();
    setInstitutionId(id);
    setInstitutionName(name);
    setConfig(getActiveConfig(id));
  }, []);

  // ── Config helpers ────────────────────────────────────────────────────────

  /** Merges a partial update into config, persists locally, marks unsaved. */
  const updateConfig = useCallback(
    (partial: Partial<InstitutionScoringConfig>) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next: InstitutionScoringConfig = {
          ...prev,
          ...partial,
          updatedAt: new Date().toISOString(),
        };
        saveConfigLocally(next);
        return next;
      });
      setSaved(false);
    },
    []
  );

  /** Updates a single weight key. */
  const updateWeight = useCallback(
    (key: keyof InstitutionScoringConfig["weights"], value: number) => {
      setConfig((prev) => {
        if (!prev) return prev;
        const next: InstitutionScoringConfig = {
          ...prev,
          weights: { ...prev.weights, [key]: value },
          updatedAt: new Date().toISOString(),
        };
        saveConfigLocally(next);
        return next;
      });
      setSaved(false);
    },
    []
  );

  /** Saves to API (PATCH /v1/institutions/:id/scoring-config) with localStorage fallback. */
  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveError(null);
    try {
      await saveScoringConfig(institutionId, {
        weightC1: config.weights.c1_capacite,
        weightC2: config.weights.c2_caractere,
        weightC3: config.weights.c3_collateral,
        weightC4: config.weights.c4_conditions,
        c1Rules: config.c1Rules,
        c2Rules: config.c2Rules,
        c3Rules: config.c3Rules,
        c4Rules: config.c4Rules,
        products: config.products,
        creditConditions: config.creditConditions,
        riskProfile: config.riskProfile,
      });
      saveConfigLocally(config);
      setSaved(true);
      setToast("Configuration sauvegardée ✓");
      setTimeout(() => setToast(null), 3500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de la sauvegarde";
      setSaveError(msg);
      // localStorage already up-to-date from updateConfig — keep unsaved indicator
    } finally {
      setSaving(false);
    }
  }, [config, institutionId]);

  /** Resets config to factory defaults. */
  const handleReset = useCallback(() => {
    if (!confirm("Réinitialiser la configuration aux valeurs par défaut ?")) return;
    const fresh: InstitutionScoringConfig = {
      ...DEFAULT_CONFIG,
      weights: { ...DEFAULT_CONFIG.weights },
      products: DEFAULT_PRODUCTS.map((p) => ({ ...p })),
      c1Rules: {
        ...DEFAULT_CONFIG.c1Rules,
        prixOfficielOverride: {},
      },
      c2Rules: { ...DEFAULT_CONFIG.c2Rules },
      c3Rules: { ...DEFAULT_CONFIG.c3Rules },
      c4Rules: {
        ...DEFAULT_CONFIG.c4Rules,
        filiereBonus: { ...DEFAULT_CONFIG.c4Rules.filiereBonus },
      },
      creditConditions: {
        ...DEFAULT_CONFIG.creditConditions,
        tauxAjustement: { ...DEFAULT_CONFIG.creditConditions.tauxAjustement },
        typeGarantie: [...DEFAULT_CONFIG.creditConditions.typeGarantie],
        filieresAutorisees: [...DEFAULT_CONFIG.creditConditions.filieresAutorisees],
      },
      riskProfile: { ...DEFAULT_CONFIG.riskProfile },
      institutionId,
      updatedAt: new Date().toISOString(),
    };
    saveConfigLocally(fresh);
    setConfig(fresh);
    setSaved(true);
  }, [institutionId]);

  // ── Loading guard ─────────────────────────────────────────────────────────
  if (!config) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ minHeight: 320, color: "var(--text-muted)", fontSize: 14 }}
      >
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 24,
            marginRight: 8,
            fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            animation: "spin 1s linear infinite",
          }}
        >
          progress_activity
        </span>
        Chargement de la configuration…
      </div>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────
  const { c1_capacite, c2_caractere, c3_collateral, c4_conditions } = config.weights;
  const weightSum = c1_capacite + c2_caractere + c3_collateral + c4_conditions;
  const weightSumOk = weightSum === 100;

  const formattedDate = new Date(config.updatedAt).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 24px 60px", maxWidth: 960, margin: "0 auto" }}>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 100,
            background: "var(--bg-card)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 10,
            padding: "10px 16px",
            fontSize: 13,
            color: "#10b981",
            fontWeight: 500,
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            check_circle
          </span>
          {toast}
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: 16,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: "var(--text-primary)",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            Configuration Scoring &amp; Critères
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-muted)", margin: "4px 0 0" }}>
            {institutionName || "Institution"} &middot; Mis à jour {formattedDate}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              background: "#10b981",
              color: "white",
              fontSize: 13,
              fontWeight: 600,
              opacity: saving ? 0.7 : 1,
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
              }}
            >
              {saving ? "hourglass_empty" : "save"}
            </span>
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>

          {/* Reset button */}
          <button
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              cursor: "pointer",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              transition: "color 150ms, border-color 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#ef4444";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#ef4444";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 16,
                fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
              }}
            >
              restart_alt
            </span>
            Réinitialiser
          </button>
        </div>
      </div>

      {/* ── UNSAVED BANNER ─────────────────────────────────────────────────── */}
      {!saved && (
        <div
          style={{
            background: "rgba(234, 179, 8, 0.1)",
            border: "1px solid rgba(234, 179, 8, 0.35)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 20,
            fontSize: 12,
            color: "#ca8a04",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>⚠</span>
          <span>
            Modifications non sauvegardées — les changements sont appliqués en aperçu temps
            réel mais non permanents
          </span>
        </div>
      )}

      {/* ── Save error ────────────────────────────────────────────────────── */}
      {saveError && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            fontSize: 12,
            color: "#ef4444",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 14, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            error
          </span>
          {saveError}
        </div>
      )}

      {/* ── TABS ───────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 20,
          borderBottom: "1px solid var(--border)",
          overflowX: "auto",
        }}
      >
        {TABS.map((tab, i) => (
          <button
            key={tab}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: activeTab === i ? 600 : 400,
              color: activeTab === i ? "var(--text-accent)" : "var(--text-secondary)",
              background: "transparent",
              border: "none",
              borderBottom: activeTab === i ? "2px solid #10b981" : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginBottom: -1,
              transition: "color 150ms",
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── TAB CONTENT ─────────────────────────────────────────────────────── */}

      {/* ── TAB 1: Pondération 4C ─────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Pondération des critères 4C">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              {/* Sliders */}
              <SliderInput
                label="C1 — Capacité"
                value={c1_capacite}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c1}
                onChange={(v) => updateWeight("c1_capacite", v)}
              />
              <SliderInput
                label="C2 — Caractère"
                value={c2_caractere}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c2}
                onChange={(v) => updateWeight("c2_caractere", v)}
              />
              <SliderInput
                label="C3 — Collatéral"
                value={c3_collateral}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c3}
                onChange={(v) => updateWeight("c3_collateral", v)}
              />
              <SliderInput
                label="C4 — Conditions"
                value={c4_conditions}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c4}
                onChange={(v) => updateWeight("c4_conditions", v)}
              />

              {/* Sum indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: weightSumOk ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                  border: `1px solid ${weightSumOk ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Somme des poids
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    color: weightSumOk ? "#10b981" : "#ef4444",
                  }}
                >
                  {weightSum} %{" "}
                  {weightSumOk ? "✓" : `(doit être 100, écart: ${100 - weightSum})`}
                </span>
              </div>

              {/* Reset weights button */}
              <button
                onClick={() => {
                  updateConfig({
                    weights: {
                      c1_capacite: 30,
                      c2_caractere: 25,
                      c3_collateral: 25,
                      c4_conditions: 20,
                    },
                  });
                }}
                style={{
                  alignSelf: "flex-start",
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Réinitialiser (30/25/25/20)
              </button>

              {/* Stacked bar */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    color: "var(--text-muted)",
                    marginBottom: 6,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 500,
                  }}
                >
                  Répartition visuelle
                </p>
                <div
                  style={{
                    display: "flex",
                    height: 12,
                    borderRadius: 6,
                    overflow: "hidden",
                    gap: 1,
                  }}
                >
                  {[
                    { value: c1_capacite, color: C_COLORS.c1, label: "C1" },
                    { value: c2_caractere, color: C_COLORS.c2, label: "C2" },
                    { value: c3_collateral, color: C_COLORS.c3, label: "C3" },
                    { value: c4_conditions, color: C_COLORS.c4, label: "C4" },
                  ].map((seg) => (
                    <div
                      key={seg.label}
                      title={`${seg.label}: ${seg.value}%`}
                      style={{
                        flex: seg.value,
                        background: seg.color,
                        minWidth: seg.value > 0 ? 2 : 0,
                        transition: "flex 200ms",
                      }}
                    />
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {[
                    { label: "C1 Capacité", value: c1_capacite, color: C_COLORS.c1 },
                    { label: "C2 Caractère", value: c2_caractere, color: C_COLORS.c2 },
                    { label: "C3 Collatéral", value: c3_collateral, color: C_COLORS.c3 },
                    { label: "C4 Conditions", value: c4_conditions, color: C_COLORS.c4 },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{ display: "flex", alignItems: "center", gap: 5 }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 2,
                          background: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
                        {item.label} {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Live preview */}
          <SectionCard title="Aperçu temps réel">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {EXAMPLE_FARMERS.map((farmer) => {
                const score = applyCustomWeights(farmer.scores, config);
                const color = scoreColor(score);
                return (
                  <div
                    key={farmer.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      borderRadius: 8,
                      background: "var(--bg-card-hover)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          margin: 0,
                        }}
                      >
                        Agriculteur {farmer.label}
                      </p>
                      <p
                        style={{
                          fontSize: 11,
                          color: "var(--text-muted)",
                          margin: "2px 0 0",
                        }}
                      >
                        C1={farmer.scores.c1} · C2={farmer.scores.c2} · C3=
                        {farmer.scores.c3} · C4={farmer.scores.c4}
                      </p>
                    </div>
                    <span
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        fontFamily: "var(--font-mono), monospace",
                        color,
                        lineHeight: 1,
                      }}
                    >
                      {score}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB 2: Règles par critère ─────────────────────────────────────── */}
      {activeTab === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {/* C1 — Capacité */}
          <AccordionSection
            index={0}
            open={openAccordion === 0}
            onToggle={() => setOpenAccordion(openAccordion === 0 ? -1 : 0)}
            title="C1 — Capacité"
            color={C_COLORS.c1}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Crop price table */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Prix officiels (FCFA/kg)
                </p>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {Object.entries(DEFAULT_CROP_PRICES).map(([crop, defaultPrice], idx) => {
                    const currentPrice =
                      config.c1Rules.prixOfficielOverride[crop] ?? defaultPrice;
                    return (
                      <div
                        key={crop}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 12px",
                          borderBottom:
                            idx < Object.keys(DEFAULT_CROP_PRICES).length - 1
                              ? "1px solid var(--border)"
                              : "none",
                          background:
                            idx % 2 === 0 ? "transparent" : "var(--bg-card-hover)",
                        }}
                      >
                        <span
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: "var(--text-primary)",
                          }}
                        >
                          {crop}
                        </span>
                        <input
                          type="number"
                          value={currentPrice}
                          min={0}
                          step={10}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            updateConfig({
                              c1Rules: {
                                ...config.c1Rules,
                                prixOfficielOverride: {
                                  ...config.c1Rules.prixOfficielOverride,
                                  [crop]: val,
                                },
                              },
                            });
                          }}
                          style={{ ...inputStyle, width: 100 }}
                        />
                        <span
                          style={{
                            fontSize: 10,
                            color: "var(--text-muted)",
                            width: 56,
                          }}
                        >
                          FCFA/kg
                        </span>
                        <button
                          title="Réinitialiser"
                          onClick={() => {
                            const override = { ...config.c1Rules.prixOfficielOverride };
                            delete override[crop];
                            updateConfig({
                              c1Rules: {
                                ...config.c1Rules,
                                prixOfficielOverride: override,
                              },
                            });
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            fontSize: 14,
                            padding: "2px 4px",
                          }}
                        >
                          ↺
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Surface & rendement weights */}
              <SliderInput
                label="Poids surface"
                value={config.c1Rules.surfaceWeight}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c1}
                onChange={(v) =>
                  updateConfig({
                    c1Rules: { ...config.c1Rules, surfaceWeight: v },
                  })
                }
              />
              <SliderInput
                label="Poids rendement"
                value={config.c1Rules.rendementWeight}
                min={0}
                max={100}
                step={1}
                unit="%"
                color={C_COLORS.c1}
                onChange={(v) =>
                  updateConfig({
                    c1Rules: { ...config.c1Rules, rendementWeight: v },
                  })
                }
              />
            </div>
          </AccordionSection>

          {/* C2 — Caractère */}
          <AccordionSection
            index={1}
            open={openAccordion === 1}
            onToggle={() => setOpenAccordion(openAccordion === 1 ? -1 : 1)}
            title="C2 — Caractère"
            color={C_COLORS.c2}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SliderInput
                label="Poids ancienneté"
                value={config.c2Rules.ancienneteWeight}
                min={0}
                max={40}
                step={1}
                unit="%"
                color={C_COLORS.c2}
                onChange={(v) =>
                  updateConfig({
                    c2Rules: { ...config.c2Rules, ancienneteWeight: v },
                  })
                }
              />
              <SliderInput
                label="Poids activités"
                value={config.c2Rules.activitesWeight}
                min={0}
                max={40}
                step={1}
                unit="%"
                color={C_COLORS.c2}
                onChange={(v) =>
                  updateConfig({
                    c2Rules: { ...config.c2Rules, activitesWeight: v },
                  })
                }
              />
              <SliderInput
                label="Poids expérience"
                value={config.c2Rules.experienceWeight}
                min={0}
                max={20}
                step={1}
                unit="%"
                color={C_COLORS.c2}
                onChange={(v) =>
                  updateConfig({
                    c2Rules: { ...config.c2Rules, experienceWeight: v },
                  })
                }
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Min expérience (années)
                  </label>
                  <input
                    type="number"
                    value={config.c2Rules.minExperienceAnnees}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      updateConfig({
                        c2Rules: {
                          ...config.c2Rules,
                          minExperienceAnnees: Number(e.target.value),
                        },
                      })
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Bonus historique crédit (pts)
                  </label>
                  <input
                    type="number"
                    value={config.c2Rules.creditHistoryBonus}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      updateConfig({
                        c2Rules: {
                          ...config.c2Rules,
                          creditHistoryBonus: Number(e.target.value),
                        },
                      })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Toggle
                  value={config.c2Rules.blacklistEnabled}
                  onChange={(v) =>
                    updateConfig({
                      c2Rules: { ...config.c2Rules, blacklistEnabled: v },
                    })
                  }
                  label="Activer vérification blacklist"
                />
                {/* Note: c2Rules does not have a penaliserIncidents field in the schema.
                    We surface it as a UI-only informational toggle mapped to blacklistEnabled
                    since no separate field exists. */}
              </div>
            </div>
          </AccordionSection>

          {/* C3 — Collatéral */}
          <AccordionSection
            index={2}
            open={openAccordion === 2}
            onToggle={() => setOpenAccordion(openAccordion === 2 ? -1 : 2)}
            title="C3 — Collatéral"
            color={C_COLORS.c3}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(
                [
                  {
                    key: "requirePhoto" as const,
                    ptsKey: "pointsPhoto" as const,
                    label: "Photo",
                  },
                  {
                    key: "requireCNI" as const,
                    ptsKey: "pointsCNI" as const,
                    label: "CNI",
                  },
                  {
                    key: "requireAttestation" as const,
                    ptsKey: "pointsAttestation" as const,
                    label: "Attestation",
                  },
                  {
                    key: "requireGPS" as const,
                    ptsKey: "pointsGPS" as const,
                    label: "GPS",
                  },
                  {
                    key: "requireCoop" as const,
                    ptsKey: "pointsCoop" as const,
                    label: "Coopérative",
                  },
                  {
                    key: "requirePolygone" as const,
                    ptsKey: "pointsPolygone" as const,
                    label: "Polygone",
                  },
                ] as {
                  key: keyof Pick<
                    InstitutionScoringConfig["c3Rules"],
                    | "requirePhoto"
                    | "requireCNI"
                    | "requireAttestation"
                    | "requireGPS"
                    | "requireCoop"
                    | "requirePolygone"
                  >;
                  ptsKey: keyof Pick<
                    InstitutionScoringConfig["c3Rules"],
                    | "pointsPhoto"
                    | "pointsCNI"
                    | "pointsAttestation"
                    | "pointsGPS"
                    | "pointsCoop"
                    | "pointsPolygone"
                  >;
                  label: string;
                }[]
              ).map(({ key, ptsKey, label }) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <Toggle
                      value={config.c3Rules[key] as boolean}
                      onChange={(v) =>
                        updateConfig({
                          c3Rules: { ...config.c3Rules, [key]: v },
                        })
                      }
                      label={label}
                    />
                  </div>
                  {config.c3Rules[key] && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        type="number"
                        value={config.c3Rules[ptsKey] as number}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          updateConfig({
                            c3Rules: {
                              ...config.c3Rules,
                              [ptsKey]: Number(e.target.value),
                            },
                          })
                        }
                        style={{ ...inputStyle, width: 70 }}
                      />
                      <span
                        style={{ fontSize: 10, color: "var(--text-muted)", flexShrink: 0 }}
                      >
                        pts
                      </span>
                    </div>
                  )}
                </div>
              ))}

              {/* Total possible points */}
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  Total pts possibles (actifs)
                </span>
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    fontFamily: "var(--font-mono), monospace",
                    color: C_COLORS.c3,
                  }}
                >
                  {[
                    config.c3Rules.requirePhoto ? config.c3Rules.pointsPhoto : 0,
                    config.c3Rules.requireCNI ? config.c3Rules.pointsCNI : 0,
                    config.c3Rules.requireAttestation ? config.c3Rules.pointsAttestation : 0,
                    config.c3Rules.requireGPS ? config.c3Rules.pointsGPS : 0,
                    config.c3Rules.requireCoop ? config.c3Rules.pointsCoop : 0,
                    config.c3Rules.requirePolygone ? config.c3Rules.pointsPolygone : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  pts
                </span>
              </div>
            </div>
          </AccordionSection>

          {/* C4 — Conditions */}
          <AccordionSection
            index={3}
            open={openAccordion === 3}
            onToggle={() => setOpenAccordion(openAccordion === 3 ? -1 : 3)}
            title="C4 — Conditions"
            color={C_COLORS.c4}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <SliderInput
                label="NDVI minimum"
                value={config.c4Rules.ndviMinimum}
                min={0}
                max={1}
                step={0.05}
                color={C_COLORS.c4}
                onChange={(v) =>
                  updateConfig({
                    c4Rules: { ...config.c4Rules, ndviMinimum: v },
                  })
                }
              />
              <SliderInput
                label="Poids NDVI"
                value={config.c4Rules.ndviWeight}
                min={0}
                max={50}
                step={1}
                unit="%"
                color={C_COLORS.c4}
                onChange={(v) =>
                  updateConfig({
                    c4Rules: { ...config.c4Rules, ndviWeight: v },
                  })
                }
              />

              {/* Filière bonus table */}
              <div>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  Bonus par filière (pts)
                </p>
                <div
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    overflow: "hidden",
                  }}
                >
                  {["Cacao", "Hévéa", "Anacarde", "Maïs", "Riz"].map((crop, idx) => (
                    <div
                      key={crop}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "8px 12px",
                        borderBottom: idx < 4 ? "1px solid var(--border)" : "none",
                        background:
                          idx % 2 === 0 ? "transparent" : "var(--bg-card-hover)",
                      }}
                    >
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>
                        {crop}
                      </span>
                      <input
                        type="number"
                        value={config.c4Rules.filiereBonus[crop] ?? 0}
                        min={0}
                        step={1}
                        onChange={(e) =>
                          updateConfig({
                            c4Rules: {
                              ...config.c4Rules,
                              filiereBonus: {
                                ...config.c4Rules.filiereBonus,
                                [crop]: Number(e.target.value),
                              },
                            },
                          })
                        }
                        style={{ ...inputStyle, width: 80 }}
                      />
                      <span style={{ fontSize: 10, color: "var(--text-muted)", width: 24 }}>
                        pts
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Bonus coop certifiée
                  </label>
                  <input
                    type="number"
                    value={config.c4Rules.coopCertifieeBonus}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      updateConfig({
                        c4Rules: {
                          ...config.c4Rules,
                          coopCertifieeBonus: Number(e.target.value),
                        },
                      })
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Malus par alerte
                  </label>
                  <input
                    type="number"
                    value={config.c4Rules.alerteMalus}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      updateConfig({
                        c4Rules: {
                          ...config.c4Rules,
                          alerteMalus: Number(e.target.value),
                        },
                      })
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "var(--text-secondary)",
                      display: "block",
                      marginBottom: 4,
                    }}
                  >
                    Plafond malus alertes
                  </label>
                  <input
                    type="number"
                    value={config.c4Rules.maxAlertesMalus}
                    min={0}
                    step={1}
                    onChange={(e) =>
                      updateConfig({
                        c4Rules: {
                          ...config.c4Rules,
                          maxAlertesMalus: Number(e.target.value),
                        },
                      })
                    }
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </AccordionSection>
        </div>
      )}

      {/* ── TAB 3: Produits & Taux ────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {config.products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              expanded={expandedProduct === product.id}
              canDelete={config.products.length > 1}
              onToggleExpand={() =>
                setExpandedProduct(expandedProduct === product.id ? null : product.id)
              }
              onUpdate={(updated) => {
                updateConfig({
                  products: config.products.map((p) =>
                    p.id === product.id ? updated : p
                  ),
                });
              }}
              onDelete={() => {
                updateConfig({
                  products: config.products.filter((p) => p.id !== product.id),
                });
              }}
            />
          ))}

          {/* Add product */}
          <button
            onClick={() => {
              const newProduct: InstitutionProduct = {
                id: `PROD_${Date.now()}`,
                name: "Nouveau produit",
                active: true,
                minScore: 300,
                minMontant: 50_000,
                maxMontant: 1_000_000,
                minDureeMois: 3,
                maxDureeMois: 24,
                tauxMensuel: 2.0,
                description: "",
              };
              updateConfig({ products: [...config.products, newProduct] });
              setExpandedProduct(newProduct.id);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px",
              borderRadius: 10,
              border: "1px dashed var(--border)",
              background: "transparent",
              color: "var(--text-secondary)",
              fontSize: 13,
              cursor: "pointer",
              transition: "color 150ms, border-color 150ms",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "#10b981";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            }}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontSize: 18,
                fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
              }}
            >
              add_circle
            </span>
            + Ajouter un produit
          </button>
        </div>
      )}

      {/* ── TAB 4: Conditions crédit ──────────────────────────────────────── */}
      {activeTab === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Paramètres généraux">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 16,
              }}
            >
              <div>
                <label style={labelStyle}>Score minimum pour postuler</label>
                <input
                  type="number"
                  value={config.creditConditions.minScore}
                  min={0}
                  step={10}
                  onChange={(e) =>
                    updateConfig({
                      creditConditions: {
                        ...config.creditConditions,
                        minScore: Number(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Taux de base (%/mois)</label>
                <input
                  type="number"
                  value={config.creditConditions.tauxBase}
                  min={0}
                  step={0.05}
                  onChange={(e) =>
                    updateConfig({
                      creditConditions: {
                        ...config.creditConditions,
                        tauxBase: Number(e.target.value),
                      },
                    })
                  }
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
              <RangeConfig
                label="Montant crédit (FCFA)"
                minValue={config.creditConditions.minMontant}
                maxValue={config.creditConditions.maxMontant}
                min={0}
                step={10_000}
                onChangeMin={(v) =>
                  updateConfig({
                    creditConditions: { ...config.creditConditions, minMontant: v },
                  })
                }
                onChangeMax={(v) =>
                  updateConfig({
                    creditConditions: { ...config.creditConditions, maxMontant: v },
                  })
                }
              />
              <RangeConfig
                label="Durée (mois)"
                minValue={config.creditConditions.minDureeMois}
                maxValue={config.creditConditions.maxDureeMois}
                min={1}
                max={60}
                step={1}
                unit="mois"
                onChangeMin={(v) =>
                  updateConfig({
                    creditConditions: { ...config.creditConditions, minDureeMois: v },
                  })
                }
                onChangeMax={(v) =>
                  updateConfig({
                    creditConditions: { ...config.creditConditions, maxDureeMois: v },
                  })
                }
              />
            </div>
          </SectionCard>

          {/* Rate adjustment table */}
          <SectionCard title="Ajustement de taux par tranche de score">
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                overflow: "hidden",
              }}
            >
              {(
                [
                  {
                    label: "300 – 499",
                    key: "score_300_499" as const,
                  },
                  {
                    label: "500 – 699",
                    key: "score_500_699" as const,
                  },
                  {
                    label: "≥ 700",
                    key: "score_700_plus" as const,
                  },
                ] as {
                  label: string;
                  key: keyof InstitutionScoringConfig["creditConditions"]["tauxAjustement"];
                }[]
              ).map(({ label, key }, idx) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    padding: "10px 14px",
                    borderBottom: idx < 2 ? "1px solid var(--border)" : "none",
                    background: idx % 2 === 0 ? "transparent" : "var(--bg-card-hover)",
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: 13,
                      fontFamily: "var(--font-mono), monospace",
                      color: "var(--text-primary)",
                    }}
                  >
                    {label}
                  </span>
                  <input
                    type="number"
                    value={config.creditConditions.tauxAjustement[key]}
                    min={-5}
                    max={5}
                    step={0.05}
                    onChange={(e) =>
                      updateConfig({
                        creditConditions: {
                          ...config.creditConditions,
                          tauxAjustement: {
                            ...config.creditConditions.tauxAjustement,
                            [key]: Number(e.target.value),
                          },
                        },
                      })
                    }
                    style={{ ...inputStyle, width: 90 }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>
                    %/mois
                  </span>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Garantie & assurance */}
          <SectionCard title="Garanties & assurance">
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Garantie requise */}
              <div>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: 13,
                    color: "var(--text-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.creditConditions.garantieRequise}
                    onChange={(e) =>
                      updateConfig({
                        creditConditions: {
                          ...config.creditConditions,
                          garantieRequise: e.target.checked,
                        },
                      })
                    }
                    style={{ accentColor: "#10b981", width: 14, height: 14 }}
                  />
                  Garantie requise
                </label>

                {config.creditConditions.garantieRequise && (
                  <div
                    style={{
                      marginTop: 10,
                      marginLeft: 22,
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {GARANTIE_TYPES.map((type) => {
                      const selected = config.creditConditions.typeGarantie.includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const cur = config.creditConditions.typeGarantie;
                            const next = selected
                              ? cur.filter((t) => t !== type)
                              : [...cur, type];
                            updateConfig({
                              creditConditions: {
                                ...config.creditConditions,
                                typeGarantie: next,
                              },
                            });
                          }}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: `1px solid ${selected ? "#10b981" : "var(--border)"}`,
                            background: selected ? "rgba(16,185,129,0.12)" : "transparent",
                            color: selected ? "#10b981" : "var(--text-secondary)",
                            fontSize: 11,
                            cursor: "pointer",
                            fontWeight: selected ? 600 : 400,
                          }}
                        >
                          {type}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Assurance récolte */}
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={config.creditConditions.assuranceRequise}
                  onChange={(e) =>
                    updateConfig({
                      creditConditions: {
                        ...config.creditConditions,
                        assuranceRequise: e.target.checked,
                      },
                    })
                  }
                  style={{ accentColor: "#10b981", width: 14, height: 14 }}
                />
                Assurance récolte requise
              </label>
            </div>
          </SectionCard>

          {/* Filières autorisées */}
          <SectionCard title="Filières autorisées">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* "Toutes" chip */}
              <button
                onClick={() => {
                  const allSelected =
                    config.creditConditions.filieresAutorisees.length ===
                    FILIERE_LABELS.length;
                  updateConfig({
                    creditConditions: {
                      ...config.creditConditions,
                      filieresAutorisees: allSelected ? [] : [...FILIERE_LABELS],
                    },
                  });
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 20,
                  border: `1px solid ${
                    config.creditConditions.filieresAutorisees.length === FILIERE_LABELS.length
                      ? "#10b981"
                      : "var(--border)"
                  }`,
                  background:
                    config.creditConditions.filieresAutorisees.length === FILIERE_LABELS.length
                      ? "rgba(16,185,129,0.12)"
                      : "transparent",
                  color:
                    config.creditConditions.filieresAutorisees.length === FILIERE_LABELS.length
                      ? "#10b981"
                      : "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Toutes
              </button>

              {FILIERE_LABELS.map((filiere) => {
                const selected =
                  config.creditConditions.filieresAutorisees.includes(filiere);
                return (
                  <button
                    key={filiere}
                    onClick={() => {
                      const cur = config.creditConditions.filieresAutorisees;
                      const next = selected
                        ? cur.filter((f) => f !== filiere)
                        : [...cur, filiere];
                      updateConfig({
                        creditConditions: {
                          ...config.creditConditions,
                          filieresAutorisees: next,
                        },
                      });
                    }}
                    style={{
                      padding: "5px 12px",
                      borderRadius: 20,
                      border: `1px solid ${selected ? "#10b981" : "var(--border)"}`,
                      background: selected ? "rgba(16,185,129,0.12)" : "transparent",
                      color: selected ? "#10b981" : "var(--text-secondary)",
                      fontSize: 12,
                      cursor: "pointer",
                      fontWeight: selected ? 600 : 400,
                    }}
                  >
                    {filiere}
                  </button>
                );
              })}
            </div>
          </SectionCard>
        </div>
      )}

      {/* ── TAB 5: Profil de risque ────────────────────────────────────────── */}
      {activeTab === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <SectionCard title="Paramètres d'exposition">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <SliderInput
                label="Exposition max une coopérative (% portefeuille)"
                value={config.riskProfile.maxExposureCoop}
                min={0}
                max={50}
                step={1}
                unit="%"
                color="#f59e0b"
                onChange={(v) =>
                  updateConfig({
                    riskProfile: { ...config.riskProfile, maxExposureCoop: v },
                  })
                }
              />
              <SliderInput
                label="Exposition max un agriculteur (% portefeuille)"
                value={config.riskProfile.maxExposureFarmer}
                min={0}
                max={20}
                step={1}
                unit="%"
                color="#f97316"
                onChange={(v) =>
                  updateConfig({
                    riskProfile: { ...config.riskProfile, maxExposureFarmer: v },
                  })
                }
              />
              <SliderInput
                label="Seuil alerte concentration (%)"
                value={config.riskProfile.concentrationAlert}
                min={0}
                max={50}
                step={1}
                unit="%"
                color="#ef4444"
                onChange={(v) =>
                  updateConfig({
                    riskProfile: { ...config.riskProfile, concentrationAlert: v },
                  })
                }
              />
              <SliderInput
                label="Diversification minimum (nb cultures)"
                value={config.riskProfile.diversificationMin}
                min={1}
                max={10}
                step={1}
                color="#8b5cf6"
                onChange={(v) =>
                  updateConfig({
                    riskProfile: { ...config.riskProfile, diversificationMin: v },
                  })
                }
              />
            </div>
          </SectionCard>

          {/* Risk gauge */}
          <SectionCard title="Niveau de risque global">
            <RiskGauge
              maxExposureCoop={config.riskProfile.maxExposureCoop}
              maxExposureFarmer={config.riskProfile.maxExposureFarmer}
            />
          </SectionCard>
        </div>
      )}
    </div>
  );
}

// ─── Label style constant (used in tab 4) ─────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--text-secondary)",
  display: "block",
  marginBottom: 4,
};

// ─── AccordionSection ─────────────────────────────────────────────────────────

function AccordionSection({
  index,
  open,
  onToggle,
  title,
  color,
  children,
}: {
  index: number;
  open: boolean;
  onToggle: () => void;
  title: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 4,
              height: 20,
              borderRadius: 2,
              background: color,
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            {title}
          </span>
          <span
            style={{
              fontSize: 10,
              background: `${color}22`,
              color,
              padding: "2px 6px",
              borderRadius: 4,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            C{index + 1}
          </span>
        </div>
        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: "var(--text-muted)",
            fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
            flexShrink: 0,
          }}
        >
          expand_more
        </span>
      </button>

      {/* Content */}
      {open && (
        <div
          style={{
            padding: "0 16px 16px",
            borderTop: "1px solid var(--border)",
            paddingTop: 16,
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  expanded,
  canDelete,
  onToggleExpand,
  onUpdate,
  onDelete,
}: {
  product: InstitutionProduct;
  expanded: boolean;
  canDelete: boolean;
  onToggleExpand: () => void;
  onUpdate: (updated: InstitutionProduct) => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        borderRadius: 10,
        border: "1px solid var(--border)",
        overflow: "hidden",
        background: "var(--bg-card)",
      }}
    >
      {/* Card header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "12px 16px",
          gap: 10,
          cursor: "pointer",
        }}
        onClick={onToggleExpand}
      >
        {/* Active badge */}
        <span
          style={{
            fontSize: 10,
            padding: "2px 7px",
            borderRadius: 4,
            fontWeight: 600,
            background: product.active ? "rgba(16,185,129,0.12)" : "var(--bg-badge)",
            color: product.active ? "#10b981" : "var(--text-muted)",
            border: `1px solid ${product.active ? "rgba(16,185,129,0.3)" : "var(--border)"}`,
            flexShrink: 0,
          }}
        >
          {product.active ? "Actif" : "Inactif"}
        </span>

        <span
          style={{
            flex: 1,
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {product.name}
        </span>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          Score {product.minScore}+
        </span>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {formatFCFA(product.minMontant)} – {formatFCFA(product.maxMontant)}
        </span>

        <span
          style={{
            fontSize: 11,
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono), monospace",
          }}
        >
          {product.tauxMensuel}%/mois
        </span>

        <span
          className="material-symbols-outlined"
          style={{
            fontSize: 18,
            color: "var(--text-muted)",
            fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 200ms",
            flexShrink: 0,
          }}
        >
          expand_more
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            padding: "16px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {/* Active toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              Produit actif
            </span>
            <button
              onClick={() => onUpdate({ ...product, active: !product.active })}
              style={{
                width: 36,
                height: 20,
                borderRadius: 10,
                border: "none",
                cursor: "pointer",
                background: product.active ? "#10b981" : "var(--bg-badge)",
                position: "relative",
                transition: "background 150ms",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  left: product.active ? 18 : 2,
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 150ms",
                }}
              />
            </button>
          </div>

          {/* Name */}
          <div>
            <label style={labelStyle}>Nom du produit</label>
            <input
              type="text"
              value={product.name}
              onChange={(e) => onUpdate({ ...product, name: e.target.value })}
              style={inputStyle}
            />
          </div>

          {/* Score min/max sliders */}
          <SliderInput
            label="Score minimum d'éligibilité"
            value={product.minScore}
            min={0}
            max={product.maxScore ?? 1000}
            step={10}
            color="#10b981"
            onChange={(v) => onUpdate({ ...product, minScore: v })}
          />
          <SliderInput
            label="Score maximum d'éligibilité"
            value={product.maxScore ?? 1000}
            min={product.minScore}
            max={1000}
            step={10}
            color="#06b6d4"
            onChange={(v) => onUpdate({ ...product, maxScore: v })}
          />

          {/* Montant range */}
          <RangeConfig
            label="Montant (FCFA)"
            minValue={product.minMontant}
            maxValue={product.maxMontant}
            min={0}
            step={10_000}
            onChangeMin={(v) => onUpdate({ ...product, minMontant: v })}
            onChangeMax={(v) => onUpdate({ ...product, maxMontant: v })}
          />

          {/* Durée range */}
          <RangeConfig
            label="Durée (mois)"
            minValue={product.minDureeMois}
            maxValue={product.maxDureeMois}
            min={1}
            max={60}
            step={1}
            unit="mois"
            onChangeMin={(v) => onUpdate({ ...product, minDureeMois: v })}
            onChangeMax={(v) => onUpdate({ ...product, maxDureeMois: v })}
          />

          {/* Taux mensuel */}
          <div>
            <label style={labelStyle}>Taux mensuel (%)</label>
            <input
              type="number"
              value={product.tauxMensuel}
              min={0}
              step={0.05}
              onChange={(e) =>
                onUpdate({ ...product, tauxMensuel: Number(e.target.value) })
              }
              style={{ ...inputStyle, maxWidth: 140 }}
            />
          </div>

          {/* Description */}
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              value={product.description}
              onChange={(e) => onUpdate({ ...product, description: e.target.value })}
              rows={2}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.5,
              }}
            />
          </div>

          {/* Delete */}
          {canDelete && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => {
                  if (confirm(`Supprimer le produit "${product.name}" ?`)) {
                    onDelete();
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.06)",
                  color: "#ef4444",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                <span
                  className="material-symbols-outlined"
                  style={{
                    fontSize: 14,
                    fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
                  }}
                >
                  delete
                </span>
                Supprimer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── RiskGauge ────────────────────────────────────────────────────────────────

function RiskGauge({
  maxExposureCoop,
  maxExposureFarmer,
}: {
  maxExposureCoop: number;
  maxExposureFarmer: number;
}) {
  const level: "Conservateur" | "Modéré" | "Agressif" =
    maxExposureCoop <= 20 && maxExposureFarmer <= 7
      ? "Conservateur"
      : maxExposureCoop >= 35 || maxExposureFarmer >= 14
      ? "Agressif"
      : "Modéré";

  const levels: {
    label: "Conservateur" | "Modéré" | "Agressif";
    color: string;
    description: string;
  }[] = [
    {
      label: "Conservateur",
      color: "#10b981",
      description: "Coop ≤ 20% · Farmer ≤ 7%",
    },
    {
      label: "Modéré",
      color: "#f59e0b",
      description: "Coop 21–34% · Farmer 8–13%",
    },
    {
      label: "Agressif",
      color: "#ef4444",
      description: "Coop ≥ 35% ou Farmer ≥ 14%",
    },
  ];

  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
      {levels.map(({ label, color, description }) => {
        const active = level === label;
        return (
          <div
            key={label}
            style={{
              flex: 1,
              minWidth: 160,
              padding: "14px 16px",
              borderRadius: 10,
              border: `1px solid ${active ? color : "var(--border)"}`,
              background: active ? `${color}18` : "transparent",
              transition: "border-color 200ms, background 200ms",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                  boxShadow: active ? `0 0 8px ${color}` : "none",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                  color: active ? color : "var(--text-muted)",
                }}
              >
                {label}
              </span>
              {active && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color,
                    background: `${color}22`,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  Actuel
                </span>
              )}
            </div>
            <p
              style={{
                fontSize: 11,
                color: active ? "var(--text-secondary)" : "var(--text-muted)",
                margin: 0,
              }}
            >
              {description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
