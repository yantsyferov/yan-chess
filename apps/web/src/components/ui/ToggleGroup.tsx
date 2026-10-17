import type { ReactNode } from "react";

interface ToggleOption<T> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
}

interface ToggleGroupProps<T> {
  value: T;
  onChange: (value: T) => void;
  options: readonly ToggleOption<T>[];
  label?: string;
  ariaLabel?: string;
  className?: string;
  size?: "sm" | "md";
  fullWidth?: boolean;
  /**
   * "pill" — borderless buttons in a row (default, used in PlayOnline).
   * "segment" — per-button bordered style used in challenge forms.
   */
  variant?: "pill" | "segment";
  /**
   * "row" — horizontal flex (default).
   * "grid" — CSS grid; pass gridCols to control column count.
   */
  layout?: "row" | "grid";
  gridCols?: 2 | 3 | 4;
}

const GRID_COLS_CLASS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
};

export function ToggleGroup<T extends string | number | boolean>({
  value,
  onChange,
  options,
  label,
  ariaLabel,
  className = "",
  size = "md",
  fullWidth = false,
  variant = "pill",
  layout = "row",
  gridCols = 2,
}: ToggleGroupProps<T>): JSX.Element {
  const isSegment = variant === "segment";

  const buttonBase = isSegment
    ? "px-3 py-2 rounded-lg text-sm font-medium border transition-colors"
    : size === "sm"
      ? "px-3 py-1.5 text-sm rounded-md transition-colors"
      : "px-4 py-2 text-sm rounded-lg transition-colors";

  const activeClass = isSegment
    ? "bg-accent text-text-inverse border-accent"
    : "bg-accent text-white";

  const inactiveClass = isSegment
    ? "bg-transparent border-border-subtle text-text-secondary hover:border-border-strong hover:text-text-primary"
    : "bg-surface-elevated text-text-secondary hover:text-text-primary";

  const disabledClass = "opacity-50 cursor-not-allowed";

  const groupClass =
    layout === "grid"
      ? `grid ${GRID_COLS_CLASS[gridCols]} gap-2`
      : fullWidth
        ? "flex gap-1 w-full"
        : "inline-flex gap-1";

  return (
    <div className={className}>
      {label && (
        <div className="text-xs text-text-secondary uppercase tracking-wide mb-1.5">{label}</div>
      )}
      <div role="group" aria-label={ariaLabel ?? label ?? undefined} className={groupClass}>
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={String(opt.value)}
              type="button"
              aria-pressed={isActive}
              disabled={opt.disabled}
              onClick={() => !opt.disabled && onChange(opt.value)}
              className={`${buttonBase} ${isActive ? activeClass : inactiveClass} ${
                opt.disabled ? disabledClass : ""
              } ${layout === "row" && fullWidth ? "flex-1" : ""}`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
