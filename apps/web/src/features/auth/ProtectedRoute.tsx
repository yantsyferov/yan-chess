import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "./useAuthStore";
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
  const [checked, setChecked] = useState(user !== null);

  useEffect(() => {
    if (user) { setChecked(true); return; }
    void (async () => {
      await fetchMe();
      setChecked(true);
    })();
  }, [user]);

  if (!checked) return <main><p>Loading…</p></main>;
  if (!user) return <Navigate to="/login" replace state={redirectState} />;
  return <>{children}</>;
}
