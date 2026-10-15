import { forwardRef } from "react";
import type { ButtonHTMLAttributes } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: "sm" | "md";
  variant?: "ghost" | "subtle";
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ label, size = "md", variant = "ghost", className = "", ...rest }, ref) {
    const sizeClass = size === "sm" ? "h-8 w-8" : "h-10 w-10";
    const variantClass =
      variant === "subtle"
        ? "bg-surface-elevated border border-border-subtle hover:border-border-strong"
        : "";
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        className={`inline-flex items-center justify-center rounded-full text-text-secondary hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent transition-colors ${sizeClass} ${variantClass} ${className}`}
        {...rest}
      />
    );
  },
);
