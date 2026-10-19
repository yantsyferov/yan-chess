import { create } from "zustand";
import type { AnalysisMove } from "@yanchess/shared";

// AnalyzedMoveFull extends the shared AnalysisMove with fields needed by the UI:
// board navigation (fen after move, san), and the played uci for marker logic.
export interface AnalyzedMoveFull extends AnalysisMove {
  /** SAN notation of the move that was played (e.g. "Nf3"). */
  san: string;
  /** UCI of the move that was played (e.g. "g1f3"). */
  playedUci: string;
  /** FEN of the position AFTER this move was applied. */
  fenAfter: string;
}

export type DeepAnalysisStatus =
  | "idle"
  | "fetching-cache"
  | "cached"
  | "running-deep"
  | "done"
  | "error"
  | "cancelled";

interface CacheEntry {
  moves: AnalyzedMoveFull[];
  classifierVersion: number;
  engineDepth: number;
  completedAt: string | null;
}

interface AnalysisStoreState {
  /** Per-game/session cache, keyed by gameId or "session". */
  cache: Map<string, CacheEntry>;
  /** The key currently being analyzed or viewed. */
  activeKey: string | null;
  status: DeepAnalysisStatus;
  progress: { done: number; total: number };
  /** Accumulated moves for the active analysis run. */
  moves: AnalyzedMoveFull[];
  error: string | null;

  startRun(key: string): void;
  setStatus(status: DeepAnalysisStatus): void;
  setProgress(progress: { done: number; total: number }): void;
  appendMove(move: AnalyzedMoveFull): void;
  finishRun(moves: AnalyzedMoveFull[]): void;
  cancelRun(): void;
  setError(error: string): void;
  loadCached(key: string, data: CacheEntry): void;
  reset(): void;
}

export const useAnalysisStore = create<AnalysisStoreState>((set, get) => ({
  cache: new Map(),
  activeKey: null,
  status: "idle",
  progress: { done: 0, total: 0 },
  moves: [],
  error: null,

  startRun(key) {
    set({
      activeKey: key,
      status: "fetching-cache",
      progress: { done: 0, total: 0 },
      moves: [],
      error: null,
    });
  },

  setStatus(status) {
    set({ status });
  },

  setProgress(progress) {
    set({ progress });
  },

  appendMove(move) {
    set((state) => ({ moves: [...state.moves, move] }));
  },

  finishRun(moves) {
    const key = get().activeKey;
    if (key !== null) {
      const newCache = new Map(get().cache);
      newCache.set(key, {
        moves,
        classifierVersion: moves[0] !== undefined
          ? (moves[0] as AnalyzedMoveFull & { classifierVersion?: number }).classifierVersion ?? 1
          : 1,
        engineDepth: 18,
        completedAt: new Date().toISOString(),
      });
      set({ status: "done", moves, cache: newCache });
    } else {
      set({ status: "done", moves });
    }
  },

  cancelRun() {
    set({ status: "cancelled" });
  },

  setError(error) {
    set({ status: "error", error });
  },

  loadCached(key, data) {
    const newCache = new Map(get().cache);
    newCache.set(key, data);
    set({
      activeKey: key,
      status: "cached",
      moves: data.moves,
      progress: { done: data.moves.length, total: data.moves.length },
      error: null,
      cache: newCache,
    });
  },

  reset() {
    set({
      activeKey: null,
      status: "idle",
      progress: { done: 0, total: 0 },
      moves: [],
      error: null,
    });
  },
}));
