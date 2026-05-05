import type { ScoreLevel } from "@/src/types";

// ─── Currency ─────────────────────────────────────────────────────────────────

/**
 * Format a number as West-African FCFA with space thousands separator.
 * e.g. 1500000 → "1 500 000 FCFA"
 */
export function formatFCFA(n: number): string {
  const formatted = Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, "\u202f"); // narrow no-break space
  return `${formatted} FCFA`;
}

// ─── Score ────────────────────────────────────────────────────────────────────

/**
 * Returns the Wakama score level for a given score (0-1000).
 */
export function scoreLevel(score: number): ScoreLevel {
  if (score >= 700) return "EXCELLENT";
  if (score >= 500) return "BON";
  if (score >= 300) return "MOYEN";
  return "FAIBLE";
}

/**
 * Returns the human-readable label for a score.
 */
export function scoreLabel(score: number): string {
  return scoreLevel(score);
}

/**
 * Returns the hex color for a given score.
 */
export function scoreColor(score: number): string {
  if (score >= 700) return "#10b981"; // excellent
  if (score >= 500) return "#f59e0b"; // good
  if (score >= 300) return "#f97316"; // medium
  return "#ef4444"; // low
}

/**
 * Returns Tailwind text color class for a given score.
 */
export function scoreTailwindClass(score: number): string {
  if (score >= 700) return "text-score-excellent";
  if (score >= 500) return "text-score-good";
  if (score >= 300) return "text-score-medium";
  return "text-score-low";
}

/**
 * Returns Tailwind badge classes (bg + border + text) for a given score.
 * Compatible with AlertBadge-style usage.
 */
export function formatScore(score: number): string {
  if (score >= 700) return "bg-emerald-500/10 text-emerald-400 border-emerald-800";
  if (score >= 500) return "bg-amber-500/10 text-amber-400 border-amber-800";
  if (score >= 300) return "bg-orange-500/10 text-orange-400 border-orange-800";
  return "bg-red-500/10 text-red-400 border-red-800";
}

// ─── Dates ────────────────────────────────────────────────────────────────────

/**
 * Returns a relative time string in French.
 * e.g. new Date() → "à l'instant"
 *      2h ago     → "il y a 2h"
 *      3 days ago → "il y a 3j"
 */
export function relativeTime(date: string | Date | undefined | null): string {
  if (!date) return "Date inconnue";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "Date invalide";
  const diffMs = Date.now() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "à l'instant";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `il y a ${diffD}j`;
  const diffM = Math.floor(diffD / 30);
  if (diffM < 12) return `il y a ${diffM} mois`;
  return `il y a ${Math.floor(diffM / 12)} an(s)`;
}

/**
 * Format a date as DD/MM/YYYY.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

/**
 * Convert an array of objects to a CSV string and trigger a browser download.
 */
export function exportCSV(
  rows: Record<string, unknown>[],
  filename = "export.csv"
): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = String(row[h] ?? "");
          return val.includes(",") ? `"${val.replace(/"/g, '""')}"` : val;
        })
        .join(",")
    ),
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

/**
 * Returns initials from a full name (nom + prenom).
 * "Koné Mamadou" → "KM"
 */
export function initials(nom: string = "", prenom: string = ""): string {
  return `${(nom ?? "")[0] ?? ""}${(prenom ?? "")[0] ?? ""}`.toUpperCase() || "?";
}

/**
 * Returns the display name for a farmer, handling all API field variants:
 * nom/prenom (French), firstName/lastName (camelCase), or fullName.
 * Falls back to "Agriculteur sans nom" if none are present.
 */
export function getFarmerDisplayName(farmer: {
  nom?: string;
  prenom?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
}): string {
  const nom    = farmer.nom?.trim()    ?? "";
  const prenom = farmer.prenom?.trim() ?? "";
  if (nom || prenom) return [prenom, nom].filter(Boolean).join(" ");

  const first = farmer.firstName?.trim() ?? "";
  const last  = farmer.lastName?.trim()  ?? "";
  if (first || last) return [first, last].filter(Boolean).join(" ");

  if (farmer.fullName?.trim()) return farmer.fullName.trim();

  return "Agriculteur sans nom";
}

/**
 * Returns initials for a farmer, using the same field priority as getFarmerDisplayName.
 */
export function getFarmerInitials(farmer: {
  nom?: string;
  prenom?: string;
  firstName?: string;
  lastName?: string;
}): string {
  const first = (farmer.prenom?.trim() || farmer.firstName?.trim() || "")[0] ?? "";
  const last  = (farmer.nom?.trim()    || farmer.lastName?.trim()  || "")[0] ?? "";
  return `${first}${last}`.toUpperCase() || "?";
}
