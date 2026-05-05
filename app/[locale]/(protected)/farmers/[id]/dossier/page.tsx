"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const ParcelDossierMap = dynamic(
  () => import("@/src/components/ui/ParcelDossierMap"),
  { ssr: false }
);

import PageLoader from "@/src/components/ui/PageLoader";
import { getDossierComite } from "@/src/lib/api";
import { formatFCFA, scoreColor } from "@/src/lib/utils";
import type {
  DossierComiteAlert,
  DossierComiteData,
  DossierComiteCreditHistoryItem,
  DossierComiteDocument,
  DossierComiteParcel,
} from "@/src/types";

function Card({
  title,
  children,
  right,
}: {
  title: string;
  children: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl bg-bg-secondary p-6"
      style={{ border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="label-xs">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

function valueOfNumber(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function extractBreakdownComponent(
  breakdown: Record<string, unknown>,
  details: Record<string, unknown>,
  key: string
): { score: number | null; label: string; explanation: string } {
  const candidates = [breakdown[key.toUpperCase()], breakdown[key.toLowerCase()], details[key.toLowerCase()]];
  for (const val of candidates) {
    if (val === undefined || val === null) continue;
    if (typeof val === "number" && Number.isFinite(val)) return { score: val, label: "", explanation: "" };
    if (typeof val === "object" && !Array.isArray(val)) {
      const obj = val as Record<string, unknown>;
      if (typeof obj.score === "number" && Number.isFinite(obj.score)) {
        return {
          score: obj.score,
          label: typeof obj.label === "string" ? obj.label.trim() : "",
          explanation: typeof obj.explanation === "string" ? obj.explanation.trim() : "",
        };
      }
    }
  }
  return { score: null, label: "", explanation: "" };
}

function valueOfString(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "";
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function documentsList(value: unknown): DossierComiteDocument[] {
  return Array.isArray(value) ? (value as DossierComiteDocument[]) : [];
}

function parcelsList(value: unknown): DossierComiteParcel[] {
  return Array.isArray(value) ? (value as DossierComiteParcel[]) : [];
}

function alertsList(value: unknown): DossierComiteAlert[] {
  return Array.isArray(value) ? (value as DossierComiteAlert[]) : [];
}

function creditHistoryList(value: unknown): DossierComiteCreditHistoryItem[] {
  return Array.isArray(value) ? (value as DossierComiteCreditHistoryItem[]) : [];
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("fr-FR");
}

function getNdviStatus(ndvi?: number): { label: string; color: string } {
  if (ndvi == null) return { label: "Inconnu", color: "#94a3b8" };
  if (ndvi >= 0.6) return { label: "OPTIMAL", color: "#10b981" };
  if (ndvi >= 0.4) return { label: "BON", color: "#34d399" };
  if (ndvi >= 0.2) return { label: "MODÉRÉ", color: "#f59e0b" };
  return { label: "CRITIQUE", color: "#ef4444" };
}

function riskTone(level: string): string {
  const normalized = level.trim().toUpperCase();
  if (["LOW", "FAIBLE", "BON"].includes(normalized)) return "#10b981";
  if (["MEDIUM", "MOYEN"].includes(normalized)) return "#f59e0b";
  if (["HIGH", "CRITICAL", "ELEVE", "ÉLEVÉ"].includes(normalized)) return "#ef4444";
  return "#94a3b8";
}

function normalizeDossierError(err: unknown): string {
  const message = err instanceof Error ? err.message.trim() : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("session expirée") ||
    normalized.includes("session expiree") ||
    normalized.includes("401")
  ) {
    return "Session expirée, veuillez vous reconnecter.";
  }

  if (
    normalized.includes("accès non autorisé") ||
    normalized.includes("acces non autorise") ||
    normalized.includes("403")
  ) {
    return "Accès non autorisé";
  }

  if (
    normalized.includes("route not found") ||
    normalized.includes("404") ||
    normalized.includes("not found")
  ) {
    return "Dossier indisponible";
  }

  return "Une erreur est survenue lors du chargement du dossier.";
}

export default function DossierComitePage() {
  const params = useParams();
  const locale = (params.locale as string) ?? "fr";
  const farmerId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<DossierComiteData | null>(null);
  const [geoParcel, setGeoParcel] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const data = await getDossierComite(farmerId);
        setDossier(data);
      } catch (err) {
        setError(normalizeDossierError(err));
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, [farmerId]);

  const farmer = useMemo(
    () => ((dossier?.farmer ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const cooperative = useMemo(
    () => ((dossier?.cooperative ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const kyc = useMemo(
    () => ((dossier?.kyc ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const score = useMemo(
    () => ((dossier?.score ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const credit = useMemo(
    () => ((dossier?.credit ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const agronomicMonitoring = useMemo(
    () => ((dossier?.agronomicMonitoring ?? {}) as Record<string, unknown>),
    [dossier]
  );
  const committeeReadiness = useMemo(
    () => ((dossier?.committeeReadiness ?? {}) as Record<string, unknown>),
    [dossier]
  );

  const fullName =
    valueOfString(farmer, ["fullName"]) ||
    `${valueOfString(farmer, ["firstName", "prenom"])} ${valueOfString(farmer, ["lastName", "nom"])}`
      .trim() ||
    `Farmer ${farmerId.slice(0, 8).toUpperCase()}`;
  const region =
    valueOfString(farmer, ["region"]) || valueOfString(cooperative, ["region"]) || "—";
  const coopName =
    valueOfString(cooperative, ["name", "nom"]) ||
    valueOfString(farmer, ["cooperativeName", "cooperativeId"]) ||
    "—";

  const scoreValue =
    valueOfNumber(score, ["score"]) ??
    valueOfNumber(farmer, ["score"]) ??
    null;
  const breakdown = ((score.scoreBreakdown ?? score.breakdown ?? {}) as Record<string, unknown>);
  const scoreDetails = ((score.details ?? {}) as Record<string, unknown>);
  const riskLevel = valueOfString(score, ["riskLevel", "label"]) || "—";
  const readinessStatus =
    valueOfString(score, ["readinessStatus"]) ||
    valueOfString(committeeReadiness, ["status"]) ||
    "—";
  const confidenceLevel =
    score.confidenceLevel != null ? String(score.confidenceLevel) : "—";
  const positiveFactors = stringList(score.positiveFactors);
  const riskFactors = stringList(score.riskFactors);

  const kycDocuments = documentsList(kyc.documents);
  const missingItems = stringList(kyc.missingItems);
  const parcels = parcelsList(dossier?.parcels);
  const monitoringAlerts = alertsList(agronomicMonitoring.alerts);
  const creditHistory = creditHistoryList(credit.history);
  const activeRequest = ((credit.activeRequest ?? {}) as Record<string, unknown>);
  const readinessCompleted = stringList(committeeReadiness.completedItems);
  const readinessMissing = stringList(committeeReadiness.missingRequiredItems);

  const suggestedAmountDisplay = (() => {
    const min = valueOfNumber(credit, ["suggestedAmountMin"]) ?? valueOfNumber(score, ["montantMin"]);
    const max = valueOfNumber(credit, ["suggestedAmountMax"]) ?? valueOfNumber(score, ["montantMax"]);
    const single = valueOfNumber(credit, ["suggestedAmount"]);
    if (min != null && max != null) return `${formatFCFA(min)} – ${formatFCFA(max)}`;
    if (min != null) return formatFCFA(min);
    if (max != null) return formatFCFA(max);
    if (single != null) return formatFCFA(single);
    return "—";
  })();

  async function handleExportPDF() {
    if (!dossier) return;

    const esc = (s: unknown): string =>
      String(s ?? "—")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const generatedAt = new Date().toLocaleDateString("fr-FR", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    let logoSrc = "";
    try {
      const resp = await fetch("/wakama-logo.png");
      if (resp.ok) {
        const blob = await resp.blob();
        logoSrc = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      }
    } catch {
      // logo unavailable — omitted from PDF
    }

    const c1 = extractBreakdownComponent(breakdown, scoreDetails, "c1");
    const c2 = extractBreakdownComponent(breakdown, scoreDetails, "c2");
    const c3 = extractBreakdownComponent(breakdown, scoreDetails, "c3");
    const c4 = extractBreakdownComponent(breakdown, scoreDetails, "c4");

    const cRow = (lbl: string, cx: { score: number | null; label: string; explanation: string }) =>
      `<tr>
        <td style="font-weight:700;text-align:center">${esc(lbl)}</td>
        <td class="sc">${cx.score ?? "—"}</td>
        <td>${esc(cx.label || "—")}</td>
        <td style="color:#475569;font-size:8pt">${esc(cx.explanation || "—")}</td>
      </tr>`;

    const parcelsRows = parcels.map((parcel, i) => {
      const p = parcel as Record<string, unknown>;
      const sup = valueOfNumber(p, ["superficie", "surface", "area"]);
      const stadeVal = String(p.stade ?? p.stage ?? "—");
      const ndviStatus = getNdviStatus(parcel.ndvi);
      const hasGeo =
        (typeof p.polygone === "string" && (p.polygone as string).trim().length > 0) ||
        (typeof p.lat === "number" && typeof p.lng === "number");
      return `<tr>
        <td>${esc(parcel.culture ?? parcel.name ?? `Parcelle ${i + 1}`)}</td>
        <td class="mono tr">${sup != null ? `${sup.toFixed(1)} ha` : "—"}</td>
        <td class="mono tc">${parcel.ndvi != null ? parcel.ndvi.toFixed(3) : "—"}</td>
        <td class="tc"><span style="color:${ndviStatus.color};font-weight:700;font-size:7.5pt">${esc(ndviStatus.label)}</span></td>
        <td>${esc(stadeVal)}</td>
        <td>${esc(formatDate(p.datePlantation))}</td>
        <td class="tc">${hasGeo ? "✓" : "—"}</td>
      </tr>`;
    }).join("");

    const kycRows = kycDocuments.map((doc) => {
      const label = doc.label || doc.name || doc.type || "Document";
      const present = doc.present ?? doc.status === "PRESENT";
      return `<tr>
        <td>${esc(label)}</td>
        <td style="color:${present ? "#16a34a" : "#dc2626"};font-weight:600">${present ? "Présent" : "Manquant"}</td>
      </tr>`;
    }).join("");

    const alertsHtml =
      monitoringAlerts.length > 0
        ? monitoringAlerts
            .map(
              (a) =>
                `<div style="margin-bottom:6px;padding:6px 8px;background:#fefce8;border-left:3px solid #f59e0b;border-radius:3px">
                  <strong>${esc(a.title || a.type || "Alerte")}</strong>
                  ${a.severity ? `<span style="color:#64748b;font-size:7.5pt;margin-left:6px">(${esc(a.severity)})</span>` : ""}
                  <br><span style="color:#475569">${esc(a.message || "")}</span>
                </div>`
            )
            .join("")
        : `<p style="color:#94a3b8;font-size:8.5pt">Aucune alerte agronomique.</p>`;

    const creditHistoryHtml =
      creditHistory.length > 0
        ? `<table>
            <thead><tr><th>Statut</th><th>Date</th><th>Montant</th></tr></thead>
            <tbody>${creditHistory
              .map((item) => {
                const amount = item.montant ?? item.amount;
                return `<tr>
                  <td>${esc(item.status ?? "—")}</td>
                  <td>${esc(formatDate(item.createdAt ?? item.updatedAt))}</td>
                  <td style="font-family:monospace">${typeof amount === "number" ? esc(formatFCFA(amount)) : "—"}</td>
                </tr>`;
              })
              .join("")}</tbody>
          </table>`
        : `<p style="color:#94a3b8;font-size:8.5pt">Aucun historique crédit.</p>`;

    const activeReqAmount = valueOfNumber(activeRequest, ["montant", "amount"]);
    const activeReqStatus = valueOfString(activeRequest, ["statut", "status"]);
    const ndviAvg = valueOfNumber(agronomicMonitoring, ["ndviAverage"]);
    const kycStatus = valueOfString(kyc, ["status"]);

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Dossier Comité — ${esc(fullName)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  @page{size:A4 portrait;margin:12mm}
  body{font-family:Arial,'Helvetica Neue',sans-serif;font-size:9pt;color:#1e293b;background:white;line-height:1.5;padding-bottom:18mm}
  @media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  .bh{display:flex;align-items:center;justify-content:space-between;padding-bottom:9px;border-bottom:2.5px solid #0f3d2e;margin-bottom:5px}
  .bl{display:flex;flex-direction:column;gap:2px}
  .bl img{width:92px;height:auto;max-height:42px;object-fit:contain;display:block}
  .btag{font-size:7pt;color:#64748b;letter-spacing:0.3px}
  .br{text-align:right}
  .dt{font-size:14pt;font-weight:800;color:#0f3d2e;letter-spacing:-0.2px}
  .fn{font-size:10.5pt;font-weight:600;color:#1e293b;margin-top:1px}
  .dm{font-size:8pt;color:#475569;margin-top:2px}
  .dd{font-size:7.5pt;color:#64748b;margin-top:1px}
  .cbar{background:#fffbeb;border:1px solid #fcd34d;border-radius:3px;padding:5px 10px;font-size:8pt;color:#78350f;margin:5px 0 10px;text-align:center}
  .section{margin-bottom:13px}
  .st{font-size:8.5pt;font-weight:700;color:#0f3d2e;border-bottom:1.5px solid #bbf7d0;padding-bottom:3px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px}
  .sh{text-align:center;padding:10px 0;margin-bottom:8px;border:1.5px solid #bbf7d0;border-radius:5px;background:#f0fdf4}
  .sh .sl{font-size:7.5pt;color:#166534;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:2px}
  .sh .sv{font-size:34pt;font-weight:800;color:#0f3d2e;line-height:1;font-family:'Courier New',monospace}
  .ah{margin-top:7px;padding:8px 12px;background:#0f3d2e;border-radius:4px;display:flex;align-items:center;justify-content:space-between}
  .ah .al{font-size:7pt;color:#86efac;text-transform:uppercase;letter-spacing:0.4px}
  .ah .av{font-size:12pt;font-weight:700;color:white;font-family:'Courier New',monospace}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .g3{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  .stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:4px;padding:6px 9px}
  .lbl{font-size:7pt;color:#64748b;text-transform:uppercase;letter-spacing:0.3px;margin-bottom:2px}
  .val{font-size:10pt;font-weight:700;color:#0f172a;font-family:'Courier New',monospace}
  .sub{font-size:7.5pt;color:#64748b;margin-top:1px}
  table{width:100%;border-collapse:collapse;font-size:8.5pt;border:1px solid #e2e8f0}
  th{background:#f1f5f9;color:#334155;font-size:7.5pt;text-transform:uppercase;letter-spacing:0.3px;padding:5px 8px;text-align:left;border-bottom:1.5px solid #cbd5e1;border-right:1px solid #e2e8f0}
  td{padding:5px 8px;border-bottom:1px solid #f1f5f9;border-right:1px solid #f1f5f9;color:#1e293b;vertical-align:middle}
  th:last-child,td:last-child{border-right:none}
  tr:last-child td{border-bottom:none}
  .tc{text-align:center}
  .tr{text-align:right}
  .mono{font-family:'Courier New',monospace}
  .sc{font-size:11pt;font-weight:800;font-family:'Courier New',monospace;color:#0f3d2e;text-align:center}
  .fi{display:flex;gap:5px;margin-bottom:3px;font-size:8.5pt;line-height:1.4}
  .mi{padding:3px 8px;background:#fef2f2;border-left:2px solid #f87171;border-radius:2px;font-size:8.5pt;color:#991b1b;margin-bottom:3px}
  .ci{padding:3px 8px;background:#f0fdf4;border-left:2px solid #86efac;border-radius:2px;font-size:8.5pt;color:#166534;margin-bottom:3px}
  .shdr{font-size:7.5pt;font-weight:700;margin-bottom:4px;padding-bottom:2px}
  .alert-item{margin-bottom:5px;padding:5px 8px;background:#fefce8;border-left:3px solid #f59e0b;border-radius:2px;font-size:8.5pt}
  .pb{page-break-before:always;padding-top:2px}
  .footer{position:fixed;bottom:0;left:0;right:0;padding:4px 12mm;border-top:1.5px solid #bbf7d0;background:white;font-size:7pt;color:#64748b;display:flex;justify-content:space-between;align-items:center}
  .footer .fw{color:#0f3d2e;font-weight:700}
  @media screen{body{max-width:820px;margin:0 auto;padding:24px;background:#f9f9f9;padding-bottom:32px}.footer{position:static;margin-top:20px;padding:6px 0}}
</style>
</head>
<body>

<div class="bh">
  <div class="bl">
    ${logoSrc ? `<img src="${logoSrc}" alt="Wakama">` : ""}
    <span class="btag">Infrastructure de crédit agricole</span>
  </div>
  <div class="br">
    <div class="dt">Dossier Comité Crédit</div>
    <div class="fn">${esc(fullName)}</div>
    <div class="dm">${esc(coopName)}&nbsp;·&nbsp;${esc(region)}</div>
    <div class="dd">Généré le ${esc(generatedAt)}</div>
  </div>
</div>
<div class="cbar">⚠ Décision finale réservée à l'institution — Document non décisionnel</div>

<div class="section">
  <div class="st">A — Résumé exécutif</div>
  <div class="sh">
    <div class="sl">Score global Wakama</div>
    <div class="sv">${scoreValue ?? "—"}</div>
  </div>
  <div class="g2">
    <div class="stat"><div class="lbl">Niveau de risque</div><div class="val" style="font-size:9pt">${esc(riskLevel)}</div></div>
    <div class="stat"><div class="lbl">Readiness comité</div><div class="val" style="font-size:9pt">${esc(readinessStatus)}</div></div>
    <div class="stat"><div class="lbl">Confidence level</div><div class="val" style="font-size:9pt">${esc(confidenceLevel)}</div></div>
    <div class="stat"><div class="lbl">Crédit demandé</div><div class="val" style="font-size:9pt">${Object.keys(activeRequest).length > 0 ? esc(activeReqStatus || "Présent") : "Aucun"}</div>${activeReqAmount != null ? `<div class="sub">${esc(formatFCFA(activeReqAmount))}</div>` : ""}</div>
  </div>
  <div class="ah">
    <div class="al">Montant suggéré</div>
    <div class="av">${esc(suggestedAmountDisplay)}</div>
  </div>
</div>

<div class="section">
  <div class="st">B — Score explicable 4C</div>
  <table>
    <thead><tr><th style="width:8%">Critère</th><th style="width:9%">Score</th><th style="width:24%">Label</th><th>Explication</th></tr></thead>
    <tbody>${cRow("C1", c1)}${cRow("C2", c2)}${cRow("C3", c3)}${cRow("C4", c4)}</tbody>
  </table>
  ${positiveFactors.length > 0 || riskFactors.length > 0 ? `
  <div class="g2" style="margin-top:8px;gap:10px">
    <div>
      <div class="shdr" style="color:#166534;border-bottom:1px solid #bbf7d0">✅ Facteurs positifs</div>
      ${positiveFactors.length > 0 ? positiveFactors.map((f) => `<div class="fi"><span style="color:#16a34a;flex-shrink:0">•</span><span>${esc(f)}</span></div>`).join("") : "<span style='color:#94a3b8;font-size:8pt'>—</span>"}
    </div>
    <div>
      <div class="shdr" style="color:#991b1b;border-bottom:1px solid #fca5a5">⚠ Facteurs de risque</div>
      ${riskFactors.length > 0 ? riskFactors.map((f) => `<div class="fi"><span style="color:#dc2626;flex-shrink:0">•</span><span>${esc(f)}</span></div>`).join("") : "<span style='color:#94a3b8;font-size:8pt'>—</span>"}
    </div>
  </div>` : ""}
</div>

<div class="section pb">
  <div class="st">C — KYC</div>
  <div style="margin-bottom:7px;font-size:9pt">Statut KYC :&nbsp;<strong>${esc(kycStatus || "—")}</strong></div>
  ${kycDocuments.length > 0 ? `<table><thead><tr><th>Document</th><th style="width:18%">Présence</th></tr></thead><tbody>${kycRows}</tbody></table>` : ""}
  ${missingItems.length > 0 ? `<div style="margin-top:7px"><div class="shdr" style="color:#991b1b">Éléments manquants</div>${missingItems.map((i) => `<div class="mi">${esc(i)}</div>`).join("")}</div>` : ""}
</div>

<div class="section">
  <div class="st">D — Parcelles (${parcels.length})</div>
  ${parcels.length > 0 ? `
  <table>
    <thead><tr><th>Culture</th><th class="tr">Superficie</th><th class="tc">NDVI</th><th class="tc">État NDVI</th><th>Stade</th><th>Depuis</th><th class="tc">GPS</th></tr></thead>
    <tbody>${parcelsRows}</tbody>
  </table>` : `<p style="color:#94a3b8;font-size:8.5pt">Aucune parcelle.</p>`}
</div>

<div class="section pb">
  <div class="st">E — Monitoring agricole</div>
  <div class="stat" style="display:inline-block;margin-bottom:8px;min-width:120px">
    <div class="lbl">NDVI moyen</div>
    <div class="val">${ndviAvg != null ? ndviAvg.toFixed(3) : "—"}</div>
  </div>
  ${alertsHtml}
</div>

<div class="section">
  <div class="st">F — Crédit</div>
  <div class="g2" style="margin-bottom:9px">
    <div class="stat"><div class="lbl">Montant suggéré</div><div class="val" style="font-size:8.5pt">${esc(suggestedAmountDisplay)}</div></div>
    <div class="stat"><div class="lbl">Crédits historisés</div><div class="val">${creditHistory.length}</div></div>
  </div>
  ${creditHistoryHtml}
</div>

<div class="section">
  <div class="st">G — Committee Readiness</div>
  <div class="g2" style="margin-bottom:9px">
    <div class="stat"><div class="lbl">Status</div><div class="val" style="font-size:9pt">${esc(valueOfString(committeeReadiness, ["status"]) || "—")}</div></div>
    <div class="stat"><div class="lbl">Score readiness</div><div class="val">${valueOfNumber(committeeReadiness, ["score"]) ?? "—"}</div></div>
  </div>
  <div class="g2">
    <div>
      <div class="shdr" style="color:#166534;border-bottom:1px solid #bbf7d0">✅ Complétés</div>
      ${readinessCompleted.length > 0 ? readinessCompleted.map((i) => `<div class="ci">${esc(i)}</div>`).join("") : "<p style='color:#94a3b8;font-size:8.5pt'>—</p>"}
    </div>
    <div>
      <div class="shdr" style="color:#991b1b;border-bottom:1px solid #fca5a5">⚠ Manquants bloquants</div>
      ${readinessMissing.length > 0 ? readinessMissing.map((i) => `<div class="mi">${esc(i)}</div>`).join("") : "<p style='color:#94a3b8;font-size:8.5pt'>—</p>"}
    </div>
  </div>
</div>

<div class="footer">
  <span class="fw">Wakama</span>
  <span>Infrastructure de crédit agricole — Support d'aide à la décision, non décisionnel</span>
  <span>Généré le ${esc(generatedAt)}</span>
</div>
<script>window.onload=function(){window.print()};<\/script>
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) {
      alert("Popup bloqué — autorisez les popups pour ce site et réessayez.");
      return;
    }
    win.document.write(html);
    win.document.close();
  }

  if (loading) {
    return <PageLoader message="Chargement du dossier comité…" />;
  }

  if (error || !dossier) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl bg-bg-secondary p-6 text-center" style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="material-symbols-outlined text-red-400" style={{ fontSize: 42 }}>
            error
          </span>
          <p className="mt-3 text-base font-medium text-text-primary">
            {error === "Session expirée, veuillez vous reconnecter."
              ? "Session expirée"
              : error === "Accès non autorisé"
              ? "Accès non autorisé"
              : error === "Dossier indisponible"
                ? "Dossier indisponible"
                : "Dossier comité indisponible"}
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            {error ?? "Une erreur est survenue lors du chargement du dossier."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <Link
              href={`/${locale}/farmers/${farmerId}`}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Retour à la fiche
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    {geoParcel && <ParcelDossierMap parcel={geoParcel} onClose={() => setGeoParcel(null)} />}
    <div className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2 text-sm text-text-secondary">
            <Link href={`/${locale}/farmers`} className="hover:text-text-primary transition-colors">
              Agriculteurs
            </Link>
            <span>›</span>
            <Link
              href={`/${locale}/farmers/${farmerId}`}
              className="hover:text-text-primary transition-colors"
            >
              Fiche farmer
            </Link>
            <span>›</span>
            <span className="text-text-primary">Dossier comité</span>
          </div>
          <h1 className="text-lg font-bold text-text-primary">Dossier comité</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Support de lecture pour comité de crédit MFI.
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="rounded-lg bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
            >
              Exporter PDF
            </button>
            <Link
              href={`/${locale}/farmers/${farmerId}`}
              className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Retour à la fiche
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            Astuce PDF : désactivez &quot;En-têtes et pieds de page&quot; dans la fenêtre d&apos;impression pour masquer l&apos;URL du navigateur.
          </p>
        </div>
      </div>

      <Card
        title="Header"
        right={
          readinessStatus !== "—" ? (
            <span className="rounded-full border border-cyan-800 bg-cyan-500/10 px-2.5 py-0.5 text-xs font-medium text-cyan-300">
              {readinessStatus}
            </span>
          ) : null
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <p className="text-lg font-semibold text-text-primary">{fullName}</p>
            <p className="mt-1 text-sm text-text-secondary">{coopName}</p>
            <p className="mt-1 text-xs text-text-muted">{region}</p>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">Score global</p>
            <p className="mt-1 text-lg font-bold font-mono" style={{ color: scoreValue != null ? scoreColor(scoreValue) : "#94a3b8" }}>
              {scoreValue ?? "—"}
            </p>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">Risk level</p>
            <p className="mt-1 text-sm font-semibold" style={{ color: riskTone(riskLevel) }}>
              {riskLevel}
            </p>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">Readiness</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">{readinessStatus}</p>
          </div>
        </div>
      </Card>

      <Card title="Score explicable">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {(["c1", "c2", "c3", "c4"] as const).map((key) => {
                const cx = extractBreakdownComponent(breakdown, scoreDetails, key);
                return (
                  <div key={key} className="rounded-lg bg-bg-tertiary p-4">
                    <p className="text-xs text-text-muted">{key.toUpperCase()}</p>
                    <p className="mt-1 font-mono text-base font-semibold text-text-primary">
                      {cx.score ?? "—"}
                    </p>
                    {cx.label && <p className="mt-1 text-xs text-text-secondary">{cx.label}</p>}
                    {cx.explanation && <p className="mt-1 text-xs text-text-muted">{cx.explanation}</p>}
                  </div>
                );
              })}
            </div>
            <div className="rounded-lg bg-bg-tertiary p-4">
              <p className="text-xs text-text-muted">Confidence level</p>
              <p className="mt-1 text-sm font-medium text-text-primary">{confidenceLevel}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div className="rounded-lg bg-bg-tertiary p-4">
              <p className="mb-2 text-xs text-text-muted">Positive factors</p>
              {positiveFactors.length > 0 ? (
                <ul className="space-y-1.5">
                  {positiveFactors.map((factor) => (
                    <li key={factor} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="mt-0.5 text-emerald-400">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">Aucun facteur positif détaillé.</p>
              )}
            </div>
            <div className="rounded-lg bg-bg-tertiary p-4">
              <p className="mb-2 text-xs text-text-muted">Risk factors</p>
              {riskFactors.length > 0 ? (
                <ul className="space-y-1.5">
                  {riskFactors.map((factor) => (
                    <li key={factor} className="flex items-start gap-2 text-sm text-text-secondary">
                      <span className="mt-0.5 text-red-400">•</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-text-muted">Aucun facteur de risque détaillé.</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card title="KYC">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p className="text-xs text-text-muted">Statut</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {valueOfString(kyc, ["status"]) || "—"}
            </p>

            <div className="mt-4 space-y-2">
              {kycDocuments.length > 0 ? (
                kycDocuments.map((document, index) => {
                  const label = document.label || document.name || document.type || `Document ${index + 1}`;
                  const present = document.present ?? document.status === "PRESENT";
                  return (
                    <div
                      key={`${label}-${index}`}
                      className="flex items-center justify-between rounded-lg bg-bg-tertiary px-3 py-2"
                    >
                      <span className="text-sm text-text-secondary">{label}</span>
                      <span className={present ? "text-emerald-400" : "text-red-400"}>
                        {present ? "Présent" : "Manquant"}
                      </span>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-text-muted">Aucun détail KYC disponible.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="mb-2 text-xs text-text-muted">Missing items</p>
            {missingItems.length > 0 ? (
              <ul className="space-y-2">
                {missingItems.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-0.5 text-red-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Aucun élément manquant signalé.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Parcelles">
        {parcels.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800/60">
                  {["Culture", "Superficie", "NDVI", "État NDVI", "Stade", "Depuis", "Géolocalisation"].map((label) => (
                    <th key={label} className="pb-2.5 pr-4 text-left text-xs font-medium uppercase tracking-wide text-text-muted last:pr-0">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {parcels.map((parcel, index) => (
                  <tr key={`${parcel.id ?? parcel.name ?? "parcel"}-${index}`}>
                    <td className="py-3 pr-4 text-text-primary">{parcel.culture ?? parcel.name ?? "—"}</td>
                    <td className="py-3 pr-4 font-mono text-text-secondary">
                      {(() => {
                        const p = parcel as Record<string, unknown>;
                        const v = valueOfNumber(p, ["superficie", "surface", "area"]);
                        return v != null ? `${v.toFixed(1)} ha` : "—";
                      })()}
                    </td>
                    <td className="py-3 pr-4 font-mono text-text-secondary">
                      {typeof parcel.ndvi === "number" ? parcel.ndvi.toFixed(3) : "—"}
                    </td>
                    <td className="py-3 pr-4">
                      {(() => {
                        const { label, color } = getNdviStatus(parcel.ndvi);
                        return <span className="text-xs font-semibold" style={{ color }}>{label}</span>;
                      })()}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {(parcel as Record<string, unknown>).stade as string ?? (parcel as Record<string, unknown>).stage as string ?? "—"}
                    </td>
                    <td className="py-3 pr-4 text-text-secondary">
                      {formatDate((parcel as Record<string, unknown>).datePlantation)}
                    </td>
                    <td className="py-3">
                      {(() => {
                        const p = parcel as Record<string, unknown>;
                        const hasPolygon = typeof p.polygone === "string" && (p.polygone as string).trim().length > 0;
                        const hasPoint = typeof p.lat === "number" && typeof p.lng === "number";
                        if (hasPolygon || hasPoint) {
                          return (
                            <button
                              onClick={() => setGeoParcel(p)}
                              className="text-xs text-cyan-400 underline transition-colors hover:text-cyan-300"
                            >
                              {hasPolygon ? "Afficher sur la carte" : "Voir point GPS"}
                            </button>
                          );
                        }
                        return <span className="text-text-muted">—</span>;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-text-muted">Aucune parcelle remontée dans le dossier comité.</p>
        )}
      </Card>

      <Card title="Monitoring agricole">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">NDVI moyen</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {valueOfNumber(agronomicMonitoring, ["ndviAverage"])?.toFixed(3) ?? "—"}
            </p>
          </div>
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="mb-2 text-xs text-text-muted">Alertes</p>
            {monitoringAlerts.length > 0 ? (
              <div className="space-y-2">
                {monitoringAlerts.map((alert, index) => (
                  <div key={`${alert.id ?? alert.title ?? "alert"}-${index}`} className="rounded-lg border border-gray-800 px-3 py-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-text-primary">
                        {alert.title || alert.type || `Alerte ${index + 1}`}
                      </p>
                      {alert.severity && (
                        <span className="text-xs text-text-muted">{alert.severity}</span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">{alert.message || "—"}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Aucune alerte agronomique signalée.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Crédit">
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-lg bg-bg-tertiary p-4 xl:col-span-2">
            <p className="mb-3 text-xs text-text-muted">Historique</p>
            {creditHistory.length > 0 ? (
              <div className="space-y-2">
                {creditHistory.map((item, index) => {
                  const amount = item.montant ?? item.amount;
                  return (
                    <div key={`${item.id ?? "history"}-${index}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-text-primary">{item.status ?? "Historique crédit"}</p>
                        <p className="text-xs text-text-muted">{formatDate(item.createdAt ?? item.updatedAt)}</p>
                      </div>
                      <span className="font-mono text-sm text-text-secondary">
                        {typeof amount === "number" ? formatFCFA(amount) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Aucun historique crédit disponible.</p>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-lg bg-bg-tertiary p-4">
              <p className="text-xs text-text-muted">Demande active</p>
              <p className="mt-1 text-sm font-semibold text-text-primary">
                {Object.keys(activeRequest).length > 0
                  ? valueOfString(activeRequest, ["statut", "status"]) || "Présente"
                  : "Aucune"}
              </p>
              {Object.keys(activeRequest).length > 0 && (
                <p className="mt-1 font-mono text-sm text-text-secondary">
                  {valueOfNumber(activeRequest, ["montant", "amount"]) != null
                    ? formatFCFA(valueOfNumber(activeRequest, ["montant", "amount"]) ?? 0)
                    : "Montant non renseigné"}
                </p>
              )}
            </div>
            <div className="rounded-lg bg-bg-tertiary p-4">
              <p className="text-xs text-text-muted">Montant suggéré</p>
              <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
                {suggestedAmountDisplay}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Committee Readiness">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="text-xs text-text-muted">Status</p>
            <p className="mt-1 text-sm font-semibold text-text-primary">
              {valueOfString(committeeReadiness, ["status"]) || "—"}
            </p>
            <p className="mt-3 text-xs text-text-muted">Score</p>
            <p className="mt-1 font-mono text-lg font-semibold text-text-primary">
              {valueOfNumber(committeeReadiness, ["score"]) ?? "—"}
            </p>
          </div>

          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="mb-2 text-xs text-text-muted">Completed items</p>
            {readinessCompleted.length > 0 ? (
              <ul className="space-y-1.5">
                {readinessCompleted.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-0.5 text-emerald-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Aucun item complété détaillé.</p>
            )}
          </div>

          <div className="rounded-lg bg-bg-tertiary p-4">
            <p className="mb-2 text-xs text-text-muted">Missing required items</p>
            {readinessMissing.length > 0 ? (
              <ul className="space-y-1.5">
                {readinessMissing.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="mt-0.5 text-red-400">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-text-muted">Aucun manque bloquant signalé.</p>
            )}
          </div>
        </div>
      </Card>

      <Card title="Notice conformité">
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
          <p className="text-sm text-text-secondary">
            {typeof dossier.complianceNotice === "string" && dossier.complianceNotice.trim()
              ? dossier.complianceNotice
              : "Décision finale réservée à l’institution. Le dossier comité constitue une aide à la décision. La validation finale reste du ressort exclusif de l’institution financière."}
          </p>
        </div>
      </Card>
    </div>
    </>
  );
}
