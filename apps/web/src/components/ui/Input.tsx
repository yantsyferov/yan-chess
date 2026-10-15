import { forwardRef } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { AlertCircle } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  name: string;
  error?: string;
  rightSlot?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, id, name, rightSlot, className = "", ...rest }, ref) => {
    const inputId = id ?? name;
    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            name={name}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : undefined}
            className={[
              "w-full rounded-lg bg-surface-elevated border px-3 py-2.5 text-text-primary",
              "placeholder:text-text-muted focus:outline-none focus-visible:ring-2",
              "focus-visible:ring-accent focus-visible:ring-offset-0 transition-colors",
              error
                ? "border-danger"
                : "border-border-subtle hover:border-border-strong focus:border-accent",
              rightSlot ? "pr-10" : "",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...rest}
          />
          {rightSlot && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2">{rightSlot}</span>
          )}
        </div>
        {error && (
          <span
            id={`${inputId}-error`}
            role="alert"
            className="flex items-center gap-1 text-sm text-danger"
          >
            <AlertCircle size={14} />
            {error}
          </span>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
