import { create } from "zustand";

export interface Rating {
  mode: "Bullet" | "Blitz" | "Rapid" | "Classical";
  rating: number;
  gamesPlayed: number;
}

export interface AuthUser {
  id: string;
  nickname: string;
  email: string;
  createdAt: string;
  ratings?: Rating[];
  country: string | null;
}

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  setSession: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
}

/**
 * localStorage flag indicating "user has an active refresh cookie somewhere".
 * Set on successful login/session establishment, cleared on logout.
 * ProtectedRoute reads this to skip the fetchMe round-trip for anonymous
 * visitors who never had a session — redirect to /login is instant.
 *
 * Not a security control (user can set the key themselves) — purely a UX
 * optimization to avoid a 3-4s loader for guests landing on protected routes.
 */
export const SESSION_FLAG_KEY = "yanchess:session";

export function hasSessionFlag(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem(SESSION_FLAG_KEY) !== null;
  } catch {
    return false;
  }
}

function setSessionFlag(): void {
  try {
    window.localStorage.setItem(SESSION_FLAG_KEY, "1");
  } catch {
    /* ignore */
  }
}

function clearSessionFlag(): void {
  try {
    window.localStorage.removeItem(SESSION_FLAG_KEY);
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => {
    setSessionFlag();
    set({ accessToken, user });
  },
  clear: () => {
    clearSessionFlag();
    set({ accessToken: null, user: null });
  },
}));
