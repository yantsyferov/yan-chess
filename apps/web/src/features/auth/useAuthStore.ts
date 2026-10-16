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

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  setSession: (accessToken, user) => set({ accessToken, user }),
  clear: () => set({ accessToken: null, user: null }),
}));
