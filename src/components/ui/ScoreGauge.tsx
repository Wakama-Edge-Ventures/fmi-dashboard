import { scoreColor, scoreLabel } from "@/src/lib/utils";

interface ScoreGaugeProps {
  score: number;
  /** SVG width in px (height auto = width / 2 + padding) */
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

function describeArc(
  cx: number,
  cy: number,
  r: number,
  score: number
): string {
  // Clamp to avoid degenerate arc at score = 0
  const clamped = Math.max(score, 1);
  const f = Math.min(clamped, 1000) / 1000;
  // Angle in "mathematical" radians: starts at left (π) and goes to right (0)
  const angle = (1 - f) * Math.PI;
  const endX = cx + r * Math.cos(angle);
  const endY = cy - r * Math.sin(angle);
  const largeArc = f > 0.5 ? 1 : 0;
  return `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function backgroundArc(cx: number, cy: number, r: number): string {
  // Full upper semicircle from left to right
  return `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
}

export default function ScoreGauge({
  score,
  size = 200,
  showDetails = false,
  c1,
  c2,
  c3,
  c4,
}: ScoreGaugeProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 16; // padding 16px
  const strokeW = Math.max(10, size / 20);
  const color = scoreColor(score);
  const label = scoreLabel(score);

  const cs = [
    { key: "C1", label: "Capacité",   value: c1 },
    { key: "C2", label: "Caractère",  value: c2 },
    { key: "C3", label: "Collatéral", value: c3 },
    { key: "C4", label: "Conditions", value: c4 },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* SVG Gauge */}
      <div style={{ width: size, height: size / 2 + strokeW }}>
        <svg
          width={size}
          height={size / 2 + strokeW}
          viewBox={`0 0 ${size} ${size / 2 + strokeW}`}
          overflow="visible"
        >
          {/* Background arc */}
          <path
            d={backgroundArc(cx, cy, r)}
            fill="none"
            stroke="#1f2937"
            strokeWidth={strokeW}
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <path
            d={describeArc(cx, cy, r, score)}
            fill="none"
            stroke={color}
            strokeWidth={strokeW}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />

          {/* Score text */}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            dominantBaseline="auto"
            fill={color}
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontWeight="700"
            fontSize={size / 6}
          >
            {score}
          </text>

          {/* /1000 sub-text */}
          <text
            x={cx}
            y={cy + strokeW / 2 - 2}
            textAnchor="middle"
            dominantBaseline="auto"
            fill="#6b7280"
            fontFamily="var(--font-jetbrains-mono), monospace"
            fontSize={size / 14}
          >
            / 1000
          </text>

          {/* Range labels */}
          <text
            x={cx - r - 4}
            y={cy + strokeW / 2 + 2}
            textAnchor="end"
            dominantBaseline="auto"
            fill="#6b7280"
            fontSize={size / 18}
          >
            0
          </text>
          <text
            x={cx + r + 4}
            y={cy + strokeW / 2 + 2}
            textAnchor="start"
            dominantBaseline="auto"
            fill="#6b7280"
            fontSize={size / 18}
          >
            1000
          </text>
        </svg>
      </div>

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
