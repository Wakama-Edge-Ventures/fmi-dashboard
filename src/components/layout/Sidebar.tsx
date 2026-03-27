"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",    label: "Tableau de bord",      icon: "dashboard" },
  { href: "/farmers",      label: "Agriculteurs",         icon: "person" },
  { href: "/cooperatives", label: "Coopératives",         icon: "groups" },
  { href: "/scoring",      label: "Scoring & Risques",    icon: "grade" },
  { href: "/credits",      label: "Demandes de crédit",   icon: "request_quote" },
  { href: "/ndvi",         label: "NDVI Satellite",       icon: "satellite" },
  { href: "/alerts",       label: "Alertes",              icon: "notifications" },
  { href: "/analytics",    label: "Analytique",           icon: "bar_chart" },
  { href: "/reports",      label: "Rapports",             icon: "description" },
  { href: "/settings",     label: "Paramètres",           icon: "settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Extract locale prefix (e.g. "/en") from pathname
  const localeMatch = pathname.match(/^\/([a-z]{2})(\/|$)/);
  const localePrefix = localeMatch ? `/${localeMatch[1]}` : "";

  function isActive(href: string) {
    return pathname === `${localePrefix}${href}` ||
      pathname.startsWith(`${localePrefix}${href}/`);
  }

  return (
    <aside
      className="flex flex-col shrink-0 bg-bg-secondary border-r border-gray-800"
      style={{ width: 240 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-800">
        <div>
          <img src="/wakama-logo.png" alt="Wakama" className="h-8 w-auto" />
          <p className="text-xs text-text-muted leading-tight">MFI Dashboard</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={`${localePrefix}${item.href}`}
                  className={[
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    active
                      ? "bg-accent/10 text-accent"
                      : "text-text-secondary hover:bg-bg-hover hover:text-text-primary",
                  ].join(" ")}
                >
                  <span
                    className="material-symbols-outlined shrink-0"
                    style={{
                      fontSize: 20,
                      fontVariationSettings: active
                        ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20'
                        : '"FILL" 0, "wght" 400, "GRAD" 0, "opsz" 20',
                    }}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                  {item.href === "/alerts" && (
                    <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-alert-critical text-white text-xs font-bold px-1">
                      3
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-gray-800">
        <p className="text-xs text-text-muted text-center">
          © 2026 Wakama Edge Ventures
        </p>
      </div>
    </aside>
  );
}
