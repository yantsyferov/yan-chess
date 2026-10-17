import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore, hasSessionFlag } from "./useAuthStore";
import { fetchMe } from "./authService";

interface RedirectState {
  message?: string;
  returnTo?: string;
}

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectState?: RedirectState;
}

export function ProtectedRoute({ children, redirectState }: ProtectedRouteProps): JSX.Element {
  const { user } = useAuthStore();
  // If the user is already in the store (post-login navigation) OR the
  // session flag is absent (anonymous visitor who never logged in), we can
  // make the auth decision synchronously without the fetchMe round-trip.
  const [checked, setChecked] = useState(() => user !== null || !hasSessionFlag());

  useEffect(() => {
    if (user) { setChecked(true); return; }
    if (!hasSessionFlag()) { setChecked(true); return; }
    void (async () => {
      await fetchMe();
      setChecked(true);
    })();
  }, [user]);

  if (!checked) return <main><p>Loading…</p></main>;
  if (!user) return <Navigate to="/login" replace state={redirectState} />;
  return <>{children}</>;
}
