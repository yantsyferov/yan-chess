import { create } from "zustand";
import { Chess } from "chess.js";
import type { Mode } from "@yanchess/shared";
import type { BotLevel } from "./bot-levels";
import type { GameEndReason } from "../game/useGameStore";
import { TIME_CONTROL_MS } from "../shared/mode-labels";
import { detectGameEnd } from "../game/game-end";
import { wouldOpponentHaveMatingMaterial } from "../game/clock-math";

export type { GameEndReason };

type PlayerColor = "white" | "black";

export interface Setup {
  level: BotLevel;               // default "clubPlayer"
  color: PlayerColor | "random"; // default "white"
  mode: Mode;                    // default "Blitz"
}

export type VsBotPhase = "setup" | "playing" | "result";

interface VsBotState {
  phase: VsBotPhase;
  setup: Setup;

  // Runtime fields — null/empty until startGame()
  playerColor: PlayerColor | null;
  fen: string;
  movesSan: string[];
  clocks: { whiteMs: number; blackMs: number };
  sideToMove: PlayerColor;
  lastMove: { from: string; to: string } | null;
  lastSyncClientMs: number;
  pendingPromotion: { from: string; to: string } | null;
  pendingResign: boolean;
  result: { winner: PlayerColor | "draw"; reason: GameEndReason } | null;
  resultModalDismissed: boolean;
  botThinking: boolean;

  // Setup actions
  setLevel(l: BotLevel): void;
  setColor(c: PlayerColor | "random"): void;
  setMode(m: Mode): void;

  // Game lifecycle
  startGame(): void;
  setResultModalDismissed(v: boolean): void;
  openPromotion(args: { from: string; to: string }): void;
  cancelPromotion(): void;
  playerMove(from: string, to: string, promotion?: string): void;
  applyBotMove(from: string, to: string, promotion?: string): void;
  tickClock(): void;

  // Resign + result actions
  requestResign(): void;
  cancelResign(): void;
  resign(): void;
  dismissResult(): void;
  newGame(): void;
  rematch(): void;
}

const INITIAL_SETUP: Setup = {
  level: "clubPlayer",
  color: "white",
  mode: "Blitz",
};

// Private Chess instance in module closure (not subscribed state)
let _chess = new Chess();

function resetChess(): Chess {
  _chess = new Chess();
  return _chess;
}

export function getVsBotChess(): Chess {
  return _chess;
}

