import type { AlertSeverity } from "@/src/types";

interface AlertBadgeProps {
  severity: AlertSeverity;
  text: string;
}

const STYLES: Record<
  AlertSeverity,
  { container: string; text: string; icon: string }
> = {
  CRITICAL: {
    container: "bg-red-500/10 border-red-800",
    text: "text-red-400",
    icon: "error",
  },
  HIGH: {
    container: "bg-red-500/10 border-red-800",
    text: "text-red-400",
    icon: "error",
  },
  WARNING: {
    container: "bg-amber-500/10 border-amber-800",
    text: "text-amber-400",
    icon: "warning",
  },
  MEDIUM: {
    container: "bg-amber-500/10 border-amber-800",
    text: "text-amber-400",
    icon: "warning",
  },
  INFO: {
    container: "bg-blue-500/10 border-blue-800",
    text: "text-blue-400",
    icon: "info",
  },
  LOW: {
    container: "bg-blue-500/10 border-blue-800",
    text: "text-blue-400",
    icon: "info",
  },
};

export default function AlertBadge({ severity, text }: AlertBadgeProps) {
  const s = STYLES[severity];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${s.container} ${s.text}`}
    >
      {/* Pulsing dot for CRITICAL */}
      {severity === "CRITICAL" && (
        <span className="relative flex h-1.5 w-1.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-400" />
        </span>
      )}

      {/* Icon for non-critical */}
      {severity !== "CRITICAL" && (
        <span
          className={`material-symbols-outlined shrink-0 ${s.text}`}
          style={{
            fontSize: 14,
            fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
          }}
        >
          {s.icon}
        </span>
      )}

      {text}
    </span>
  );
}
