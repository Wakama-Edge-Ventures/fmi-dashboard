"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore, useState } from "react";

import { alerts as alertsApi } from "@/src/lib/api";
import { canMarkAlerts, clearAuth, getInstitutionRole, getStoredUser } from "@/src/lib/auth";
import { getTheme, setTheme, subscribeTheme, type Theme } from "@/src/lib/theme";

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

const PAGE_PARENTS: Record<string, string> = {
  "/farmers":      "Portefeuille",
  "/cooperatives": "Portefeuille",
  "/scoring":      "Portefeuille",
  "/credits":      "Portefeuille",
  "/ndvi":         "Analyse",
  "/alerts":       "Analyse",
  "/analytics":    "Analyse",
  "/reports":      "Système",
  "/settings":     "Système",
};

export default function Header() {
  const pathname = usePathname();
  const router   = useRouter();
  const userSnapshot = useSyncExternalStore(
    () => () => undefined,
    () => {
      const stored = getStoredUser();
      return stored?.email
        ? `${stored.email}::${getInstitutionRole()}`
        : "";
    },
    () => ""
  );
  const user = userSnapshot
    ? {
        email: userSnapshot.split("::")[0] ?? "",
        role: userSnapshot.split("::")[1] ?? "",
      }
    : null;
  const [unreadCount, setUnreadCount] = useState(0);
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "dark" as Theme);

  // Fetch unread alert count, then poll every 60 s
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function fetchCount() {
      if (!canMarkAlerts()) {
        setUnreadCount(0);
        return;
      }

      try {
        const list = await alertsApi.list({ unreadOnly: true });
        setUnreadCount(Array.isArray(list) ? list.length : 0);
      } catch {
        // silent
      }
    }

    void fetchCount();
    intervalRef.current = setInterval(() => void fetchCount(), 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function handleThemeToggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
  }

  const email    = user?.email ?? "";
  const role     = user?.role  ?? "";
  const initial  = email[0]?.toUpperCase() ?? "?";
  const username = email.split("@")[0] ?? "";

  const localeMatch  = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";
  const relativePath = pathname.slice(localePrefix.length) || "/dashboard";
  const basePath     = "/" + (relativePath.split("/")[1] ?? "");
  const title        = PAGE_TITLES[basePath] ?? "Wakama MFI";
  const parent       = PAGE_PARENTS[basePath];

  function handleLogout() {
    clearAuth();
    router.push(`${localePrefix}/login`);
  }

  // Icon btn shared style helper
  function iconBtnStyle(color?: string): React.CSSProperties {
    return {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      width: 28,
      height: 28,
      borderRadius: 6,
      background: "transparent",
      border: "none",
      cursor: "pointer",
      color: color ?? "var(--text-secondary)",
      transition: "background 150ms, color 150ms",
      flexShrink: 0,
    };
  }

  return (
    <header
      className="flex items-center justify-between shrink-0 px-5"
      style={{
        height: 48,
        background: "var(--bg-base)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Left: breadcrumb + title */}
      <div className="flex items-center gap-1.5">
        {parent && (
          <>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{parent}</span>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>·</span>
          </>
        )}
        <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)" }}>
          {title}
        </span>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          style={iconBtnStyle()}
          aria-label={theme === "dark" ? "Passer en mode clair" : "Passer en mode sombre"}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: "inherit",
              fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            }}
          >
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
        </button>

        {/* Bell */}
        <button
          className="relative flex items-center justify-center rounded-md"
          style={iconBtnStyle()}
          aria-label="Alertes"
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: "inherit",
              fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            }}
          >
            notifications
          </span>
          {unreadCount > 0 && (
            <span
              className="absolute flex items-center justify-center rounded-full text-white font-bold leading-none"
              style={{
                top: 2,
                right: 2,
                minWidth: 14,
                height: 14,
                fontSize: 9,
                paddingLeft: 3,
                paddingRight: 3,
                background: "#ef4444",
              }}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Avatar */}
        {user && (
          <div className="flex items-center gap-2">
            <div
              className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
              style={{ width: 28, height: 28, background: "#10b981", fontSize: 11 }}
            >
              {initial}
            </div>
            <div className="hidden sm:block">
              <p style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", lineHeight: 1 }}>
                {username}
              </p>
              <p style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.4, textTransform: "capitalize" }}>
                {role.toLowerCase()}
              </p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 rounded-md"
          style={{
            height: 28,
            paddingLeft: 10,
            paddingRight: 10,
            fontSize: 11,
            color: "var(--text-secondary)",
            background: "transparent",
            border: "1px solid var(--border)",
            cursor: "pointer",
            transition: "color 150ms, border-color 150ms, background 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-primary)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
            (e.currentTarget as HTMLButtonElement).style.background = "var(--border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
            (e.currentTarget as HTMLButtonElement).style.background = "transparent";
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 13,
              color: "inherit",
              fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
            }}
          >
            logout
          </span>
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </header>
  );
}