export const useVsBotStore = create<VsBotState>((set, get) => ({
  phase: "setup",
  setup: INITIAL_SETUP,

  // Runtime defaults
  playerColor: null,
  fen: "",
  movesSan: [],
  clocks: { whiteMs: 0, blackMs: 0 },
  sideToMove: "white",
  lastMove: null,
  lastSyncClientMs: 0,
  pendingPromotion: null,
  pendingResign: false,
  result: null,
  resultModalDismissed: false,
  botThinking: false,

  setLevel(level) {
    set((s) => ({ setup: { ...s.setup, level } }));
  },
  setColor(color) {
    set((s) => ({ setup: { ...s.setup, color } }));
  },
  setMode(mode) {
    set((s) => ({ setup: { ...s.setup, mode } }));
  },

  startGame() {
    const { setup } = get();
    const resolvedColor: PlayerColor =
      setup.color === "random"
        ? Math.random() < 0.5
          ? "white"
          : "black"
        : setup.color;

    const chess = resetChess();
    const modeMs = TIME_CONTROL_MS[setup.mode];

    set({
      phase: "playing",
      playerColor: resolvedColor,
      fen: chess.fen(),
      movesSan: [],
      clocks: { whiteMs: modeMs, blackMs: modeMs },
      sideToMove: "white",
      lastMove: null,
      lastSyncClientMs: Date.now(),
      pendingPromotion: null,
      pendingResign: false,
      result: null,
      resultModalDismissed: false,
      botThinking: resolvedColor === "black", // bot plays white if player is black
    });
  },

  setResultModalDismissed(v) {
    set({ resultModalDismissed: v });
  },

  openPromotion(args) {
    set({ pendingPromotion: { from: args.from, to: args.to } });
  },

  cancelPromotion() {
    set({ pendingPromotion: null });
  },

  playerMove(from, to, promotion) {
    const { phase, result, botThinking, sideToMove, playerColor, clocks, lastSyncClientMs } = get();
    if (phase !== "playing" || result !== null || botThinking || sideToMove !== playerColor) return;

    let moveResult;
    try {
      moveResult = _chess.move({ from, to, promotion });
    } catch {
      return;
    }
    if (moveResult === null) return;

    const now = Date.now();
    const elapsed = now - lastSyncClientMs;
    const newClocks = {
      whiteMs: sideToMove === "white" ? Math.max(0, clocks.whiteMs - elapsed) : clocks.whiteMs,
      blackMs: sideToMove === "black" ? Math.max(0, clocks.blackMs - elapsed) : clocks.blackMs,
    };

    const nextSide: PlayerColor = sideToMove === "white" ? "black" : "white";

    const end = detectGameEnd(_chess);
    if (end !== null) {
      set({
        fen: _chess.fen(),
        movesSan: [...get().movesSan, moveResult.san],
        lastMove: { from, to },
        lastSyncClientMs: now,
        clocks: newClocks,
        sideToMove: nextSide,
        pendingPromotion: null,
        result: { winner: end.winner, reason: end.reason },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
      return;
    }

    set({
      fen: _chess.fen(),
      movesSan: [...get().movesSan, moveResult.san],
      lastMove: { from, to },
      lastSyncClientMs: now,
      clocks: newClocks,
      sideToMove: nextSide,
      pendingPromotion: null,
      botThinking: true,
    });
  },

  applyBotMove(from, to, promotion) {
    const { phase, result, sideToMove, playerColor, clocks, lastSyncClientMs } = get();
    if (phase !== "playing" || result !== null) return;

    let moveResult;
    try {
      moveResult = _chess.move({ from, to, promotion });
    } catch {
      console.warn("[vs-bot] bot returned illegal move", { from, to, promotion });
      set({
        result: { winner: playerColor as PlayerColor, reason: "resignation" },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
      return;
    }
    if (moveResult === null) {
      console.warn("[vs-bot] bot returned illegal move", { from, to, promotion });
      set({
        result: { winner: playerColor as PlayerColor, reason: "resignation" },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
      return;
    }

    const now = Date.now();
    const elapsed = now - lastSyncClientMs;
    // Bot is the side that just moved (sideToMove before flip)
    const newClocks = {
      whiteMs: sideToMove === "white" ? Math.max(0, clocks.whiteMs - elapsed) : clocks.whiteMs,
      blackMs: sideToMove === "black" ? Math.max(0, clocks.blackMs - elapsed) : clocks.blackMs,
    };

    const nextSide: PlayerColor = sideToMove === "white" ? "black" : "white";

    const end = detectGameEnd(_chess);
    if (end !== null) {
      set({
        fen: _chess.fen(),
        movesSan: [...get().movesSan, moveResult.san],
        lastMove: { from, to },
        lastSyncClientMs: now,
        clocks: newClocks,
        sideToMove: nextSide,
        pendingPromotion: null,
        result: { winner: end.winner, reason: end.reason },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
      return;
    }

    set({
      fen: _chess.fen(),
      movesSan: [...get().movesSan, moveResult.san],
      lastMove: { from, to },
      lastSyncClientMs: now,
      clocks: newClocks,
      sideToMove: nextSide,
      pendingPromotion: null,
      botThinking: false,
    });
  },

  tickClock() {
    const { phase, result, sideToMove, clocks, lastSyncClientMs } = get();
    if (phase !== "playing" || result !== null) return;

    const elapsed = Date.now() - lastSyncClientMs;
    const activeSideMs =
      sideToMove === "white"
        ? clocks.whiteMs - elapsed
        : clocks.blackMs - elapsed;

    if (activeSideMs > 0) return;

    // Clock flagged
    const flaggedSide = sideToMove;
    const hasMatingMaterial = wouldOpponentHaveMatingMaterial(_chess, flaggedSide);

    const newClocks = {
      whiteMs: flaggedSide === "white" ? 0 : clocks.whiteMs,
      blackMs: flaggedSide === "black" ? 0 : clocks.blackMs,
    };

    if (hasMatingMaterial) {
      const winner: "white" | "black" = flaggedSide === "white" ? "black" : "white";
      set({
        clocks: newClocks,
        result: { winner, reason: "flag_fall" },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
    } else {
      set({
        clocks: newClocks,
        result: { winner: "draw", reason: "flag_fall_insufficient_material" },
        phase: "result",
        resultModalDismissed: false,
        botThinking: false,
      });
    }
  },

  requestResign() {
    set({ pendingResign: true });
  },

  cancelResign() {
    set({ pendingResign: false });
  },

  resign() {
    const { phase, result, playerColor } = get();
    if (phase !== "playing" || result !== null || playerColor === null) return;
    const winner: PlayerColor = playerColor === "white" ? "black" : "white";
    set({
      result: { winner, reason: "resignation" },
      phase: "result",
      pendingResign: false,
      botThinking: false,
      resultModalDismissed: false,
    });
  },

  dismissResult() {
    set({ resultModalDismissed: true });
  },

  rematch() {
    const { setup } = get();
    if (setup.color !== "random") {
      const opposite: PlayerColor = setup.color === "white" ? "black" : "white";
      set((s) => ({ setup: { ...s.setup, color: opposite } }));
    }
    get().startGame();
  },

  newGame() {
    resetChess();
    set({
      phase: "setup",
      playerColor: null,
      fen: "",
      movesSan: [],
      clocks: { whiteMs: 0, blackMs: 0 },
      sideToMove: "white",
      lastMove: null,
      lastSyncClientMs: 0,
      pendingPromotion: null,
      pendingResign: false,
      result: null,
      resultModalDismissed: false,
      botThinking: false,
    });
  },
}));
