import type { ReactNode } from "react";
import { Header } from "./Header";

export function AppShell({ children }: { children: ReactNode }): JSX.Element {
  return (
    <>
      <Header />
      <main className="min-h-[calc(100vh-3.5rem)]">{children}</main>
    </>
  );
}
