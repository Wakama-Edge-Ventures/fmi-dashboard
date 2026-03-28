"use client";

interface RangeConfigProps {
  label: string;
  minValue: number;
  maxValue: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  onChangeMin: (value: number) => void;
  onChangeMax: (value: number) => void;
}

export default function RangeConfig({
  label,
  minValue,
  maxValue,
  min = 0,
  max,
  step = 1,
  unit = "",
  onChangeMin,
  onChangeMax,
}: RangeConfigProps) {
  return (
    <div>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-secondary)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="number"
          value={minValue}
          min={min}
          max={maxValue}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v <= maxValue) onChangeMin(v);
          }}
          style={{
            flex: 1,
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 12,
            padding: "6px 10px",
            fontFamily: "var(--font-mono), monospace",
            outline: "none",
          }}
        />
        <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>–</span>
        <input
          type="number"
          value={maxValue}
          min={minValue}
          max={max}
          step={step}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v >= minValue) onChangeMax(v);
          }}
          style={{
            flex: 1,
            background: "var(--bg-input)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            color: "var(--text-primary)",
            fontSize: 12,
            padding: "6px 10px",
            fontFamily: "var(--font-mono), monospace",
            outline: "none",
          }}
        />
        {unit && (
          <span style={{ fontSize: 11, color: "var(--text-muted)", flexShrink: 0 }}>{unit}</span>
        )}
      </div>
    </div>
  );
}
