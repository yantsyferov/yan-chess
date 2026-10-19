import { create } from "zustand";

export interface SessionAnalysisPayload {
  pgn: string;
  playerColor: "white" | "black";
  source: "vs-bot" | "hotseat";
}

interface SessionAnalysisStore {
  payload: SessionAnalysisPayload | null;
  set(payload: SessionAnalysisPayload): void;
  clear(): void;
}

export const useSessionAnalysisStore = create<SessionAnalysisStore>((set) => ({
  payload: null,
  set: (payload) => set({ payload }),
  clear: () => set({ payload: null }),
}));
