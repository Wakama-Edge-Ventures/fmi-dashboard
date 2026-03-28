"use client";

import type { NameType, ValueType } from "recharts/types/component/DefaultTooltipContent";

interface PayloadEntry {
  name?: NameType;
  value?: ValueType;
  color?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: PayloadEntry[];
  label?: string | number;
  formatter?: (value: ValueType, name: NameType) => [string, string];
  labelFormatter?: (label: string) => string;
}

export default function ChartTooltip({
  active,
  payload,
  label,
  formatter,
  labelFormatter,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const displayLabel = label != null
    ? (labelFormatter ? labelFormatter(String(label)) : String(label))
    : null;

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 11,
        boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        minWidth: 120,
      }}
    >
      {displayLabel && (
        <p
          style={{
            color: "var(--text-secondary)",
            marginBottom: 6,
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {displayLabel}
        </p>
      )}
      {payload.map((entry, i) => {
        const val = entry.value ?? 0;
        const name = entry.name ?? "";
        const [dispVal, dispName] = formatter
          ? formatter(val, name)
          : [String(val), String(name)];
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: entry.color ?? "var(--text-accent)",
                flexShrink: 0,
              }}
            />
            <span style={{ color: "var(--text-secondary)", flex: 1 }}>{dispName}</span>
            <span style={{ color: "var(--text-primary)", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
              {dispVal}
            </span>
          </div>
        );
      })}
    </div>
  );
}
