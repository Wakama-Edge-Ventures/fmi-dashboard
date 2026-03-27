"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":    "Tableau de bord",
  "/farmers":      "Agriculteurs",
  "/cooperatives": "Coopératives",
  "/scoring":      "Scoring & Risques",
  "/credits":      "Demandes de crédit",
  "/ndvi":         "NDVI Satellite",
  "/alerts":       "Alertes",
  "/analytics":    "Analytique",
  "/reports":      "Rapports",
  "/settings":     "Paramètres",
};

interface User {
  email: string;
  role: string;
}

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  // All localStorage reads must be inside useEffect to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = localStorage.getItem("wakama_user");
      if (stored) setUser(JSON.parse(stored) as User);
    } catch {
      // ignore corrupted data
    }
  }, []);

  // Safe derived values — never crash on null/undefined
  const email = user?.email ?? "";
  const role = user?.role ?? "";
  const initial = email[0]?.toUpperCase() ?? "?";
  const username = email.split("@")[0] ?? "";

  // Derive page title from pathname
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const relativePath = pathname.slice(localePrefix.length) || "/dashboard";
  const basePath = "/" + (relativePath.split("/")[1] ?? "");
  const title = PAGE_TITLES[basePath] ?? "Wakama MFI";

  function handleLogout() {
    localStorage.removeItem("wakama_token");
    localStorage.removeItem("wakama_user");
    router.push(`${localePrefix}/login`);
  }

  return (
    <header
      className="flex items-center justify-between shrink-0 px-6 bg-bg-secondary border-b border-gray-800"
      style={{ height: 64 }}
    >
      {/* Page title */}
      <h1 className="text-lg font-semibold text-text-primary">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* Alerts bell */}
        <button
          className="relative flex items-center justify-center w-9 h-9 rounded-lg text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
          aria-label="Alertes"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
            notifications
          </span>
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-alert-critical" />
        </button>

        {/* User pill — only rendered after hydration when user is known */}
        {user && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-tertiary">
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-accent text-white text-xs font-bold">
              {initial}
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-text-primary leading-none">
                {username}
              </p>
              <p className="text-xs text-text-muted leading-tight capitalize">
                {role.toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            logout
          </span>
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
