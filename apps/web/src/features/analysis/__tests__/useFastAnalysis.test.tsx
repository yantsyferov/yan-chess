// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { HalfMoveAnalysis } from "../analysis-engine";

// ---------------------------------------------------------------------------
// Mock AnalysisEngine before importing the hook so the module replacement
// is in place when useFastAnalysis initialises.
// ---------------------------------------------------------------------------

const mockAnalyzeGame = vi.fn();
const mockInit = vi.fn().mockResolvedValue(undefined);
const mockTerminate = vi.fn();

vi.mock("../analysis-engine", () => ({
  AnalysisEngine: vi.fn().mockImplementation(() => ({
    init: mockInit,
    analyzeGame: mockAnalyzeGame,
    terminate: mockTerminate,
  })),
}));

// Mock opening-book so it doesn't need the chess-openings package in tests.
vi.mock("../opening-book", () => ({
  isBookMove: () => false,
}));

import { useFastAnalysis } from "../useFastAnalysis";

// A minimal 4-half-move PGN (2 white + 2 black).
const SIMPLE_PGN = "1. e4 e5 2. Nf3 Nc6";

/**
 * Build mock engine results for each half-move in SIMPLE_PGN.
 * Both moves have cp=20 at every position, so evalBefore=0 (first move),
 * evalAfter=-20 (next position top is 20 for opponent → -20 for us).
 * cpLoss = evalBefore - evalAfter ≈ 0 - (-20) = 20 → Good bucket (≤50 cp).
 * We use clearly-wrong UCIs so "Best" never matches; all 4 end up "Good".
 */
function makeMockResults(count: number): HalfMoveAnalysis[] {
  return Array.from({ length: count }, (_, i) => ({
    halfMoveIndex: i,
    topMoves: [
      { uci: "a1a1", cp: 20, mate: null },
      { uci: "a2a2", cp: 5, mate: null },
    ],
    depth: 10,
  }));
}

describe("useFastAnalysis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInit.mockResolvedValue(undefined);
  });

  it("starts in running status when enabled and pgn provided", async () => {
    // Engine resolves after a small delay so we can observe the running state.
    mockAnalyzeGame.mockImplementation(
      () =>
        new Promise<HalfMoveAnalysis[]>((resolve) =>
          setTimeout(() => resolve(makeMockResults(4)), 50),
        ),
    );

    const { result } = renderHook(() =>
      useFastAnalysis({ pgn: SIMPLE_PGN, enabled: true }),
    );

    // Immediately after render the hook should be running.
    await waitFor(() => {
      expect(result.current.status).toBe("running");
    });
  });

  it("transitions to done with correct bucket totals when engine resolves", async () => {
    // All 4 half-moves will be classified — because played UCI matches
    // topMoves[0] and cpLoss ≤ 0 they all fall into Best (Standout bucket).
    mockAnalyzeGame.mockResolvedValue(makeMockResults(4));

    const { result } = renderHook(() =>
      useFastAnalysis({ pgn: SIMPLE_PGN, enabled: true }),
    );

    await waitFor(() => {
      expect(result.current.status).toBe("done");
    });

    // 4 moves → all Good (cpLoss ~20, ≤50) → normal=4, standout=0, mistake=0
    expect(result.current.buckets).toEqual({
      standout: 0,
      normal: 4,
      mistake: 0,
    });
  });
});
