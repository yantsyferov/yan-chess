import type { ReactNode } from "react";

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
} as const;

interface CardProps {
  variant?: "default" | "glass";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  children: ReactNode;
}

export function Card({
  variant = "glass",
  padding = "md",
  className = "",
  children,
}: CardProps): JSX.Element {
  const base = "rounded-xl";
  const variantClass =
    variant === "glass"
      ? "bg-surface-glass backdrop-blur-[16px] border border-border-subtle shadow-lg"
      : "bg-surface-elevated border border-border-subtle shadow-md";
  return (
    <div className={`${base} ${variantClass} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
}
