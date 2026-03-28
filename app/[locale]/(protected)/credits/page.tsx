"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import KPICard from "@/src/components/ui/KPICard";
import { getInstitutionId, getInstitutionName } from "@/src/lib/auth";
import {
  getActiveConfig,
  type InstitutionScoringConfig,
} from "@/src/lib/scoringConfig";
import {
  creditRequests as creditRequestsApi,
  farmers as farmersApi,
  scores as scoresApi,
} from "@/src/lib/api";
import {
  exportCSV,
  formatFCFA,
  formatScore,
  initials,
  relativeTime,
  scoreColor,
} from "@/src/lib/utils";
import type {
  CreditRequest,
  CreditStatus,
  Farmer,
  WakamaScoreResult,
} from "@/src/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTS_MFI = [
  { label: "REMUCI",                 taux: 1.25  },
  { label: "Baobab Agri Production", taux: 1.60  },
  { label: "Baobab Agri Campagne",   taux: 1.25  },
  { label: "NSIA Pack Paysan",       taux: 0.583 },
  { label: "Autre",                  taux: 1.60  },
];

const TABS = [
  { key: "PENDING",  label: "En attente"  },
  { key: "APPROVED", label: "Approuvées"  },
  { key: "REJECTED", label: "Rejetées"    },
  { key: "ALL",      label: "Toutes"      },
] as const;
type Tab = typeof TABS[number]["key"];

const SORT_OPTIONS = [
  { value: "recent",       label: "Plus récent"  },
  { value: "ancien",       label: "Plus ancien"  },
  { value: "montant_asc",  label: "Montant ↑"    },
  { value: "montant_desc", label: "Montant ↓"    },
  { value: "score_asc",    label: "Score ↑"      },
  { value: "score_desc",   label: "Score ↓"      },
];

const SCORE_MIN_OPTIONS = [
  { value: 0,   label: "Tous"  },
  { value: 300, label: "≥300"  },
  { value: 400, label: "≥400"  },
  { value: 600, label: "≥600"  },
  { value: 700, label: "≥700"  },
];

