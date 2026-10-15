import { useLocation } from "react-router-dom";
import { Mail } from "lucide-react";
import { AuthLayout } from "../components/ui/AuthLayout";
import { Button } from "../components/ui/Button";

interface LocationState {
  email?: string;
}

export function VerifyEmailCheck(): JSX.Element {
  const location = useLocation();
  const state = (location.state as LocationState | null) ?? {};
  const email = state.email ?? "your inbox";

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Mail size={28} />
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">Check your email</h1>
        <p className="text-text-secondary">
          We've sent a verification link to{" "}
          <strong className="text-text-primary">{email}</strong>.
        </p>
        <p className="text-sm text-text-muted">The link is valid for 24 hours.</p>
        <Button variant="secondary" disabled className="mt-2">
          Resend
        </Button>
      </div>
    </AuthLayout>
  );
}
