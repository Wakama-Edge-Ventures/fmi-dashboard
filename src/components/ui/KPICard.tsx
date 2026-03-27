interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon: string;
  /** Positive = growth (green arrow up), negative = decline (red arrow down) */
  trend?: number;
  /** Optional hex color or Tailwind CSS variable for the icon background */
  color?: string;
}

export default function KPICard({
  label,
  value,
  sub,
  icon,
  trend,
  color = "#10b981",
}: KPICardProps) {
  const trendUp = trend !== undefined && trend >= 0;
  const trendAbs = trend !== undefined ? Math.abs(trend) : 0;

  return (
    <div className="flex flex-col gap-4 rounded-xl bg-bg-secondary border border-gray-800 p-5 hover:border-gray-700 transition-colors">
      {/* Top row: label + icon */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-text-secondary leading-tight">
          {label}
        </p>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg shrink-0"
          style={{ backgroundColor: `${color}1a` }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 20, color }}
          >
            {icon}
          </span>
        </div>
      </div>

      {/* Value */}
      <div className="space-y-1">
        <p className="text-3xl font-bold text-text-primary font-mono leading-none">
          {value}
        </p>
        {sub && (
          <p className="text-xs text-text-muted">{sub}</p>
        )}
      </div>

      {/* Trend */}
      {trend !== undefined && (
        <div className="flex items-center gap-1">
          <span
            className="material-symbols-outlined"
            style={{
              fontSize: 16,
              color: trendUp ? "#10b981" : "#ef4444",
              fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
            }}
          >
            {trendUp ? "trending_up" : "trending_down"}
          </span>
          <span
            className="text-xs font-medium"
            style={{ color: trendUp ? "#10b981" : "#ef4444" }}
          >
            {trendUp ? "+" : "-"}{trendAbs}%
          </span>
          <span className="text-xs text-text-muted">vs mois dernier</span>
        </div>
      )}
    </div>
  );
}
