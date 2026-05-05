"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import AlertBadge from "@/src/components/ui/AlertBadge";
import ScoreGauge from "@/src/components/ui/ScoreGauge";
import {
  alerts as alertsApi,
  creditRequests as creditRequestsApi,
  farmers as farmersApi,
  parcelles as parcellesApi,
  scores as scoresApi,
  upload as uploadApi,
} from "@/src/lib/api";
import { canApproveCredit, getInstitutionId, getInstitutionRole } from "@/src/lib/auth";
import {
  applyCustomWeights,
  getActiveConfig,
  hasCustomWeights,
  type InstitutionScoringConfig,
} from "@/src/lib/scoringConfig";
import {
  formatFCFA,
  formatScore,
  getFarmerDisplayName,
  getFarmerInitials,
  relativeTime,
  scoreColor,
} from "@/src/lib/utils";
import type {
  Alert,
  CreditRequest,
  CreditStatus,
  Farmer,
  Parcelle,
  WakamaScoreResult,
} from "@/src/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const obj = raw as Record<string, unknown>;
  if (Array.isArray(obj?.data)) return obj.data as T[];
  return [];
}

function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className}`} style={{ backgroundColor: "#111a2e" }} />;
}

const CREDIT_STATUS: Record<CreditStatus, { label: string; style: React.CSSProperties }> = {
  PENDING:   { label: "En attente", style: { backgroundColor: "rgba(245,158,11,0.1)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" } },
  REVIEWING: { label: "En cours",   style: { backgroundColor: "rgba(59,130,246,0.1)",  color: "#3b82f6", border: "1px solid rgba(59,130,246,0.3)"  } },
  APPROVED:  { label: "Approuvé",   style: { backgroundColor: "rgba(16,185,129,0.1)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" } },
  REJECTED:  { label: "Rejeté",     style: { backgroundColor: "rgba(239,68,68,0.1)",   color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)"   } },
};

const DEFAULT_CREDIT_STATUS_STYLE = {
  label: "Statut inconnu",
  style: {
    backgroundColor: "rgba(148,163,184,0.1)",
    color: "#94a3b8",
    border: "1px solid rgba(148,163,184,0.3)",
  },
};

function ndviStyle(ndvi: number | null | undefined): { label: string; classes: string } {
  if (ndvi == null) return { label: "N/A",    classes: "bg-gray-500/10 text-gray-400 border border-gray-700" };
  if (ndvi >= 0.5)  return { label: "BON",    classes: "bg-emerald-500/10 text-emerald-400 border border-emerald-800" };
  if (ndvi >= 0.3)  return { label: "MOYEN",  classes: "bg-amber-500/10 text-amber-400 border border-amber-800" };
  return              { label: "FAIBLE", classes: "bg-red-500/10 text-red-400 border border-red-800" };
}

// ─── ApprovalModal ────────────────────────────────────────────────────────────

interface ApprovalModalProps {
  credit: CreditRequest;
  farmer: Farmer;
  scoreData: WakamaScoreResult | null;
  onClose: () => void;
  onConfirm: (montant: number, taux: number, duree: number, conditions: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

function ApprovalModal({ credit, farmer, scoreData, onClose, onConfirm, isSubmitting = false, submitError }: ApprovalModalProps) {
  const [montant, setMontant] = useState(scoreData?.montantMax ?? credit.montant);
  const [taux, setTaux] = useState(1.60);
  const [duree, setDuree] = useState(credit.duree);
  const [conditions, setConditions] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-bg-secondary p-6 shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary mb-1 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-emerald-400"
            style={{ fontSize: 22, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            check_circle
          </span>
          Approuver le crédit
        </h2>
        <p className="text-sm text-text-secondary mb-5">
          {getFarmerDisplayName(farmer)}
          {scoreData && (
            <span
              className="ml-2 font-mono font-semibold"
              style={{ color: scoreColor(scoreData.score) }}
            >
              · Score {scoreData.score}
            </span>
          )}
        </p>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-text-secondary font-medium mb-1.5 block">
              Montant accordé (FCFA)
            </span>
            <input
              type="number"
              value={montant}
              onChange={(e) => setMontant(Number(e.target.value))}
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-text-secondary font-medium mb-1.5 block">
                Taux mensuel (%)
              </span>
              <input
                type="number"
                value={taux}
                step={0.05}
                onChange={(e) => setTaux(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="text-xs text-text-secondary font-medium mb-1.5 block">
                Durée (mois)
              </span>
              <input
                type="number"
                value={duree}
                onChange={(e) => setDuree(Number(e.target.value))}
                className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm font-mono focus:outline-none focus:border-accent"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs text-text-secondary font-medium mb-1.5 block">
              Conditions (optionnel)
            </span>
            <textarea
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              rows={3}
              placeholder="Conditions particulières…"
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent resize-none"
            />
          </label>
        </div>

        {submitError && (
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {submitError}
          </div>
        )}

        <div className="flex gap-3 mt-4">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-700 bg-bg-tertiary px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(montant, taux, duree, conditions)}
            disabled={isSubmitting}
            className="flex-1 rounded-lg bg-accent hover:bg-accent-hover px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting ? "Envoi…" : "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RejectionModal ───────────────────────────────────────────────────────────

interface RejectionModalProps {
  onClose: () => void;
  onConfirm: (motif: string, note: string) => void;
  isSubmitting?: boolean;
  submitError?: string | null;
}

function RejectionModal({ onClose, onConfirm, isSubmitting = false, submitError }: RejectionModalProps) {
  const [motif, setMotif] = useState("Score insuffisant (< 300)");
  const [note, setNote] = useState("");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-bg-secondary p-6 shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-text-primary mb-4 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-red-400"
            style={{ fontSize: 22, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
          >
            cancel
          </span>
          Rejeter la demande
        </h2>

        <div className="space-y-4">
          <label className="block">
            <span className="text-xs text-text-secondary font-medium mb-1.5 block">Motif</span>
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="w-full rounded-lg bg-bg-tertiary border border-gray-700 px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-accent"
            >
              <option>Score insuffisant ({"<"} 300)</option>
              <option>Documents KYC manquants</option>
              <option>Capacité remboursement insuffisante</option>
              <option>Activité insuffisante</option>
              <option>Autre</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-text-secondary font-medium mb-1.5 block">
              Note interne
            </span>
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
          <div className="mt-4 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs text-red-400">
            {submitError}
          </div>
        )}

        <div className="flex gap-3 mt-4">
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
            className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-50"
          >
            {isSubmitting ? "Envoi…" : "Confirmer le rejet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── DocumentViewerModal ─────────────────────────────────────────────────────

interface DocViewerState {
  open: boolean;
  loading: boolean;
  error: string | null;
  url: string | null;
  mimeType: string | null;
  docType: "cni" | "attestation" | null;
}

function DocumentViewerModal({
  state,
  onClose,
}: {
  state: DocViewerState;
  onClose: () => void;
}) {
  const { loading, error, url, mimeType, docType } = state;
  const label   = docType === "cni" ? "CNI" : "Attestation foncière";
  const isPdf   = !loading && !error && !!url && mimeType === "application/pdf";
  const isImage = !loading && !error && !!url && !!mimeType?.startsWith("image/");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex w-full max-w-2xl flex-col rounded-2xl bg-bg-secondary p-6 shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.06)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-text-primary">
            <span
              className="material-symbols-outlined text-cyan-400"
              style={{ fontSize: 22, fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20' }}
            >
              description
            </span>
            {label}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-12 text-text-muted">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm">Chargement du document…</p>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-6 text-center">
            <span
              className="material-symbols-outlined text-red-400 mb-2 block"
              style={{ fontSize: 36 }}
            >
              error
            </span>
            <p className="text-sm font-medium text-red-400">{error}</p>
          </div>
        )}

        {/* Document */}
        {!loading && !error && url && (
          <div className="flex flex-1 min-h-0 flex-col gap-3">
            {isPdf ? (
              <div className="flex flex-col items-center justify-center gap-4 rounded-xl bg-bg-tertiary border border-gray-700 px-6 py-10">
                <span
                  className="material-symbols-outlined text-cyan-400"
                  style={{ fontSize: 56, fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 48' }}
                >
                  picture_as_pdf
                </span>
                <div className="text-center">
                  <p className="text-sm font-semibold text-text-primary">{label}</p>
                  <p className="text-xs text-text-muted mt-0.5">PDF prêt à être consulté</p>
                </div>
                <div className="flex gap-3 mt-1">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 rounded-lg bg-cyan-500/15 border border-cyan-700 px-4 py-2 text-sm font-medium text-cyan-400 hover:bg-cyan-500/25 transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                    Ouvrir dans un nouvel onglet
                  </a>
                  <a
                    href={url}
                    download={`${label}.pdf`}
                    className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                    Télécharger
                  </a>
                </div>
              </div>
            ) : isImage ? (
              <div className="flex items-center justify-center overflow-auto rounded-lg bg-bg-tertiary p-4" style={{ minHeight: 200 }}>
                <img
                  src={url}
                  alt={label}
                  className="max-w-full object-contain"
                  style={{ maxHeight: "50vh" }}
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-text-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 48 }}>description</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
                  Télécharger le document
                </a>
              </div>
            )}

            {/* Open in new tab — only for images and unknown types (PDF card has its own CTAs) */}
            {!isPdf && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>open_in_new</span>
                Ouvrir dans un nouvel onglet
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Products eligible thresholds ────────────────────────────────────────────

const PRODUCTS = [
  { name: "REMUCI",       icon: "payments",         threshold: 300 },
  { name: "Baobab Prod",  icon: "agriculture",      threshold: 400 },
  { name: "Baobab Camp",  icon: "forest",           threshold: 600 },
  { name: "NSIA",         icon: "account_balance",  threshold: 700 },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

type ParcelleExt = Parcelle & {
  nom?: string;
  region?: string;
  ndvi?: number;
  polygone?: Array<{ lat: number; lng: number }>;
};

export default function FarmerDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const locale = (params.locale as string) ?? "fr";
  const canDecideCredits = canApproveCredit();
  const institutionRole = getInstitutionRole();

  const [scoringConfig, setScoringConfig] = useState<InstitutionScoringConfig | null>(null);

  useEffect(() => {
    setScoringConfig(getActiveConfig(getInstitutionId()));
  }, []);

  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [farmer, setFarmer]             = useState<Farmer | null>(null);
  const [scoreData, setScoreData]       = useState<WakamaScoreResult | null>(null);
  const [parcellesList, setParcellesList] = useState<ParcelleExt[]>([]);
  const [alertsList, setAlertsList]     = useState<Alert[]>([]);
  const [credits, setCredits]           = useState<CreditRequest[]>([]);

  const [showApproval, setShowApproval]   = useState(false);
  const [showRejection, setShowRejection] = useState(false);
  const [selectedCredit, setSelectedCredit] = useState<CreditRequest | null>(null);
  const [toast, setToast]               = useState<string | null>(null);
  const [isSubmitting,  setIsSubmitting] = useState(false);
  const [modalError,    setModalError]   = useState<string | null>(null);
  const [docViewer, setDocViewer]        = useState<DocViewerState>({
    open: false, loading: false, error: null, url: null, mimeType: null, docType: null,
  });

  function showToastMsg(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function refreshCredits() {
    try {
      const updated = await creditRequestsApi.list({ farmerId: id });
      setCredits(toArray(updated));
    } catch { /* silent */ }
  }

  useEffect(() => {
    if (!id) return;
    Promise.allSettled([
      farmersApi.get(id),
      scoresApi.getFarmer(id),
      parcellesApi.listByFarmer(id),
      alertsApi.list({ farmerId: id }),
      creditRequestsApi.list({ farmerId: id }),
    ]).then(([farmerRes, scoreRes, parcellesRes, alertsRes, creditsRes]) => {
      if (farmerRes.status === "rejected") {
        setError("Agriculteur introuvable");
        setLoading(false);
        return;
      }
      setFarmer(farmerRes.value);
      if (scoreRes.status    === "fulfilled") setScoreData(scoreRes.value);
      if (parcellesRes.status === "fulfilled") setParcellesList(toArray(parcellesRes.value));
      if (alertsRes.status   === "fulfilled") setAlertsList(toArray(alertsRes.value));
      if (creditsRes.status  === "fulfilled") setCredits(toArray(creditsRes.value));
      setLoading(false);
    });
  }, [id]);

  async function handleApprove(montant: number, taux: number, duree: number, conditions: string) {
    void conditions;
    if (!canDecideCredits) {
      setModalError("Accès non autorisé pour ce rôle.");
      return;
    }
    if (!selectedCredit) return;
    setIsSubmitting(true);
    setModalError(null);
    console.log("[farmer] approve →", selectedCredit.id, { montant, taux, duree });
    try {
      const result = await creditRequestsApi.approveCreditDecision(selectedCredit.id, { montant, taux, duree });
      console.log("[farmer] approve ← OK", result);
      setCredits(prev => prev.map(c =>
        c.id === selectedCredit.id
          ? { ...c, statut: "APPROVED" as const, montantAccorde: montant, tauxApplique: taux }
          : c
      ));
      setShowApproval(false);
      setSelectedCredit(null);
      showToastMsg("Crédit approuvé ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'approbation";
      console.error("[farmer] approve ← ERROR", msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject(motif: string, note: string) {
    void note;
    if (!canDecideCredits) {
      setModalError("Accès non autorisé pour ce rôle.");
      return;
    }
    if (!selectedCredit) return;
    setIsSubmitting(true);
    setModalError(null);
    console.log("[farmer] reject →", selectedCredit.id, { motif });
    try {
      const result = await creditRequestsApi.rejectCreditDecision(selectedCredit.id, { motif });
      console.log("[farmer] reject ← OK", result);
      setCredits(prev => prev.map(c =>
        c.id === selectedCredit.id ? { ...c, statut: "REJECTED" as const } : c
      ));
      setShowRejection(false);
      setSelectedCredit(null);
      showToastMsg(`Demande rejetée — ${motif}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du rejet";
      console.error("[farmer] reject ← ERROR", msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleViewDocument(type: "cni" | "attestation") {
    setDocViewer({ open: true, loading: true, error: null, url: null, mimeType: null, docType: type });
    try {
      const result = await uploadApi.getDocument(id, type);
      setDocViewer((prev) => ({ ...prev, loading: false, url: result.url, mimeType: result.mimeType }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement du document";
      setDocViewer((prev) => ({ ...prev, loading: false, error: msg }));
    }
  }

  function closeDocViewer() {
    if (docViewer.url?.startsWith("blob:")) URL.revokeObjectURL(docViewer.url);
    setDocViewer({ open: false, loading: false, error: null, url: null, mimeType: null, docType: null });
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <Sk className="h-16 w-full" />
        <div className="grid grid-cols-5 gap-6">
          <div className="col-span-3"><Sk className="h-96" /></div>
          <div className="col-span-2"><Sk className="h-96" /></div>
        </div>
        <Sk className="h-44" />
        <Sk className="h-56" />
        <Sk className="h-40" />
      </div>
    );
  }

  // ── Error ──
  if (error || !farmer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <span className="material-symbols-outlined text-text-muted" style={{ fontSize: 64 }}>
          person_off
        </span>
        <p className="text-text-secondary text-base">{error ?? "Agriculteur introuvable"}</p>
        <Link
          href={`/${locale}/farmers`}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
          Retour à la liste
        </Link>
      </div>
    );
  }

  // ── Derived values ──
  const pendingCredit    = credits.find((c) => c.statut === "PENDING") ?? null;
  const score            = scoreData?.score ?? 0;
  const scoreBadgeClass  = scoreData ? formatScore(score) : "bg-gray-500/10 text-gray-400 border-gray-700";
  const hasKYC           = !!(farmer.cniUrl);
  const hasCNI           = !!(farmer.cniUrl);
  const hasAttestation   = !!(farmer.attestationUrl);
  const hasPhoto         = !!(farmer.photoUrl);
  const hasGPS           = !!(farmer.gpsLat && farmer.gpsLng);

  let revenusAnnexes: string[] = [];
  try {
    revenusAnnexes = JSON.parse(farmer.revenusAnnexes ?? "[]");
  } catch {
    revenusAnnexes = [];
  }

  return (
    <div className="flex-1 overflow-y-auto">

      {/* ── Toast notification ── */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 rounded-xl bg-bg-secondary border border-gray-700 px-5 py-3 text-sm text-text-primary shadow-2xl animate-in">
          {toast}
        </div>
      )}

      {/* ── Modals ── */}
      {showApproval && selectedCredit && (
        <ApprovalModal
          credit={selectedCredit}
          farmer={farmer}
          scoreData={scoreData}
          onClose={() => { setShowApproval(false); setSelectedCredit(null); setModalError(null); }}
          onConfirm={handleApprove}
          isSubmitting={isSubmitting}
          submitError={modalError}
        />
      )}
      {showRejection && selectedCredit && (
        <RejectionModal
          onClose={() => { setShowRejection(false); setSelectedCredit(null); setModalError(null); }}
          onConfirm={handleReject}
          isSubmitting={isSubmitting}
          submitError={modalError}
        />
      )}
      {docViewer.open && docViewer.docType && (
        <DocumentViewerModal state={docViewer} onClose={closeDocViewer} />
      )}

      {/* ══════════════════════════════════════════════════════ STICKY HEADER */}
      <div className="sticky top-0 z-10 bg-bg-primary/95 backdrop-blur-sm px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between gap-4">

          {/* Left — breadcrumb + badges */}
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <Link
              href={`/${locale}/farmers`}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors shrink-0"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
              Agriculteurs
            </Link>
            <span className="text-gray-600 shrink-0">›</span>
            <span className="text-sm font-semibold text-text-primary truncate">
              {getFarmerDisplayName(farmer)}
            </span>
            <span
              className={`shrink-0 px-2.5 py-0.5 rounded-full border text-xs font-medium ${
                hasKYC
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-800"
                  : "bg-red-500/10 text-red-400 border-red-800"
              }`}
            >
              KYC {hasKYC ? "✓" : "✗"}
            </span>
            {scoreData && (
              <span className={`shrink-0 px-2.5 py-0.5 rounded-full border text-xs font-medium font-mono ${scoreBadgeClass}`}>
                {scoreData.score} / 1000
              </span>
            )}
          </div>

          {/* Right — action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/${locale}/farmers/${id}/dossier`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>folder_open</span>
              Voir dossier comité
            </Link>
            <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-700 text-sm text-text-secondary hover:text-text-primary transition-colors">
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>picture_as_pdf</span>
              Rapport PDF
            </button>
            <button
              disabled={!pendingCredit || !canDecideCredits}
              onClick={() => {
                if (!canDecideCredits || !pendingCredit) return;
                setSelectedCredit(pendingCredit);
                setShowApproval(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-sm font-semibold text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
              Approuver crédit
            </button>
            <button
              disabled={!pendingCredit || !canDecideCredits}
              onClick={() => {
                if (!canDecideCredits || !pendingCredit) return;
                setSelectedCredit(pendingCredit);
                setShowRejection(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-800 text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>cancel</span>
              Rejeter
            </button>
          </div>

          {!canDecideCredits && (
            <p className="mt-3 text-xs text-amber-300">
              {institutionRole === "READONLY"
                ? "Mode READONLY : décisions de crédit désactivées."
                : "Votre rôle ne permet pas de traiter cette demande."}
            </p>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ PAGE CONTENT */}
      <div className="p-6 space-y-6">

        {/* ── Section 1: Profile + Score (5-col grid) ── */}
        <div className="grid grid-cols-5 gap-6">

          {/* Profile card — col-span-3 */}
          <div className="col-span-3 rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {/* Avatar + name header */}
            <div className="flex items-start gap-5 mb-6">
              <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center shrink-0 overflow-hidden">
                {farmer.photoUrl ? (
                  <img src={farmer.photoUrl} alt={getFarmerDisplayName(farmer)} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-bold text-white">
                    {getFarmerInitials(farmer)}
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h1 style={{ fontSize: 14, fontWeight: 500, color: "#e8edf5" }} className="truncate">
                  {getFarmerDisplayName(farmer)}
                </h1>
                <span className="inline-block mt-1 px-2 py-0.5 rounded bg-bg-tertiary text-text-muted text-xs font-mono">
                  #{farmer.id.slice(0, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Info grid 2 cols */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 mb-6">
              {[
                {
                  icon: "location_on",
                  label: "Localisation",
                  value: [farmer.region, farmer.village].filter(Boolean).join(", ") || "—",
                },
                { icon: "phone",           label: "Téléphone",       value: farmer.telephone || "—" },
                { icon: "email",           label: "Email",            value: farmer.email || "—" },
                { icon: "groups",          label: "Coopérative",      value: farmer.cooperativeId ?? "—" },
                { icon: "calendar_month",  label: "Membre depuis",    value: relativeTime(farmer.onboardedAt) },
                {
                  icon: "agriculture",
                  label: "Expérience",
                  value: farmer.experienceAnnees ? `${farmer.experienceAnnees} ans` : "Non renseigné",
                },
                {
                  icon: "account_balance",
                  label: "Historique crédit",
                  value: farmer.historicCredit ?? "Jamais demandé",
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-start gap-2.5">
                  <span
                    className="material-symbols-outlined text-text-muted mt-0.5 shrink-0"
                    style={{ fontSize: 16 }}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-text-muted mb-0.5">{label}</p>
                    <p className="text-sm text-text-primary truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Revenus annexes chips */}
            {revenusAnnexes.length > 0 && (
              <div className="mb-5">
                <p className="text-xs text-text-muted font-medium mb-2">Autres revenus</p>
                <div className="flex flex-wrap gap-1.5">
                  {revenusAnnexes.map((r, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-0.5 rounded-full bg-bg-tertiary border border-gray-700 text-xs text-text-secondary"
                    >
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Documents checklist */}
            <div>
              <p className="text-xs text-text-muted font-medium uppercase tracking-wide mb-2.5">
                Documents KYC
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: "badge",        label: "CNI",                  ok: hasCNI,         view: hasCNI ? "cni" as const : null },
                  { icon: "landscape",    label: "Attestation foncière", ok: hasAttestation,  view: hasAttestation ? "attestation" as const : null },
                  { icon: "photo_camera", label: "Photo",                ok: hasPhoto,        view: null },
                  {
                    icon: "gps_fixed",
                    label: hasGPS
                      ? `GPS ${farmer.gpsLat?.toFixed(4)}, ${farmer.gpsLng?.toFixed(4)}`
                      : "GPS",
                    ok: hasGPS,
                    view: null,
                  },
                ].map(({ icon, label, ok, view }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span
                      className="material-symbols-outlined text-text-muted shrink-0"
                      style={{ fontSize: 15 }}
                    >
                      {icon}
                    </span>
                    <span className="text-sm text-text-secondary truncate flex-1">{label}</span>
                    {view ? (
                      <button
                        onClick={() => handleViewDocument(view)}
                        className="shrink-0 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        Voir
                      </button>
                    ) : (
                      <span className="text-sm shrink-0">{ok ? "✅" : "❌"}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Score card — col-span-2 */}
          <div className="col-span-2 rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            {scoreData ? (
              <div className="space-y-5">
                <ScoreGauge
                  score={scoreData.score}
                  showDetails
                  c1={scoreData.c1}
                  c2={scoreData.c2}
                  c3={scoreData.c3}
                  c4={scoreData.c4}
                />

                {scoreData.produitSuggere && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Produit recommandé</p>
                    <span className="text-accent font-semibold text-sm">
                      {scoreData.produitSuggere}
                    </span>
                  </div>
                )}

                {(scoreData.montantMin != null || scoreData.montantMax != null) && (
                  <div>
                    <p className="text-xs text-text-muted mb-1">Montant suggéré</p>
                    <p className="text-sm font-mono font-semibold text-text-primary">
                      {formatFCFA(scoreData.montantMin ?? 0)}{" "}
                      <span className="text-text-muted font-normal">→</span>{" "}
                      {formatFCFA(scoreData.montantMax ?? 0)}
                    </p>
                  </div>
                )}

                {/* Product eligibility */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <p className="text-xs text-text-muted font-medium uppercase tracking-wide">
                      Éligibilité produits
                    </p>
                    {scoringConfig && hasCustomWeights(scoringConfig) && (
                      <span style={{ fontSize: 9, color: "#06b6d4" }}>Score ajusté selon vos critères</span>
                    )}
                  </div>
                  {(() => {
                    const adjScore = (scoreData && scoringConfig)
                      ? applyCustomWeights({ c1: scoreData.c1, c2: scoreData.c2, c3: scoreData.c3, c4: scoreData.c4 }, scoringConfig)
                      : score;
                    const products = scoringConfig?.products.filter((p) => p.active) ?? [
                      { id: "REMUCI", name: "REMUCI", minScore: 300 },
                      { id: "BP", name: "Baobab Prod", minScore: 400 },
                      { id: "BC", name: "Baobab Camp", minScore: 600 },
                      { id: "NSIA", name: "NSIA Pack Paysan", minScore: 700 },
                    ];
                    return (
                      <div className="space-y-2">
                        {products.map((p) => {
                          const eligible = adjScore >= p.minScore;
                          return (
                            <div key={p.id} className="flex items-center gap-2">
                              <span
                                className="material-symbols-outlined text-text-muted shrink-0"
                                style={{ fontSize: 15 }}
                              >
                                payments
                              </span>
                              <span className="text-sm text-text-secondary flex-1">{p.name}</span>
                              <span className="text-xs text-text-muted mr-1">≥{p.minScore}</span>
                              <span
                                className={`material-symbols-outlined shrink-0 ${eligible ? "text-emerald-400" : "text-red-400"}`}
                                style={{
                                  fontSize: 18,
                                  fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                                }}
                              >
                                {eligible ? "check_circle" : "cancel"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                {/* Recommendations */}
                {scoreData.recommendations && scoreData.recommendations.length > 0 && (
                  <div>
                    <p className="text-xs text-text-muted font-medium mb-2">À améliorer</p>
                    <ul className="space-y-1.5">
                      {scoreData.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                          <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 gap-3 text-text-muted">
                <span className="material-symbols-outlined" style={{ fontSize: 48 }}>grade</span>
                <p className="text-sm">Score non disponible</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Section 2: Capacité financière C1 ── */}
        {scoreData?.details?.c1 && (
          <div className="rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
            <h3 className="label-xs mb-4">
              Capacité financière — C1 Capacité
            </h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="rounded-lg bg-bg-tertiary p-4">
                <p className="text-xs text-text-muted mb-1">Surface totale</p>
                <p className="text-lg font-bold font-mono text-text-primary">
                  {scoreData.details?.c1?.surfaceTotale?.toFixed(1) ?? "—"}{" "}
                  <span className="text-sm font-normal text-text-muted">ha</span>
                </p>
              </div>
              <div className="rounded-lg bg-bg-tertiary p-4">
                <p className="text-xs text-text-muted mb-1">Cultures</p>
                <p className="text-sm font-medium text-text-primary">
                  {scoreData.details?.c1?.culturesPrincipales?.join(", ") ?? "—"}
                </p>
              </div>
              <div className="rounded-lg bg-bg-tertiary p-4">
                <p className="text-xs text-text-muted mb-1">Revenu estimé</p>
                <p className="text-sm font-bold font-mono text-text-primary">
                  {formatFCFA(scoreData.details?.c1?.revenuEstime ?? 0)}
                </p>
              </div>
              <div className="rounded-lg bg-bg-tertiary p-4">
                <p className="text-xs text-text-muted mb-1">Capacité remboursement</p>
                <p className="text-sm font-bold font-mono text-text-primary">
                  {formatFCFA(scoreData.montantMax ?? 0)}
                </p>
              </div>
            </div>
            <p className="text-xs text-text-muted">
              Basé sur prix officiels CI : Cacao 1 800 FCFA/kg · Hévéa 800 FCFA/kg · Anacarde 315 FCFA/kg
            </p>
          </div>
        )}

        {/* ── Section 3: Parcelles ── */}
        <div className="rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="label-xs flex items-center gap-2">
              Parcelles
              <span className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted text-xs font-mono">
                {parcellesList.length}
              </span>
            </h3>
            <Link
              href={`/${locale}/ndvi`}
              className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>satellite</span>
              Voir NDVI
            </Link>
          </div>

          {parcellesList.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">Aucune parcelle enregistrée</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {["Nom", "Culture", "Surface (ha)", "NDVI", "Stade", "Région", "Polygone"].map((h) => (
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
                  {parcellesList.map((p) => {
                    const ndviVal   = p.ndvi ?? null;
                    const nStyle    = ndviStyle(ndviVal);
                    const hasPolygon = !!(p.polygon?.length || p.polygone?.length);
                    return (
                      <tr key={p.id} className="hover:bg-bg-tertiary/30 transition-colors">
                        <td className="py-3 pr-4 text-text-primary font-medium">
                          {p.nom ?? p.id.slice(0, 8).toUpperCase()}
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{p.culture}</td>
                        <td className="py-3 pr-4 font-mono text-text-primary">
                          {p.surface?.toFixed(1) ?? "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${nStyle.classes}`}>
                            {ndviVal != null ? `${ndviVal.toFixed(3)} ` : ""}
                            {nStyle.label}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-text-secondary">{p.stade}</td>
                        <td className="py-3 pr-4 text-text-secondary">{p.region ?? "—"}</td>
                        <td className="py-3 text-center">{hasPolygon ? "✅ Oui" : "❌ Non"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Section 4: Credit requests ── */}
        <div className="rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="label-xs mb-4 flex items-center gap-2">
            Demandes de crédit
            <span className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted text-xs font-mono">
              {credits.length}
            </span>
          </h3>

          {!canDecideCredits && credits.length > 0 && (
            <p className="mb-4 text-xs text-amber-300">
              {institutionRole === "READONLY"
                ? "Mode READONLY : approbation et rejet masqués."
                : "Votre rôle ne permet pas de traiter les décisions de crédit."}
            </p>
          )}

          {credits.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">Aucune demande de crédit</p>
          ) : (
            <div className="space-y-3">
              {credits.map((cr) => {
                const statusStyle =
                  CREDIT_STATUS[cr.statut as CreditStatus] ?? {
                    ...DEFAULT_CREDIT_STATUS_STYLE,
                    label: cr.statut || DEFAULT_CREDIT_STATUS_STYLE.label,
                  };
                return (
                  <div
                    key={cr.id}
                    className="rounded-lg bg-bg-tertiary/40 p-4"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    {/* Top */}
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-bold text-text-primary text-sm">
                        {formatFCFA(cr.montant)}
                      </span>
                      <span className="text-text-muted text-xs">{cr.duree} mois</span>
                      <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-medium" style={statusStyle.style}>
                        {statusStyle.label}
                      </span>
                    </div>
                    {/* Middle */}
                    <p className="text-sm text-text-secondary line-clamp-2 mb-3">{cr.objet}</p>
                    {/* Bottom */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-text-muted">{relativeTime(cr.createdAt)}</span>
                      {cr.statut === "PENDING" && canDecideCredits && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setSelectedCredit(cr); setShowApproval(true); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-800 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-colors"
                          >
                            ✅ Approuver
                          </button>
                          <button
                            onClick={() => { setSelectedCredit(cr); setShowRejection(true); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-800 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors"
                          >
                            ❌ Rejeter
                          </button>
                        </div>
                      )}
                      {cr.statut === "PENDING" && !canDecideCredits && (
                        <span className="text-xs text-text-muted">Lecture seule</span>
                      )}
                      {cr.statut === "APPROVED" && cr.montantAccorde != null && (
                        <span className="text-xs text-emerald-400 font-mono">
                          {formatFCFA(cr.montantAccorde)} accordé
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Section 5: Alerts ── */}
        <div className="rounded-xl bg-bg-secondary p-6" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="label-xs mb-4 flex items-center gap-2">
            Alertes récentes
            <span className="px-2 py-0.5 rounded-full bg-bg-tertiary text-text-muted text-xs font-mono">
              {alertsList.length}
            </span>
          </h3>

          {alertsList.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">Aucune alerte pour cet agriculteur</p>
          ) : (
            <div className="divide-y divide-gray-800/60">
              {alertsList.slice(0, 8).map((alert) => (
                <div key={alert.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <AlertBadge severity={alert.severity} text={alert.severity} />
                  <p className="flex-1 min-w-0 text-sm text-text-secondary">
                    {alert.message.length > 100
                      ? `${alert.message.slice(0, 100)}…`
                      : alert.message}
                  </p>
                  <span className="text-xs text-text-muted shrink-0">
                    {relativeTime(alert.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
