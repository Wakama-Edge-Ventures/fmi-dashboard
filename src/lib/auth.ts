const KEYS = {
  token: "wakama_token",
  legacyToken: "wakama_fmi_token",
  user: "wakama_user",
  instId: "wakama_fmi_institution_id",
  instName: "wakama_fmi_institution_name",
  instType: "wakama_fmi_institution_type",
  modules: "wakama_fmi_modules",
  role: "wakama_fmi_role",
  institutionRole: "wakama_fmi_institution_role",
  authFlash: "wakama_auth_flash",
} as const;

export interface StoredUser {
  email?: string;
  role?: string;
  institutionRole?: string;
  name?: string;
}

export interface PersistedInstitutionAuth {
  token: string;
  user?: StoredUser | null;
  role?: string | null;
  institutionRole?: string | null;
  institutionId?: string | null;
  institutionName?: string | null;
  institutionType?: string | null;
  modules?: string[] | null;
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

function ls(key: string): string | null {
  if (!canUseStorage()) return null;
  return localStorage.getItem(key);
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeRole(role?: string | null): string {
  return (role ?? "").trim().toUpperCase();
}

export function getAuthToken(): string | null {
  return ls(KEYS.token) ?? ls(KEYS.legacyToken);
}

export function getStoredUser(): StoredUser | null {
  return parseJson<StoredUser | null>(ls(KEYS.user), null);
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
  const parsed = parseJson<unknown>(ls(KEYS.modules), []);
  return Array.isArray(parsed)
    ? parsed.filter((value): value is string => typeof value === "string")
    : [];
}

export function hasModule(module: string): boolean {
  const expected = module.trim().toUpperCase();
  return getModules().some((value) => value.trim().toUpperCase() === expected);
}

export function getInstitutionRole(): string {
  const explicitRole = ls(KEYS.role);
  const explicitInstitutionRole = ls(KEYS.institutionRole);
  const user = getStoredUser();

  return normalizeRole(
    explicitRole ??
      explicitInstitutionRole ??
      user?.institutionRole ??
      user?.role ??
      ""
  );
}

export function isReadOnly(): boolean {
  return getInstitutionRole() === "READONLY";
}

export function canApproveCredit(): boolean {
  const role = getInstitutionRole();
  return ["SUPERADMIN", "INSTITUTION_ADMIN", "MFI_AGENT"].includes(role);
}

export function canEditScoringConfig(): boolean {
  const role = getInstitutionRole();
  return role === "SUPERADMIN" || role === "INSTITUTION_ADMIN";
}

export function canMarkAlerts(): boolean {
  return !isReadOnly();
}

export function getLoginPath(locale?: string | null): string {
  if (locale) return `/${locale}/login`;
  if (!canUseStorage()) return "/fr/login";

  const match = window.location.pathname.match(/^\/([a-z]{2})(\/|$)/);
  return `/${match ? match[1] : "fr"}/login`;
}

export function setAuthFlashMessage(message: string): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(KEYS.authFlash, message);
}

export function consumeAuthFlashMessage(): string | null {
  if (!canUseStorage()) return null;
  const message = sessionStorage.getItem(KEYS.authFlash);
  if (message) sessionStorage.removeItem(KEYS.authFlash);
  return message;
}

export function persistInstitutionAuthSession(data: PersistedInstitutionAuth): void {
  if (!canUseStorage()) return;

  const role = normalizeRole(data.role ?? data.institutionRole ?? data.user?.role ?? "");
  const institutionRole = normalizeRole(
    data.institutionRole ?? data.role ?? data.user?.institutionRole ?? data.user?.role ?? ""
  );
  const user: StoredUser = {
    ...(data.user ?? {}),
    role,
    institutionRole,
  };

  localStorage.setItem(KEYS.token, data.token);
  localStorage.setItem(KEYS.legacyToken, data.token);
  localStorage.setItem(KEYS.user, JSON.stringify(user));
  localStorage.setItem(KEYS.instId, data.institutionId ?? "");
  localStorage.setItem(KEYS.instName, data.institutionName ?? "");
  localStorage.setItem(KEYS.instType, data.institutionType ?? "");
  localStorage.setItem(KEYS.modules, JSON.stringify(data.modules ?? []));
  localStorage.setItem(KEYS.role, role);
  localStorage.setItem(KEYS.institutionRole, institutionRole);
}

export function clearAuth(): void {
  if (!canUseStorage()) return;

  Object.values(KEYS).forEach((key) => {
    if (key !== KEYS.authFlash) {
      localStorage.removeItem(key);
    }
  });
}
