interface KPICardProps {
  label: string;
  value: string | number;
  sub?: string;
  /** kept for API compat — no longer renders an icon */
  icon?: string;
  /** Positive = growth (green), negative = decline (red) */
  trend?: number;
  /** Optional hex color for the accent left-border */
  color?: string;
  /** Show accent 2px left border */
  accent?: boolean;
}

export default function KPICard({
  label,
  value,
  sub,
  trend,
  color,
  accent = false,
}: KPICardProps) {
  const trendUp  = trend !== undefined && trend >= 0;
  const trendAbs = trend !== undefined ? Math.abs(trend) : 0;

  return (
    <div
      style={{
        background: "#0d1423",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: accent
          ? `2px solid ${color ?? "#10b981"}`
          : "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* Top row: label + trend badge */}
      <div className="flex items-start justify-between gap-2">
        <p className="label-xs">{label}</p>
        {trend !== undefined && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 2,
              fontSize: 10,
              fontWeight: 500,
              padding: "2px 6px",
              borderRadius: 9999,
              background: trendUp
                ? "rgba(16,185,129,0.12)"
                : "rgba(239,68,68,0.12)",
              color: trendUp ? "#10b981" : "#ef4444",
              whiteSpace: "nowrap",
            }}
          >
            {trendUp ? "↑" : "↓"} {trendAbs}%
          </span>
        )}
      </div>

      {/* Value */}
      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
        <p
          className="mono"
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: "#e8edf5",
            lineHeight: 1,
          }}
        >
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: 11, color: "#5a6a85" }}>{sub}</p>
        )}
      </div>
    </div>
  );
}
