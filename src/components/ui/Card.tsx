import { type ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  /** Adds hover border-color transition */
  hoverable?: boolean;
  /** Optional 2px accent left border */
  accent?: boolean;
  style?: React.CSSProperties;
}

export default function Card({
  children,
  className = "",
  hoverable = false,
  accent = false,
  style,
}: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: "#0d1423",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        padding: 16,
        borderLeft: accent ? "2px solid #10b981" : undefined,
        transition: hoverable ? "border-color 200ms" : undefined,
        ...style,
      }}
      onMouseEnter={
        hoverable
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                "rgba(16,185,129,0.3)";
            }
          : undefined
      }
      onMouseLeave={
        hoverable
          ? (e) => {
              (e.currentTarget as HTMLDivElement).style.borderColor =
                "rgba(255,255,255,0.06)";
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
