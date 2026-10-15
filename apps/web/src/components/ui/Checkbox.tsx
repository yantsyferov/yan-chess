import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";

export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  name: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, name, className = "", ...rest }, ref) => {
    return (
      <label className="inline-flex items-center gap-2 cursor-pointer text-sm text-text-secondary">
        <input
          ref={ref}
          type="checkbox"
          name={name}
          style={{ accentColor: "var(--accent-base)" }}
          className={`h-4 w-4 rounded border-border-strong cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${className}`}
          {...rest}
        />
        {label}
      </label>
    );
  },
);

Checkbox.displayName = "Checkbox";
