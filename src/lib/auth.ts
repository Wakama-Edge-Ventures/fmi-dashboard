// ─── Institution auth helpers ─────────────────────────────────────────────────
// Reads institution data stored in localStorage after login.
// All functions are safe to call during SSR (return null/empty values).

const KEYS = {
  token:       "wakama_fmi_token",
  instId:      "wakama_fmi_institution_id",
  instName:    "wakama_fmi_institution_name",
  instType:    "wakama_fmi_institution_type",
  modules:     "wakama_fmi_modules",
} as const;

function ls(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

export function getInstitutionId(): string | null {
  return ls(KEYS.instId);
}

export function getInstitutionName(): string {
  return ls(KEYS.instName) ?? "";
}

export function getInstitutionType(): string {
  return ls(KEYS.instType) ?? "";
}

export function getModules(): string[] {
  const raw = ls(KEYS.modules);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function hasModule(module: string): boolean {
  return getModules().includes(module);
}

export function clearAuth(): void {
  if (typeof window === "undefined") return;
  Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  // Also clear legacy keys
  localStorage.removeItem("wakama_token");
  localStorage.removeItem("wakama_user");
}
