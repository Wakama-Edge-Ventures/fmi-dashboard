import { type ReactNode } from "react";

type BadgeVariant = "green" | "amber" | "red" | "gray" | "cyan" | "blue";

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, { background: string; color: string }> = {
  green: { background: "rgba(16,185,129,0.12)",  color: "#10b981" },
  amber: { background: "rgba(245,158,11,0.12)",  color: "#f59e0b" },
  red:   { background: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  gray:  { background: "rgba(90,106,133,0.15)",  color: "#5a6a85" },
  cyan:  { background: "rgba(6,182,212,0.12)",   color: "#06b6d4" },
  blue:  { background: "rgba(59,130,246,0.12)",  color: "#60a5fa" },
};

export default function Badge({
  variant = "gray",
  children,
  className = "",
}: BadgeProps) {
  const { background, color } = VARIANT_STYLES[variant];
  return (
    <span
      className={`inline-flex items-center ${className}`}
      style={{
        background,
        color,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: "0.04em",
        padding: "2px 7px",
        borderRadius: 9999,
        lineHeight: 1.6,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
