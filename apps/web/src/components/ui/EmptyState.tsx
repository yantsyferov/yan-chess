import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "./Button";

interface EmptyStateAction {
  label: string;
  onClick?: () => void;
  to?: string;
  variant?: "primary" | "secondary";
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: ReactNode;
  actions?: EmptyStateAction[];
  className?: string;
}

export function EmptyState({
  icon: Icon, title, description, actions, className = "",
}: EmptyStateProps): JSX.Element {
  return (
    <div className={`flex flex-col items-center text-center gap-3 p-6 ${className}`}>
      {Icon && <Icon size={40} className="text-text-muted" aria-hidden />}
      {title && <h3 className="text-base font-semibold text-text-primary">{title}</h3>}
      {description && <p className="text-sm text-text-secondary">{description}</p>}
      {actions && actions.length > 0 && (
        <div className="flex gap-2 mt-2 flex-wrap justify-center">
          {actions.map((a) => {
            const btn = (
              <Button key={a.label} variant={a.variant ?? "primary"} size="sm" onClick={a.onClick}>
                {a.label}
              </Button>
            );
            return a.to ? <Link key={a.label} to={a.to}>{btn}</Link> : btn;
          })}
        </div>
      )}
    </div>
  );
}
