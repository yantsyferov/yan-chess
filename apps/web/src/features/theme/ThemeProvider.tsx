import { useEffect, type ReactNode } from "react";
import { useThemeStore } from "./useThemeStore";

export function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const hydrate = useThemeStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);
  return <>{children}</>;
}
