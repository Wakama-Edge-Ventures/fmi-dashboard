import { type ButtonHTMLAttributes, type ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "accent-ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 30,
  paddingLeft: 14,
  paddingRight: 14,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity 150ms, background 150ms, border-color 150ms",
  border: "none",
  outline: "none",
  whiteSpace: "nowrap",
};

const VARIANTS: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: "#10b981",
    color: "#000",
    border: "none",
  },
  secondary: {
    background: "transparent",
    color: "#e8edf5",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  ghost: {
    background: "transparent",
    color: "#e8edf5",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  "accent-ghost": {
    background: "rgba(16,185,129,0.05)",
    color: "#10b981",
    border: "1px solid rgba(16,185,129,0.3)",
  },
  danger: {
    background: "rgba(239,68,68,0.05)",
    color: "#ef4444",
    border: "1px solid rgba(239,68,68,0.3)",
  },
};

export default function Button({
  variant = "secondary",
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...rest
}: ButtonProps) {
  const variantStyle = VARIANTS[variant];

  function handleMouseEnter(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === "primary") {
      el.style.opacity = "0.85";
    } else if (variant === "secondary" || variant === "ghost") {
      el.style.borderColor = "rgba(255,255,255,0.15)";
      el.style.background = "rgba(255,255,255,0.03)";
    } else if (variant === "accent-ghost") {
      el.style.background = "rgba(16,185,129,0.1)";
    }
    onMouseEnter?.(e);
  }

  function handleMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
    if (disabled) return;
    const el = e.currentTarget;
    if (variant === "primary") {
      el.style.opacity = "1";
    } else if (variant === "secondary" || variant === "ghost") {
      el.style.borderColor = "rgba(255,255,255,0.06)";
      el.style.background = "transparent";
    } else if (variant === "accent-ghost") {
      el.style.background = "rgba(16,185,129,0.05)";
    }
    onMouseLeave?.(e);
  }

  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        ...BASE,
        ...variantStyle,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        ...style,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </button>
  );
}
