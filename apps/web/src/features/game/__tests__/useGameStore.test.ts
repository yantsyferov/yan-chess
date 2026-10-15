// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGameStore } from "../useGameStore";

// performance.now is used in startGame and makeMove — stub it
vi.stubGlobal("performance", { now: () => 1000 });

function getState() {
  return useGameStore.getState();
}

function resetStore() {
  const { reset } = getState();
  reset();
}

beforeEach(() => {
  resetStore();
  // After reset, mode stays, phase is idle — set a fresh chess for each test
});

describe("startGame", () => {
  it("startGame('bullet') sets phase=playing and correct clock times", () => {
    // @regression
    getState().setMode("Bullet");
    getState().startGame();
    const { phase, clock } = getState();
    expect(phase).toBe("playing");
    expect(clock.white).toBe(60_000);
    expect(clock.black).toBe(60_000);
    expect(clock.activeSide).toBe("white");
  });

  it("startGame in blitz mode sets 180s clocks", () => {
    // @regression
    getState().setMode("Blitz");
    getState().startGame();
    expect(getState().clock.white).toBe(180_000);
    expect(getState().clock.black).toBe(180_000);
  });
});

describe("makeMove", () => {
  beforeEach(() => {
    getState().setMode("Bullet");
    getState().startGame();
  });

  it("makeMove e2→e4 succeeds and flips activeSide to black", () => {
    // @regression
    getState().makeMove("e2", "e4");
    const { chess, clock, lastMove } = getState();
    expect(chess.history().length).toBe(1);
    expect(clock.activeSide).toBe("black");
    expect(lastMove).toEqual({ from: "e2", to: "e4" });
  });

  it("makeMove with illegal from/to throws (chess.js v1 throws on invalid moves)", () => {
    // @regression
    // NOTE: chess.js v1.4 throws on illegal moves instead of returning null.
    // The store's `if (result === null) return` guard is dead code — this is a known gap.
    // The Board component prevents this by only calling makeMove with legal destinations.
    expect(() => getState().makeMove("e2", "e5")).toThrow();
  });

  it("promotion: openPromotion + makeMove with 'q' promotes correctly", () => {
    // @regression
    // Set up a position where white pawn can promote
    const { chess } = getState();
    // Load a FEN with white pawn about to promote
    chess.load("8/P7/8/8/8/8/8/k1K5 w - - 0 1");
    getState().openPromotion({ from: "a7", to: "a8" });
    expect(getState().pendingPromotion).toEqual({ from: "a7", to: "a8" });
    getState().makeMove("a7", "a8", "q");
    const piece = getState().chess.get("a8");
    expect(piece?.type).toBe("q");
  });
});

describe("tickClock", () => {
  beforeEach(() => {
    getState().setMode("Bullet");
    getState().startGame();
  });

  it("tickClock deducts from white's time", () => {
    // @regression
    const before = getState().clock.white;
    getState().tickClock(1000);
    expect(getState().clock.white).toBe(before - 1000);
  });

  it("tickClock to zero triggers endGame with flag_fall when opponent has material", () => {
    // @regression
    // White has little time left, black has queen
    const { chess } = getState();
    chess.load("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    // White's clock nearly empty
    useGameStore.setState((s) => ({ clock: { ...s.clock, white: 500 } }));
    getState().tickClock(500);
    const state = getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.reason).toBe("flag_fall");
    expect(state.result?.winner).toBe("black");
  });

  it("tickClock to zero with insufficient opponent material → draw", () => {
    // @regression
    // Bare kings: white flags but black can't mate
    const { chess } = getState();
    chess.load("k7/8/8/8/8/8/8/K7 w - - 0 1");
    useGameStore.setState((s) => ({ clock: { ...s.clock, white: 200 } }));
    getState().tickClock(200);
    const state = getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.reason).toBe("flag_fall_insufficient_material");
    expect(state.result?.winner).toBe("draw");
  });
});

describe("resign", () => {
  beforeEach(() => {
    getState().setMode("Bullet");
    getState().startGame();
  });

  it("resign() when activeSide=white → winner=black, reason=resignation", () => {
    // @regression
    expect(getState().clock.activeSide).toBe("white");
    getState().openResignConfirm();
    getState().resign();
    const state = getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.winner).toBe("black");
    expect(state.result?.reason).toBe("resignation");
  });
});

describe("draw offer", () => {
  beforeEach(() => {
    getState().setMode("Bullet");
    getState().startGame();
  });

  it("respondToDrawOffer(true) → endGame with draw_agreement", () => {
    // @regression
    getState().offerDraw();
    getState().respondToDrawOffer(true);
    const state = getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.winner).toBe("draw");
    expect(state.result?.reason).toBe("draw_agreement");
  });

  it("respondToDrawOffer(false) clears pendingDrawOffer, no endGame", () => {
    // @regression
    getState().offerDraw();
    getState().respondToDrawOffer(false);
    const state = getState();
    expect(state.pendingDrawOffer).toBeNull();
    expect(state.phase).toBe("playing");
  });
});

describe("reset", () => {
  it("reset() returns phase to idle and clears state", () => {
    // @regression
    getState().setMode("Blitz");
    getState().startGame();
    getState().reset();
    const state = getState();
    expect(state.phase).toBe("idle");
    expect(state.lastMove).toBeNull();
    expect(state.result).toBeNull();
    expect(state.clock.activeSide).toBeNull();
  });
});

describe("auto end-game after mate move", () => {
  it("after scholar's mate, store transitions to phase=ended with reason=checkmate", () => {
    // @regression
    getState().setMode("Bullet");
    getState().startGame();
    getState().makeMove("e2", "e4");
    getState().makeMove("e7", "e5");
    getState().makeMove("f1", "c4");
    getState().makeMove("b8", "c6");
    getState().makeMove("d1", "h5");
    getState().makeMove("g8", "f6");
    getState().makeMove("h5", "f7"); // Scholar's mate
    const state = getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.reason).toBe("checkmate");
    expect(state.result?.winner).toBe("white");
  });
});
