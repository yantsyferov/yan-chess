import type { ReactNode } from "react";
import { Card } from "./Card";

interface AuthLayoutProps {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthLayout({ title, children, footer }: AuthLayoutProps): JSX.Element {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-3 py-6 sm:px-4 sm:py-10">
      <div className="w-full max-w-[440px]">
        {title && (
          <h1 className="text-3xl font-semibold text-text-primary mb-6 text-center">
            {title}
          </h1>
        )}
        <Card variant="glass" padding="lg">
          {children}
        </Card>
        {footer && (
          <div className="mt-6 text-center text-sm text-text-secondary">{footer}</div>
        )}
      </div>
    </div>
  );
}