const STATUS_STYLE: Record<CreditStatus, { label: string; classes: string }> = {
  PENDING:   { label: "En attente", classes: "bg-amber-500/10 text-amber-400 border border-amber-800"     },
  REVIEWING: { label: "En cours",   classes: "bg-blue-500/10 text-blue-400 border border-blue-800"        },
  APPROVED:  { label: "Approuvé",   classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-800" },
  REJECTED:  { label: "Rejeté",     classes: "bg-red-500/10 text-red-400 border border-red-800"           },
};

const MOTIFS = [
  "Score insuffisant (score < 300)",
  "Documents KYC incomplets",
  "Capacité remboursement insuffisante",
  "Activité agricole insuffisante",
  "Zone géographique non couverte",
  "Autre",
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-bg-tertiary ${className}`} />;
}

function toArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj?.data)) return obj.data as T[];
  return [];
}

function farmerDisplayName(farmer?: Farmer): string {
  if (!farmer) return "Farmer inconnu";
  const first = farmer.firstName ?? farmer.prenom ?? "";
  const last  = farmer.lastName  ?? farmer.nom   ?? "";
  return `${first} ${last}`.trim() || farmer.id.slice(0, 8);
}

function eligibilityLabel(score?: number): { label: string; color: string } | null {
  if (score == null) return null;
  if (score >= 700) return { label: "NSIA",         color: "#10b981" };
  if (score >= 600) return { label: "Baobab Camp",  color: "#10b981" };
  if (score >= 400) return { label: "Baobab Prod",  color: "#f59e0b" };
  if (score >= 300) return { label: "REMUCI",       color: "#f59e0b" };
  return               { label: "Non éligible",  color: "#ef4444" };
}

// ─── ApprovalModal ────────────────────────────────────────────────────────────

interface ApprovalModalProps {
  credit: CreditRequest;
  farmer?: Farmer;
  scoreData?: WakamaScoreResult;
  scoringConfig?: InstitutionScoringConfig | null;
  onClose: () => void;
  onConfirm: (montantAccorde: number, tauxApplique: number, produit: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

function ApprovalModal({ credit, farmer, scoreData, scoringConfig, onClose, onConfirm, isSubmitting = false, submitError }: ApprovalModalProps) {
  // Use institution's config products if available, fallback to hardcoded
  const effectiveProducts = scoringConfig?.products.filter((p) => p.active).map((p) => ({
    label: p.name,
    taux: p.tauxMensuel,
    maxMontant: p.maxMontant,
    minMontant: p.minMontant,
    maxDuree: p.maxDureeMois,
  })) ?? PRODUCTS_MFI.map((p) => ({ ...p, maxMontant: 10_000_000, minMontant: 50_000, maxDuree: 36 }));

  const defaultProduit = effectiveProducts[0]?.label ?? "Baobab Agri Production";
  const defaultTaux = scoringConfig?.creditConditions.tauxBase ?? effectiveProducts[0]?.taux ?? 1.60;

  const [montant,    setMontant]    = useState(credit.montant);
  const [taux,       setTaux]       = useState(defaultTaux);
  const [duree,      setDuree]      = useState(credit.duree);
  const [produit,    setProduit]    = useState(defaultProduit);
  const [conditions, setConditions] = useState("");

  // Live cost preview
  const interets   = montant * (taux / 100) * duree;
  const coutTotal  = montant + interets;
  const mensualite = duree > 0 ? Math.round(coutTotal / duree) : 0;

  function handleProduitChange(p: string) {
    setProduit(p);
    const found = effectiveProducts.find((pr) => pr.label === p);
    if (found) setTaux(found.taux);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg rounded-2xl bg-bg-secondary border border-gray-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-emerald-400"
            style={{ fontSize: 20, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            check_circle
          </span>
          Approuver le crédit
        </h2>
        {farmer && (
          <p className="text-sm text-text-secondary mb-4">
            {farmerDisplayName(farmer)}
            {scoreData && (
              <span
                className="ml-2 font-mono font-semibold"
                style={{ color: scoreColor(scoreData.score) }}
              >
                · Score {scoreData.score}
              </span>
            )}
            <span className="ml-2 text-text-muted">· Demande : {formatFCFA(credit.montant)}</span>
          </p>
        )}

        <div className="bg-bg-tertiary rounded-lg p-3 mb-4">
          <p className="text-xs text-text-muted mb-1">Message du farmer</p>
          <p className="text-sm text-text-secondary italic">
            {credit.message ?? "Aucun message"}
          </p>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-text-secondary mb-1.5 block">Montant accordé (FCFA)</span>
              <input
                type="number"
                value={montant}
                onChange={(e) => setMontant(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary mb-1.5 block">Durée (mois)</span>
              <input
                type="number"
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-text-secondary mb-1.5 block">Produit MFI</span>
              <select
                value={produit}
                onChange={(e) => handleProduitChange(e.target.value)}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
              >
                {effectiveProducts.map((p) => (
                  <option key={p.label}>{p.label} — {p.taux}%/mois</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary mb-1.5 block">Taux mensuel (%)</span>
              <input
                type="number"
                value={taux}
                step={0.05}
                onChange={(e) => setTaux(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-text-secondary mb-1.5 block">Conditions particulières (optionnel)</span>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={2}
              placeholder="Conditions spécifiques…"
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent resize-none"
            />
          </label>

          {/* Live cost preview */}
          <div className="rounded-lg bg-bg-tertiary border border-gray-800 p-3 space-y-1.5">
            <p className="text-xs text-text-muted font-medium mb-2">Aperçu du coût</p>
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Intérêts totaux</span>
              <span className="font-mono text-text-primary">{formatFCFA(Math.round(interets))}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-text-secondary">Coût total</span>
              <span className="font-mono font-semibold text-text-primary">{formatFCFA(Math.round(coutTotal))}</span>
            </div>
            <div className="flex justify-between text-xs border-t border-gray-700 pt-1.5 mt-1.5">
              <span className="text-text-secondary">Mensualité</span>
              <span className="font-mono font-bold text-accent">{formatFCFA(mensualite)}</span>
            </div>
          </div>
        </div>

        {submitError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}>error</span>
            {submitError}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-700 bg-bg-tertiary px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(montant, taux, produit)}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                Envoi…
              </>
            ) : (
              "Confirmer approbation"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RejectionModal ───────────────────────────────────────────────────────────

interface RejectionModalProps {
  credit: CreditRequest;
  farmer?: Farmer;
  scoreData?: WakamaScoreResult;
  onClose: () => void;
  onConfirm: (motif: string, note: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

function RejectionModal({ credit, farmer, scoreData, onClose, onConfirm, isSubmitting = false, submitError }: RejectionModalProps) {
  const [motif, setMotif] = useState(MOTIFS[0]);
  const [note,  setNote]  = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-bg-secondary border border-gray-700 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-bold text-text-primary mb-1 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-red-400"
            style={{ fontSize: 20, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            cancel
          </span>
          Rejeter la demande
        </h2>
        {farmer && (
          <p className="text-sm text-text-secondary mb-4">
            {farmerDisplayName(farmer)}
            {scoreData && (
              <span
                className="ml-2 font-mono font-semibold"
                style={{ color: scoreColor(scoreData.score) }}
              >
                · Score {scoreData.score}
              </span>
            )}
            <span className="ml-2 text-text-muted">· {formatFCFA(credit.montant)}</span>
          </p>
        )}

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-text-secondary mb-1.5 block">Motif (requis)</span>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              {MOTIFS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-text-secondary mb-1.5 block">Note interne</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Observations internes…"
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent resize-none"
            />
          </label>
        </div>

        {submitError && (
          <div className="mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444" }}>
            <span className="material-symbols-outlined shrink-0" style={{ fontSize: 13, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}>error</span>
            {submitError}
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-700 bg-bg-tertiary px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(motif, note)}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="material-symbols-outlined animate-spin" style={{ fontSize: 14 }}>progress_activity</span>
                Envoi…
              </>
            ) : (
              "Confirmer le rejet"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreditsPage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "fr";

  const [loading,        setLoading]        = useState(true);
  const [credits,        setCredits]        = useState<CreditRequest[]>([]);
  const [institutionId,  setInstitutionId]  = useState<string | null>(null);
  const [institutionName, setInstitutionName] = useState("");

  const [scoringConfig, setScoringConfig] = useState<InstitutionScoringConfig | null>(null);

  useEffect(() => {
    const id = getInstitutionId();
    setInstitutionId(id);
    setInstitutionName(getInstitutionName());
    setScoringConfig(getActiveConfig(id));
  }, []);
  const [farmerMap,      setFarmerMap]      = useState<Record<string, Farmer>>({});
  const [scoreMap,       setScoreMap]       = useState<Record<string, WakamaScoreResult>>({});
  const [activeTab,      setActiveTab]      = useState<Tab>("PENDING");
  const [search,         setSearch]         = useState("");
  const [scoreMin,       setScoreMin]       = useState(0);
  const [montantMin,     setMontantMin]     = useState("");
  const [montantMax,     setMontantMax]     = useState("");
  const [sortBy,         setSortBy]         = useState("recent");
  const [showApproval,   setShowApproval]   = useState(false);
  const [showRejection,  setShowRejection]  = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditRequest | null>(null);
  const [toast,          setToast]          = useState<string | null>(null);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [modalError,     setModalError]     = useState<string | null>(null);

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  // ── Fetch ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const [creditsRes, farmersRes] = await Promise.allSettled([
          creditRequestsApi.list(),
          farmersApi.list({ limit: 100 }),
        ]);

        const allCredits: CreditRequest[] =
          creditsRes.status === "fulfilled"
            ? toArray<CreditRequest>(creditsRes.value)
            : [];

        const allFarmers: Farmer[] =
          farmersRes.status === "fulfilled"
            ? farmersRes.value.data ?? []
            : [];

        const fMap: Record<string, Farmer> = {};
        allFarmers.forEach((f) => { fMap[f.id] = f; });

        // Fetch scores only for PENDING farmers
        const pendingIds = [
          ...new Set(
            allCredits
              .filter((c) => c.statut === "PENDING")
              .map((c) => c.farmerId)
          ),
        ];
        const scoreResults = await Promise.allSettled(
          pendingIds.map((id) => scoresApi.getFarmer(id))
        );
        const sMap: Record<string, WakamaScoreResult> = {};
        scoreResults.forEach((r, i) => {
          if (r.status === "fulfilled" && r.value) {
            sMap[pendingIds[i]] = r.value;
          }
        });

        setCredits(allCredits);
        setFarmerMap(fMap);
        setScoreMap(sMap);
      } catch { /* silent */ }
      setLoading(false);
    }
    load();
  }, []);

  // ── Derived ──────────────────────────────────────────────────────────────────

  // Filter by institution — only when the API provides institutionId on credits
  const visibleCredits = useMemo(() => {
    if (!institutionId) return credits;
    const hasSomeId = credits.some((c) => c.institutionId);
    if (!hasSomeId) return credits; // API doesn't send institutionId yet
    return credits.filter((c) => !c.institutionId || c.institutionId === institutionId);
  }, [credits, institutionId]);

  const kpis = useMemo(() => ({
    pending:       visibleCredits.filter((c) => c.statut === "PENDING"),
    approved:      visibleCredits.filter((c) => c.statut === "APPROVED"),
    rejected:      visibleCredits.filter((c) => c.statut === "REJECTED"),
    pendingAmount: visibleCredits
      .filter((c) => c.statut === "PENDING")
      .reduce((s, c) => s + c.montant, 0),
  }), [visibleCredits]);

  const tabCounts = useMemo(
    () => ({
      PENDING:  kpis.pending.length,
      APPROVED: kpis.approved.length,
      REJECTED: kpis.rejected.length,
      ALL:      visibleCredits.length,
    }),
    [visibleCredits, kpis]
  );

  const filtered = useMemo(() => {
    let result = [...visibleCredits];

    // Tab
    if (activeTab !== "ALL") {
      result = result.filter((c) => c.statut === activeTab);
    }

    // Search (farmer name or ID)
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter((c) => {
        const name = farmerDisplayName(farmerMap[c.farmerId]).toLowerCase();
        return (
          name.includes(q) ||
          c.id.toLowerCase().includes(q) ||
          c.farmerId.toLowerCase().includes(q)
        );
      });
    }

    // Score min
    if (scoreMin > 0) {
      result = result.filter(
        (c) => (scoreMap[c.farmerId]?.score ?? 0) >= scoreMin
      );
    }

    // Montant range
    const mMin = montantMin ? Number(montantMin) : 0;
    const mMax = montantMax ? Number(montantMax) : Infinity;
    if (mMin > 0)        result = result.filter((c) => c.montant >= mMin);
    if (mMax < Infinity) result = result.filter((c) => c.montant <= mMax);

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "ancien":       return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "montant_asc":  return a.montant - b.montant;
        case "montant_desc": return b.montant - a.montant;
        case "score_asc":    return (scoreMap[a.farmerId]?.score ?? 0) - (scoreMap[b.farmerId]?.score ?? 0);
        case "score_desc":   return (scoreMap[b.farmerId]?.score ?? 0) - (scoreMap[a.farmerId]?.score ?? 0);
        default:             return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [visibleCredits, activeTab, search, scoreMin, montantMin, montantMax, sortBy, farmerMap, scoreMap]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function openApproval(credit: CreditRequest) {
    setSelectedCredit(credit);
    setModalError(null);
    setShowApproval(true);
  }
  function openRejection(credit: CreditRequest) {
    setSelectedCredit(credit);
    setModalError(null);
    setShowRejection(true);
  }

  async function handleApprove(montantAccorde: number, tauxApplique: number, _produit: string) {
    if (!selectedCredit) return;
    setIsSubmitting(true);
    setModalError(null);
    console.log("[credits] approve →", selectedCredit.id, { montantAccorde, tauxApplique });
    try {
      const result = await creditRequestsApi.approveCreditDecision(selectedCredit.id, {
        montant: montantAccorde,
        taux:    tauxApplique,
        duree:   selectedCredit.duree,
      });
      console.log("[credits] approve ← OK", result);
      setCredits((prev) =>
        prev.map((c) =>
          c.id === selectedCredit.id
            ? { ...c, statut: "APPROVED" as CreditStatus, montantAccorde, tauxApplique }
            : c
        )
      );
      setShowApproval(false);
      setSelectedCredit(null);
      showToastMsg("Crédit approuvé ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'approbation";
      console.error("[credits] approve ← ERROR", msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject(motif: string, _note: string) {
    if (!selectedCredit) return;
    setIsSubmitting(true);
    setModalError(null);
    console.log("[credits] reject →", selectedCredit.id, { motif });
    try {
      const result = await creditRequestsApi.rejectCreditDecision(selectedCredit.id, { motif });
      console.log("[credits] reject ← OK", result);
      setCredits((prev) =>
        prev.map((c) =>
          c.id === selectedCredit.id
            ? { ...c, statut: "REJECTED" as CreditStatus }
            : c
        )
      );
      setShowRejection(false);
      setSelectedCredit(null);
      showToastMsg("Demande rejetée");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du rejet";
      console.error("[credits] reject ← ERROR", msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleExport() {
    exportCSV(
      filtered.map((c) => ({
        ID:       c.id,
        Farmer:   farmerDisplayName(farmerMap[c.farmerId]),
        Région:   farmerMap[c.farmerId]?.region ?? "",
        Montant:  c.montant,
        Durée:    c.duree,
        Objet:    c.objet,
        Statut:   c.statut,
        Score:    scoreMap[c.farmerId]?.score ?? "",
        Date:     c.createdAt,
      })),
      "credits-export.csv"
    );
  }

  // ── Tab label helper ─────────────────────────────────────────────────────────

  const emptyTabLabel: Record<Tab, string> = {
    PENDING:  "en attente",
    APPROVED: "approuvée",
    REJECTED: "rejetée",
    ALL:      "",
  };

  // ── Loading ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Sk className="h-10 w-64" />
          <Sk className="h-9 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Sk key={i} className="h-28" />)}
        </div>
        <Sk className="h-12" />
        <Sk className="h-10" />
        <Sk className="h-96" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-xl bg-bg-secondary border border-gray-700 px-5 py-3 text-sm text-text-primary shadow-2xl">
          {toast}
        </div>
      )}

      {/* ── Modals ── */}
      {showApproval && selectedCredit && (
        <ApprovalModal
          credit={selectedCredit}
          farmer={farmerMap[selectedCredit.farmerId]}
          scoreData={scoreMap[selectedCredit.farmerId]}
          scoringConfig={scoringConfig}
          onClose={() => { setShowApproval(false); setSelectedCredit(null); }}
          onConfirm={handleApprove}
          isSubmitting={isSubmitting}
          submitError={modalError}
        />
      )}
      {showRejection && selectedCredit && (
        <RejectionModal
          credit={selectedCredit}
          farmer={farmerMap[selectedCredit.farmerId]}
          scoreData={scoreMap[selectedCredit.farmerId]}
          onClose={() => { setShowRejection(false); setSelectedCredit(null); }}
          onConfirm={handleReject}
          isSubmitting={isSubmitting}
          submitError={modalError}
        />
      )}

      {/* ═══════════════════════════════════ HEADER */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-text-primary">Demandes de crédit</h1>
          <p className="text-sm text-text-secondary mt-0.5">
            {institutionName ? `${institutionName} · ` : ""}
            Pipeline de traitement — {visibleCredits.length} demande{visibleCredits.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm text-text-secondary hover:text-text-primary transition-colors shrink-0"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
          Export CSV
        </button>
      </div>

      {/* ═══════════════════════════════════ KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="En attente"
          value={kpis.pending.length}
          sub="demandes PENDING"
          icon="hourglass_empty"
          color="#f59e0b"
        />
        <KPICard
          label="Approuvées"
          value={kpis.approved.length}
          sub="demandes validées"
          icon="check_circle"
          color="#10b981"
        />
        <KPICard
          label="Rejetées"
          value={kpis.rejected.length}
          sub="demandes refusées"
          icon="cancel"
          color="#ef4444"
        />
        <KPICard
          label="Montant total en attente"
          value={formatFCFA(kpis.pendingAmount)}
          sub="FCFA à traiter"
          icon="payments"
          color="#f59e0b"
        />
      </div>

      {/* ═══════════════════════════════════ TABS */}
      <div className="flex items-center gap-1 border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? "border-accent text-accent"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.label}
            <span
              className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-mono ${
                activeTab === tab.key
                  ? "bg-accent/20 text-accent"
                  : "bg-bg-tertiary text-text-muted"
              }`}
            >
              {tabCounts[tab.key]}
            </span>
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════ FILTERS */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative">
          <span
            className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            style={{ fontSize: 16 }}
          >
            search
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom, ID…"
            className="pl-9 pr-3 py-2 rounded-lg bg-bg-tertiary border border-gray-700 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent w-44"
          />
        </div>

        {/* Score min */}
        <select
          value={scoreMin}
          onChange={(e) => setScoreMin(Number(e.target.value))}
          className="rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          {SCORE_MIN_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Montant range */}
        <input
          type="number"
          value={montantMin}
          onChange={(e) => setMontantMin(e.target.value)}
          placeholder="Montant min"
          className="w-32 rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent"
        />
        <input
          type="number"
          value={montantMax}
          onChange={(e) => setMontantMax(e.target.value)}
          placeholder="Montant max"
          className="w-32 rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono focus:outline-none focus:border-accent"
        />

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent ml-auto"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* ═══════════════════════════════════ TABLE */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl bg-bg-secondary border border-gray-800 py-20 gap-3">
          <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 52 }}>
            inbox
          </span>
          <p className="text-sm text-text-secondary">
            Aucune demande{emptyTabLabel[activeTab] ? ` ${emptyTabLabel[activeTab]}` : ""}
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-bg-secondary border border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  {[
                    "Farmer",
                    "Montant demandé",
                    "Objet",
                    "Message",
                    "Score Wakama",
                    "Éligibilité",
                    "Date",
                    "Statut",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {filtered.map((credit) => {
                  const farmer    = farmerMap[credit.farmerId];
                  const scoreData = scoreMap[credit.farmerId];
                  const score     = scoreData?.score;
                  const elig      = eligibilityLabel(score);
                  const statusSt  = STATUS_STYLE[credit.statut];
                  const name      = farmerDisplayName(farmer);
                  const ini       = farmer
                    ? initials(farmer.lastName ?? farmer.nom, farmer.firstName ?? farmer.prenom)
                    : "??";

                  return (
                    <tr key={credit.id} className="hover:bg-bg-tertiary/30 transition-colors">

                      {/* Farmer */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-accent">{ini}</span>
                          </div>
                          <div className="min-w-0">
                            <Link
                              href={`/${locale}/farmers/${credit.farmerId}`}
                              className="text-text-primary font-medium hover:text-accent transition-colors truncate block max-w-[140px]"
                            >
                              {name}
                            </Link>
                            {farmer?.region && (
                              <span className="text-xs text-text-muted">{farmer.region}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Montant */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-mono font-semibold text-text-primary">
                          {formatFCFA(credit.montant)}
                        </p>
                        <p className="text-xs text-text-muted">{credit.duree} mois</p>
                      </td>

                      {/* Objet */}
                      <td className="px-4 py-3 max-w-[180px]">
                        <p className="text-text-secondary truncate" title={credit.objet}>
                          {credit.objet.length > 40
                            ? `${credit.objet.slice(0, 40)}…`
                            : credit.objet}
                        </p>
                      </td>

                      {/* Message */}
                      <td className="px-4 py-3 max-w-[200px]">
                        {credit.message ? (
                          <p
                            className="text-text-secondary text-sm italic truncate"
                            title={credit.message}
                          >
                            {credit.message.length > 80
                              ? `${credit.message.slice(0, 80)}…`
                              : credit.message}
                          </p>
                        ) : (
                          <span className="text-text-secondary text-sm italic">—</span>
                        )}
                      </td>

                      {/* Score */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {score != null ? (
                          <div>
                            <span
                              className={`px-2 py-0.5 rounded-full border text-xs font-medium font-mono ${formatScore(score)}`}
                            >
                              {score}
                            </span>
                            {scoreData?.produitSuggere && (
                              <p className="text-xs text-text-muted mt-0.5">
                                {scoreData.produitSuggere}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Éligibilité */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {elig ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="material-symbols-outlined"
                              style={{
                                fontSize: 14,
                                color: elig.color,
                                fontVariationSettings:
                                  '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                              }}
                            >
                              {elig.label === "Non éligible" ? "cancel" : "check_circle"}
                            </span>
                            <span
                              className="text-xs font-medium"
                              style={{ color: elig.color }}
                            >
                              {elig.label}
                            </span>
                          </div>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-text-muted">
                          {relativeTime(credit.createdAt)}
                        </span>
                      </td>

                      {/* Statut */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusSt.classes}`}>
                          {statusSt.label}
                        </span>
                        {credit.statut === "APPROVED" && credit.montantAccorde != null && (
                          <p className="text-xs text-emerald-400 font-mono mt-0.5">
                            {formatFCFA(credit.montantAccorde)}
                          </p>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          {credit.statut === "PENDING" && (
                            <>
                              <button
                                onClick={() => openApproval(credit)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-800 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                              >
                                ✅ Approuver
                              </button>
                              <button
                                onClick={() => openRejection(credit)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-500/10 border border-red-800 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                              >
                                ❌ Rejeter
                              </button>
                            </>
                          )}
                          <Link
                            href={`/${locale}/farmers/${credit.farmerId}`}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-700 text-text-secondary text-xs hover:text-text-primary transition-colors"
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 13 }}>
                              visibility
                            </span>
                            Fiche
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table footer */}
          <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
            <span className="text-xs text-text-muted">
              {filtered.length} résultat{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== visibleCredits.length && ` sur ${visibleCredits.length}`}
            </span>
            <button
              onClick={handleExport}
              className="text-xs text-text-secondary hover:text-accent transition-colors"
            >
              Exporter cette vue →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
