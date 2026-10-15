import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import * as authService from "../features/auth/authService";
import { AuthLayout } from "../components/ui/AuthLayout";
import { Button } from "../components/ui/Button";

type VerifyState =
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "failure" }
  | { kind: "missing-token" };

// Module-level set guards against React 18 StrictMode double-mount.
// The verify endpoint is one-shot: a second call returns 410 token_used.
// When StrictMode unmounts+remounts, the second effect mount skips the call
// because the token is already in this set; the first call's promise still
// resolves and updates state on the surviving mount.
const verifiedTokens = new Set<string>();

export function VerifyEmail(): JSX.Element {
  const [search] = useSearchParams();
  const token = search.get("token");
  const [state, setState] = useState<VerifyState>(
    token ? { kind: "loading" } : { kind: "missing-token" },
  );

  useEffect(() => {
    if (!token) return;
    if (verifiedTokens.has(token)) return;
    verifiedTokens.add(token);

    (async () => {
      try {
        const res = await authService.verifyEmail(token);
        if (res.status === 200) setState({ kind: "success" });
        else setState({ kind: "failure" });
      } catch {
        setState({ kind: "failure" });
      }
    })();
  }, [token]);

  if (state.kind === "loading") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center gap-3 text-text-secondary">
          <Loader2 size={28} className="animate-spin" />
          <p>Verifying email…</p>
        </div>
      </AuthLayout>
    );
  }

  if (state.kind === "success") {
    return (
      <AuthLayout>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10 text-accent">
            <CheckCircle2 size={28} />
          </div>
          <h1 className="text-2xl font-semibold text-text-primary">Email verified</h1>
          <p className="text-text-secondary">You can now sign in.</p>
          <Link to="/login" className="w-full">
            <Button variant="primary" className="w-full">Sign in</Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  // failure OR missing-token
  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-surface text-danger">
          <AlertCircle size={28} />
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">Link is invalid</h1>
        <p className="text-sm text-text-secondary">
          To get a new link, request one from the sign-in page.
        </p>
        <Link to="/forgot-password" className="w-full">
          <Button variant="secondary" className="w-full">Request a new link</Button>
        </Link>
      </div>
    </AuthLayout>
  );
}
