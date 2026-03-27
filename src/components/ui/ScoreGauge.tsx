import { scoreColor, scoreLabel } from "@/src/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const CX          = 100;
const CY          = 100;
const R           = 80;
const STROKE_W    = 14;
const FULL_CIRC   = 2 * Math.PI * R;   // ≈ 502.655
const HALF_CIRC   = Math.PI * R;        // ≈ 251.327  (the gauge arc length)
const TRANSFORM   = `rotate(-180 ${CX} ${CY})`;

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScoreGaugeProps {
  score: number;
  /** kept for API compat — SVG now uses fixed 200×120 geometry */
  size?: number;
  showDetails?: boolean;
  /** C1 Capacité   (0-250) */
  c1?: number;
  /** C2 Caractère  (0-250) */
  c2?: number;
  /** C3 Collatéral (0-250) */
  c3?: number;
  /** C4 Conditions (0-250) */
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

  // Clamp to [1, 1000] so strokeLinecap="round" never renders a phantom dot at 0
  const safeScore  = Math.max(1, Math.min(score, 1000));
  const progressLen = (safeScore / 1000) * HALF_CIRC;

  const cs = [
    { key: "C1", label: "Capacité",   value: c1 },
    { key: "C2", label: "Caractère",  value: c2 },
    { key: "C3", label: "Collatéral", value: c3 },
    { key: "C4", label: "Conditions", value: c4 },
  ];

  return (
    <div className="flex flex-col items-center gap-4">

      {/* ── SVG gauge — fixed 200×120 viewport ── */}
      <svg
        width="200"
        height="120"
        viewBox="0 0 200 120"
        aria-label={`Score ${score} sur 1000`}
      >
        {/*
          Both arcs are <circle> elements sharing the SAME cx/cy/r/strokeWidth/
          strokeLinecap/transform — alignment is structural, not computed.

          rotate(-180 CX CY) shifts the stroke start-point from 3 o'clock (right)
          to 9 o'clock (left), so the visible dash sweeps left → top → right.

          Background: strokeDasharray = "halfCirc halfCirc"
            → shows top semicircle, hides bottom semicircle.
          Progress:   strokeDasharray = "progressLen fullCirc"
            → shows only the filled portion (gap is always larger than remainder).
        */}

        {/* Background arc */}
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="#1f2937"
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

        {/* Score + /1000 — single <text> with two <tspan> for vertical alignment */}
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
          <tspan
            x="50%"
            dy="-8"
            fill={color}
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontWeight="700"
            fontSize="32"
          >
            {score}
          </tspan>
          <tspan
            x="50%"
            dy="28"
            fill="#6b7280"
            fontSize="13"
          >
            /1000
          </tspan>
        </text>
      </svg>

      {/* Level badge */}
      <span
        className="text-sm font-bold tracking-widest px-3 py-1 rounded-full border"
        style={{
          color,
          backgroundColor: `${color}1a`,
          borderColor: `${color}40`,
        }}
      >
        {label}
      </span>

      {/* 4C detail bars */}
      {showDetails && (
        <div className="w-full space-y-2.5 pt-1">
          {cs.map(({ key, label: cLabel, value }) => {
            if (value === undefined) return null;
            const pct = Math.round((value / 250) * 100);
            return (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary font-medium">
                    {key} — {cLabel}
                  </span>
                  <span className="font-mono text-text-primary font-semibold">
                    {value}
                    <span className="text-text-muted font-normal">/250</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: scoreColor(value * 4),
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
