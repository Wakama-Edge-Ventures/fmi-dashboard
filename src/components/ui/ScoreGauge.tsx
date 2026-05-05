import { scoreColor, scoreLabel } from "@/src/lib/utils";

// ─── Constants (80px diameter, 5px stroke) ───────────────────────────────────

const SIZE      = 80;
const CX        = SIZE / 2;              // 40
const CY        = SIZE / 2 + 4;         // 44 — pushed down so arc ends have room below
const STROKE_W  = 5;
const R         = (SIZE - STROKE_W * 2) / 2;    // 35
const FULL_CIRC = 2 * Math.PI * R;               // ≈ 219.9
const HALF_CIRC = Math.PI * R;                   // ≈ 109.96
const SVG_H     = CY + STROKE_W + 4;    // 53 — ensures rounded caps never clip
const TRANSFORM = `rotate(-180 ${CX} ${CY})`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScoreGaugeProps {
  score: number;
  size?: number;
  showDetails?: boolean;
  c1?: number;
  c2?: number;
  c3?: number;
  c4?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScoreGauge({
  score,
  showDetails = false,
  c1,
  c2,
  c3,
  c4,
}: ScoreGaugeProps) {
  const color = scoreColor(score);
  const label = scoreLabel(score);

  const safeScore   = Math.max(1, Math.min(score, 1000));
  const progressLen = (safeScore / 1000) * HALF_CIRC;

  const cs = [
    { key: "C1", label: "Capacité",   value: c1 },
    { key: "C2", label: "Caractère",  value: c2 },
    { key: "C3", label: "Collatéral", value: c3 },
    { key: "C4", label: "Conditions", value: c4 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>

      {/* SVG gauge — half-circle with enough room for rounded caps */}
      <svg
        width={SIZE}
        height={SVG_H}
        viewBox={`0 0 ${SIZE} ${SVG_H}`}
        aria-label={`Score ${score} sur 1000`}
      >
        {/* Background arc */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeDasharray={`${HALF_CIRC} ${HALF_CIRC}`}
          transform={TRANSFORM}
        />
        {/* Progress arc */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_W}
          strokeLinecap="round"
          strokeDasharray={`${progressLen} ${FULL_CIRC}`}
          transform={TRANSFORM}
          style={{ transition: "stroke-dasharray 0.5s ease" }}
        />
        {/* Score value */}
        <text
          x="50%"
          y={CY - 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontFamily="var(--font-jetbrains-mono), monospace"
          fontWeight="700"
          fontSize="16"
        >
          {score}
        </text>
      </svg>

      {/* Label */}
      <p className="label-xs" style={{ color }}>{label}</p>

      {/* 4C detail bars */}
      {showDetails && (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10, paddingTop: 4 }}>
          {cs.map(({ key, label: cLabel, value }) => {
            if (value === undefined) return null;
            const pct = Math.round((value / 250) * 100);
            return (
              <div key={key} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "#5a6a85" }}>
                    {key} — {cLabel}
                  </span>
                  <span className="mono" style={{ color: "#e8edf5", fontWeight: 600 }}>
                    {value}
                    <span style={{ color: "#3a4a60", fontWeight: 400 }}>/250</span>
                  </span>
                </div>
                <div
                  style={{
                    height: 3,
                    borderRadius: 9999,
                    background: "rgba(255,255,255,0.05)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 9999,
                      width: `${pct}%`,
                      background: scoreColor(value * 4),
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
