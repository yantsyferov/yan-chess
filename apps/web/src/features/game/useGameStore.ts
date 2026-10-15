import { create } from "zustand";
import { Chess } from "chess.js";
import type { Square } from "chess.js";
import type { Mode } from "@yanchess/shared";
import { wouldOpponentHaveMatingMaterial } from "./clock-math";
import { detectGameEnd } from "./game-end";
import { TIME_CONTROL_MS } from "../shared/mode-labels";

export type { Mode };

export type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "flag_fall"
  | "flag_fall_insufficient_material"
  | "resignation"
  | "draw_agreement";
export type Winner = "white" | "black" | "draw";

interface GameState {
  chess: Chess;
  fen: string;
  mode: Mode;
  phase: "idle" | "playing" | "ended";
  clock: {
    white: number;
    black: number;
    activeSide: "white" | "black" | null;
    lastTickAt: number | null;
  };
  lastMove: { from: Square; to: Square } | null;
  selectedSquare: Square | null;
  pendingPromotion: { from: Square; to: Square } | null;
  pendingDrawOffer: "white" | "black" | null;
  pendingResign: "white" | "black" | null;
  result: { winner: Winner; reason: GameEndReason } | null;
  resultModalDismissed: boolean;
}

interface GameActions {
  setMode(mode: Mode): void;
  startGame(): void;
  reset(): void;
  makeMove(from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): void;
  selectSquare(square: Square | null): void;
  openPromotion(args: { from: Square; to: Square }): void;
  cancelPromotion(): void;
  tickClock(deltaMs: number): void;
  endGame(args: { winner: Winner; reason: GameEndReason }): void;
  resign(): void;
  offerDraw(): void;
  respondToDrawOffer(accept: boolean): void;
  openResignConfirm(): void;
  cancelResignConfirm(): void;
  dismissResult(): void;
}

function oppositeSide(side: "white" | "black" | null): "white" | "black" | null {
  if (side === "white") return "black";
  if (side === "black") return "white";
  return side;
}

function makeInitialChess(): { chess: Chess; fen: string } {
  const chess = new Chess();
  return { chess, fen: chess.fen() };
}

export const useGameStore = create<GameState & GameActions>((set, get) => {
  const { chess, fen } = makeInitialChess();

  return {
    chess,
    fen,
    mode: "Bullet",
    phase: "idle",
    clock: { white: 0, black: 0, activeSide: null, lastTickAt: null },
    lastMove: null,
    selectedSquare: null,
    pendingPromotion: null,
    pendingDrawOffer: null,
    pendingResign: null,
    result: null,
    resultModalDismissed: false,

    setMode(mode: Mode): void {
      set({ mode });
    },

    startGame(): void {
      const modeMs = TIME_CONTROL_MS[get().mode];
      set({
        phase: "playing",
        clock: { white: modeMs, black: modeMs, activeSide: "white", lastTickAt: performance.now() },
        lastMove: null,
        selectedSquare: null,
        pendingPromotion: null,
        pendingDrawOffer: null,
        pendingResign: null,
        result: null,
        resultModalDismissed: false,
      });
    },

    reset(): void {
      const { chess: freshChess, fen: freshFen } = makeInitialChess();
      const currentMode = get().mode;
      set({
        chess: freshChess,
        fen: freshFen,
        mode: currentMode,
        phase: "idle",
        clock: { white: 0, black: 0, activeSide: null, lastTickAt: null },
        lastMove: null,
        selectedSquare: null,
        pendingPromotion: null,
        pendingDrawOffer: null,
        pendingResign: null,
        result: null,
        resultModalDismissed: false,
      });
    },

    makeMove(from: Square, to: Square, promotion?: "q" | "r" | "b" | "n"): void {
      const { chess, clock } = get();
      const result = chess.move({ from, to, promotion });
      if (result === null) return;
      const nextActiveSide = oppositeSide(clock.activeSide);
      set({
        fen: chess.fen(),
        lastMove: { from, to },
        selectedSquare: null,
        pendingPromotion: null,
        clock: { ...clock, activeSide: nextActiveSide, lastTickAt: performance.now() },
      });
      const end = detectGameEnd(chess);
      if (end !== null) {
        get().endGame({ winner: end.winner, reason: end.reason });
      }
    },

    selectSquare(square: Square | null): void {
      set({ selectedSquare: square });
    },

    openPromotion(args: { from: Square; to: Square }): void {
      set({ pendingPromotion: { from: args.from, to: args.to } });
    },

    cancelPromotion(): void {
      set({ pendingPromotion: null, selectedSquare: null });
    },
    tickClock(deltaMs: number): void {
      const { clock, phase, chess } = get();
      if (phase !== "playing" || !clock.activeSide || !clock.lastTickAt) return;
      const side = clock.activeSide;
      const newMs = Math.max(0, clock[side] - deltaMs);
      set({ clock: { ...clock, [side]: newMs, lastTickAt: performance.now() } });
      if (newMs === 0) {
        const hasMating = wouldOpponentHaveMatingMaterial(chess, side);
        const winner: Winner = hasMating ? (side === "white" ? "black" : "white") : "draw";
        const reason: GameEndReason = hasMating ? "flag_fall" : "flag_fall_insufficient_material";
        get().endGame({ winner, reason });
      }
    },
    endGame({ winner, reason }: { winner: Winner; reason: GameEndReason }): void {
      set({
        phase: "ended",
        result: { winner, reason },
        clock: { ...get().clock, activeSide: null, lastTickAt: null },
      });
    },
    openResignConfirm(): void {
      const { clock } = get();
      if (!clock.activeSide) return;
      set({ pendingResign: clock.activeSide });
    },
    cancelResignConfirm(): void {
      set({ pendingResign: null });
    },
    resign(): void {
      const side = get().pendingResign ?? get().clock.activeSide;
      if (!side) return;
      const winner = side === "white" ? "black" : "white";
      set({ pendingResign: null });
      get().endGame({ winner, reason: "resignation" });
    },
    offerDraw(): void {
      const { clock } = get();
      if (!clock.activeSide) return;
      set({ pendingDrawOffer: clock.activeSide });
    },
    respondToDrawOffer(accept: boolean): void {
      if (!accept) {
        set({ pendingDrawOffer: null });
        return;
      }
      set({ pendingDrawOffer: null });
      get().endGame({ winner: "draw", reason: "draw_agreement" });
    },
    dismissResult(): void {
      set({ resultModalDismissed: true });
    },
  };
});

if (import.meta.env.DEV) {
  // Expose store for Playwright / integration tests
  (window as Window & { __gameStore?: typeof useGameStore }).__gameStore = useGameStore;
}
