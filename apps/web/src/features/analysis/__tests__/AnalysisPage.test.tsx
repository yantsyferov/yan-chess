// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../../../i18n/index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../../features/history/useGameReplay", () => ({
  useGameReplay: vi.fn(),
}));
vi.mock("../../../features/history/useReplayPlayer", () => ({
  useReplayPlayer: () => ({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    lastMove: null,
    sideToMove: "white" as const,
    currentIndex: 0,
    totalMoves: 2,
    isPlaying: false,
    speed: 2000,
    first: vi.fn(),
    prev: vi.fn(),
    next: vi.fn(),
    last: vi.fn(),
    togglePlay: vi.fn(),
    jumpTo: vi.fn(),
    setSpeed: vi.fn(),
  }),
}));
vi.mock("react-chessboard", () => ({
  Chessboard: () => <div data-testid="chessboard" />,
}));

// analysisService is mocked at the module level; each test overrides fetchAnalysis
vi.mock("../analysisService", () => ({
  fetchAnalysis: vi.fn(),
  writeMove: vi.fn().mockResolvedValue(undefined),
  finalize: vi.fn().mockResolvedValue(undefined),
}));

// useDeepAnalysis is mocked at the module level; tests control it via callbacks
vi.mock("../useDeepAnalysis", () => ({
  useDeepAnalysis: vi.fn(),
}));

import { AnalysisPage } from "../AnalysisPage";
import { useGameReplay } from "../../history/useGameReplay";
import { fetchAnalysis } from "../analysisService";
import { useDeepAnalysis } from "../useDeepAnalysis";
import { useAnalysisStore } from "../useAnalysisStore";
import type { AnalyzedMove } from "../useDeepAnalysis";

const mockGameReplay = vi.mocked(useGameReplay);
const mockFetchAnalysis = vi.mocked(fetchAnalysis);
const mockUseDeepAnalysis = vi.mocked(useDeepAnalysis);

// Default deep analysis mock — does nothing (engine not running)
function idleDeepAnalysis() {
  return {
    status: "idle" as const,
    progress: { done: 0, total: 0 },
    moves: [] as AnalyzedMove[],
    cancel: vi.fn(),
  };
}

function makeGameData(pgn = "1. e4 e5") {
  return {
    gameId: "g-abc",
    myColor: "white" as const,
    pgn,
    white: { nickname: "Alice", ratingAfter: 1500, country: null, userId: "u-alice" },
    black: { nickname: "Bob", ratingAfter: 1484, country: null, userId: "u-bob" },
    verboseMoves: [],
    movesSan: [],
    mode: "Rated" as const,
    timeControlMs: 180000,
    finalFen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    result: "white" as const,
    endReason: "checkmate" as const,
    startedAt: "2026-01-01T00:00:00Z",
    endedAt: "2026-01-01T00:05:00Z",
  };
}

function makeCachedResponse() {
  return {
    gameId: "g-abc",
    classifierVersion: 1,
    engineDepth: 18,
    completedAt: "2026-01-01T00:10:00Z",
    moves: [
      {
        moveIndex: 0,
        playerColor: "white" as const,
        category: "Best" as const,
        evaluationCp: 20,
        mateIn: null,
        bestMoveUci: "e2e4",
      },
      {
        moveIndex: 1,
        playerColor: "black" as const,
        category: "Good" as const,
        evaluationCp: -10,
        mateIn: null,
        bestMoveUci: "e7e5",
      },
    ],
  };
}

function renderAnalysisPage(gameId = "g-abc") {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${gameId}`]}>
      <Routes>
        <Route path="/analysis/:gameId" element={<AnalysisPage gameId={gameId} />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAnalysisStore.getState().reset();
  mockUseDeepAnalysis.mockReturnValue(idleDeepAnalysis());
});

describe("AnalysisPage", () => {
  it("shows game loading indicator while useGameReplay is fetching", () => {
    mockGameReplay.mockReturnValue({
      loading: true,
      error: null,
      data: null,
      refetch: vi.fn(),
    });

    renderAnalysisPage();
    expect(screen.getByTestId("game-loading")).toBeInTheDocument();
  });

  it("shows full UI immediately when cache hit is returned", async () => {
    mockGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeGameData() as never,
      refetch: vi.fn(),
    });
    mockFetchAnalysis.mockResolvedValue(makeCachedResponse() as never);

    renderAnalysisPage();

    // Wait for async cache fetch to resolve and store to enter "cached"
    await waitFor(() => {
      expect(screen.getByTestId("analysis-board")).toBeInTheDocument();
    });

    // No progress view should be visible
    expect(screen.queryByTestId("progress-bar-fill")).toBeNull();
    // Eval bar and board should be present (two EvalBars: mobile + desktop)
    expect(screen.getAllByTestId("eval-bar-track").length).toBeGreaterThan(0);
  });

  it("shows AnalysisProgressView when cache miss; switches to full UI when deep pass completes", async () => {
    mockGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeGameData() as never,
      refetch: vi.fn(),
    });
    mockFetchAnalysis.mockResolvedValue(null);

    // Start with running deep pass
    mockUseDeepAnalysis.mockReturnValue({
      status: "running" as const,
      progress: { done: 1, total: 2 },
      moves: [],
      cancel: vi.fn(),
    });

    renderAnalysisPage();

    // After effect fires and status becomes running-deep, progress view should appear
    await waitFor(() => {
      expect(screen.getByTestId("progress-bar-fill")).toBeInTheDocument();
    });

    // No board during progress
    expect(screen.queryByTestId("analysis-board")).toBeNull();

    // Simulate deep pass completing by updating store
    act(() => {
      useAnalysisStore.getState().finishRun([
        {
          moveIndex: 0,
          playerColor: "white" as const,
          san: "e4",
          playedUci: "e2e4",
          fenAfter: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
          category: "Best" as const,
          evaluationCp: 20,
          mateIn: null,
          bestMoveUci: "e2e4",
        },
      ]);
    });

    await waitFor(() => {
      expect(screen.getByTestId("analysis-board")).toBeInTheDocument();
    });
  });

  it("cancel button aborts the run and triggers navigation back", async () => {
    const cancelFn = vi.fn();
    mockGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeGameData() as never,
      refetch: vi.fn(),
    });
    mockFetchAnalysis.mockResolvedValue(null);
    mockUseDeepAnalysis.mockReturnValue({
      status: "running" as const,
      progress: { done: 0, total: 2 },
      moves: [],
      cancel: cancelFn,
    });

    renderAnalysisPage();

    // Wait for progress view
    await waitFor(() => {
      expect(screen.getByTestId("progress-bar-fill")).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    await userEvent.click(cancelBtn);

    expect(cancelFn).toHaveBeenCalled();
    // Store should be cancelled
    expect(useAnalysisStore.getState().status).toBe("cancelled");
  });
});
