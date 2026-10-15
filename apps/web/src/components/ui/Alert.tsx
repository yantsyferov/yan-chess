import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

export interface AlertProps {
  tone?: "danger" | "success" | "info";
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
}

const ICONS = {
  danger: AlertCircle,
  success: CheckCircle2,
  info: Info,
} as const;

const TONE_CLASSES: Record<NonNullable<AlertProps["tone"]>, string> = {
  danger: "bg-danger-surface text-danger border-l-4 border-danger",
  success: "bg-success-surface text-success border-l-4 border-success",
  info: "bg-surface-elevated text-text-primary border-l-4 border-border-strong",
};

export function Alert({ tone = "info", title, icon, children }: AlertProps): JSX.Element {
  const Icon = ICONS[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={`flex gap-3 p-3 rounded-md ${TONE_CLASSES[tone]}`}
    >
      <span className="flex-shrink-0 mt-0.5">{icon ?? <Icon size={18} />}</span>
      <div className="flex-1">
        {title && <div className="font-medium">{title}</div>}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}
