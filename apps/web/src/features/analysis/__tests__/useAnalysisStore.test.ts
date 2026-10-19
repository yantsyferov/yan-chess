// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, beforeEach } from "vitest";
import { useAnalysisStore } from "../useAnalysisStore";
import type { AnalyzedMoveFull } from "../useAnalysisStore";

function makeMove(index: number): AnalyzedMoveFull {
  return {
    moveIndex: index,
    playerColor: index % 2 === 0 ? "white" : "black",
    san: `N${index}f3`,
    playedUci: "g1f3",
    fenAfter: "rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R w KQkq - 2 2",
    category: "Best",
    evaluationCp: 10,
    mateIn: null,
    bestMoveUci: "g1f3",
  };
}

describe("useAnalysisStore", () => {
  beforeEach(() => {
    useAnalysisStore.getState().reset();
  });

  it("has correct initial state", () => {
    const state = useAnalysisStore.getState();
    expect(state.status).toBe("idle");
    expect(state.activeKey).toBeNull();
    expect(state.moves).toHaveLength(0);
    expect(state.progress).toEqual({ done: 0, total: 0 });
    expect(state.error).toBeNull();
  });

  it("startRun transitions to fetching-cache with the given key", () => {
    useAnalysisStore.getState().startRun("game-abc");
    const state = useAnalysisStore.getState();
    expect(state.status).toBe("fetching-cache");
    expect(state.activeKey).toBe("game-abc");
    expect(state.moves).toHaveLength(0);
    expect(state.error).toBeNull();
  });

  it("appendMove accumulates moves one at a time", () => {
    useAnalysisStore.getState().startRun("game-abc");
    useAnalysisStore.getState().appendMove(makeMove(0));
    useAnalysisStore.getState().appendMove(makeMove(1));
    useAnalysisStore.getState().appendMove(makeMove(2));

    const state = useAnalysisStore.getState();
    expect(state.moves).toHaveLength(3);
    expect(state.moves[0].moveIndex).toBe(0);
    expect(state.moves[2].moveIndex).toBe(2);
  });

  it("finishRun sets status to done and stores the complete move list", () => {
    useAnalysisStore.getState().startRun("game-abc");
    const moves = [makeMove(0), makeMove(1), makeMove(2)];
    useAnalysisStore.getState().finishRun(moves);

    const state = useAnalysisStore.getState();
    expect(state.status).toBe("done");
    expect(state.moves).toHaveLength(3);
    expect(state.moves[1].category).toBe("Best");
  });
});
