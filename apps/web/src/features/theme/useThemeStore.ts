import { create } from "zustand";

export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  hydrate: () => void;
}

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = window.localStorage.getItem("theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch { /* ignore */ }
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch { return "dark"; }
}

function applyTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
  try { window.localStorage.setItem("theme", theme); } catch { /* ignore */ }
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: typeof document !== "undefined"
    ? ((document.documentElement.dataset.theme as Theme) ?? "dark")
    : "dark",
  setTheme: (theme) => { applyTheme(theme); set({ theme }); },
  toggleTheme: () => { const next = get().theme === "dark" ? "light" : "dark"; applyTheme(next); set({ theme: next }); },
  hydrate: () => { const theme = readStoredTheme(); applyTheme(theme); set({ theme }); },
}));
