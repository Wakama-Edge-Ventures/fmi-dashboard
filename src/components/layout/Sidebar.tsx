"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { canEditScoringConfig, clearAuth } from "@/src/lib/auth";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  section?: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "Tableau de bord",    icon: "dashboard",       section: "Principal" },
  { href: "/farmers",      label: "Agriculteurs",       icon: "person",          section: "Portefeuille" },
  { href: "/cooperatives", label: "Coopératives",       icon: "groups" },
  { href: "/scoring",      label: "Scoring & Risques",  icon: "grade" },
  { href: "/credits",      label: "Crédits",            icon: "request_quote" },
  { href: "/ndvi",         label: "NDVI Satellite",     icon: "satellite_alt",   section: "Analyse" },
  { href: "/alerts",       label: "Alertes",            icon: "notifications" },
  { href: "/analytics",    label: "Analytiques",        icon: "bar_chart" },
  { href: "/reports",        label: "Rapports",           icon: "description",      section: "Système" },
  { href: "/scoring-config", label: "Configuration",     icon: "tune" },
  { href: "/settings",       label: "Paramètres",        icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const canEditConfig = useSyncExternalStore(
    () => () => undefined,
    canEditScoringConfig,
    () => true
  );

  const localeMatch  = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";

  function isActive(href: string) {
    return (
      pathname === `${localePrefix}${href}` ||
      pathname.startsWith(`${localePrefix}${href}/`)
    );
  }

  function handleLogout() {
    clearAuth();
    router.push(`${localePrefix}/login`);
  }

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.href === "/scoring-config" && !canEditConfig) {
      return false;
    }
    return true;
  });

  return (
    <aside
      className="flex flex-col shrink-0"
      style={{
        width: 220,
        background: "#080d18",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div
        className="flex items-center gap-2.5 px-4"
        style={{ height: 48, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <img src="/wakama-logo.png" alt="Wakama" style={{ height: 22, width: "auto" }} />
        <span
          className="label-xs"
          style={{ color: "rgba(90,106,133,0.8)", letterSpacing: "0.06em" }}
        >
          MFI Dashboard
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2">
        {visibleItems.map((item, idx) => {
          const active = isActive(item.href);
          const showSection =
            item.section &&
            (idx === 0 || visibleItems[idx - 1]?.section !== item.section);

          return (
            <div key={item.href}>
              {showSection && (
                <p
                  className="label-xs px-3 mt-4 mb-1"
                  style={{ color: "#3a4a60" }}
                >
                  {item.section}
                </p>
              )}
              <Link
                href={`${localePrefix}${item.href}`}
                className="flex items-center gap-2.5 px-3 rounded-md transition-colors"
                style={{
                  height: 34,
                  fontSize: 12,
                  fontWeight: 400,
                  color: active ? "#10b981" : "#5a6a85",
                  background: active
                    ? "rgba(16,185,129,0.1)"
                    : "transparent",
                  borderLeft: active
                    ? "2px solid #10b981"
                    : "2px solid transparent",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background =
                      "rgba(255,255,255,0.04)";
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "#e8edf5";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    (e.currentTarget as HTMLAnchorElement).style.background =
                      "transparent";
                    (e.currentTarget as HTMLAnchorElement).style.color =
                      "#5a6a85";
                  }
                }}
              >
                <span
                  className="material-symbols-outlined shrink-0"
                  style={{
                    fontSize: 16,
                    fontVariationSettings: active
                      ? '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 20'
                      : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
                    color: "inherit",
                  }}
                >
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className="px-2 py-3 space-y-0.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 rounded-md transition-colors"
          style={{
            height: 34,
            fontSize: 12,
            fontWeight: 400,
            color: "#5a6a85",
            background: "transparent",
            border: "none",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "rgba(255,255,255,0.04)";
            (e.currentTarget as HTMLButtonElement).style.color = "#e8edf5";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
            (e.currentTarget as HTMLButtonElement).style.color = "#5a6a85";
          }}
        >
          <span
            className="material-symbols-outlined shrink-0"
            style={{
              fontSize: 16,
              fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20',
              color: "inherit",
            }}
          >
            logout
          </span>
          <span className="truncate">Déconnexion</span>
        </button>
        <p
          className="text-center px-3"
          style={{ fontSize: 10, color: "#3a4a60", paddingTop: 4 }}
        >
          © 2026 Wakama Edge Ventures
        </p>
      </div>
    </aside>
  );
}
