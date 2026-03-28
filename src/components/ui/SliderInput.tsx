"use client";

interface SliderInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  description?: string;
  onChange: (value: number) => void;
  disabled?: boolean;
  color?: string;
}

export default function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  description,
  onChange,
  disabled = false,
  color = "#10b981",
}: SliderInputProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-secondary)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            fontFamily: "var(--font-mono), monospace",
            color: disabled ? "var(--text-muted)" : "var(--text-primary)",
          }}
        >
          {value}
          {unit && <span style={{ fontSize: 10, color: "var(--text-secondary)", marginLeft: 2 }}>{unit}</span>}
        </span>
      </div>

      <div style={{ position: "relative", height: 20, display: "flex", alignItems: "center" }}>
        {/* Track background */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            height: 4,
            borderRadius: 2,
            background: "var(--bg-badge)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: disabled ? "var(--text-muted)" : color,
              borderRadius: 2,
              transition: "width 100ms",
            }}
          />
        </div>

        {/* Range input (invisible but functional) */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            width: "100%",
            opacity: 0,
            height: 20,
            cursor: disabled ? "not-allowed" : "pointer",
            margin: 0,
          }}
        />

        {/* Thumb indicator */}
        <div
          style={{
            position: "absolute",
            left: `calc(${pct}% - 7px)`,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: disabled ? "var(--text-muted)" : color,
            border: "2px solid var(--bg-card)",
            boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
            pointerEvents: "none",
            transition: "left 100ms",
          }}
        />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{min}{unit}</span>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{max}{unit}</span>
      </div>

      {description && (
        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
          {description}
        </p>
      )}
    </div>
  );
}
