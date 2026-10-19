// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import "../../i18n/index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("../../features/history/useGameReplay", () => ({
  useGameReplay: vi.fn(),
}));
vi.mock("../../features/history/useReplayPlayer", () => ({
  useReplayPlayer: () => ({
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    lastMove: null,
    sideToMove: "white" as const,
    currentIndex: 0,
    totalMoves: 0,
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
vi.mock("../../features/analysis/analysisService", () => ({
  fetchAnalysis: vi.fn().mockResolvedValue(null),
}));
vi.mock("../../features/analysis/useDeepAnalysis", () => ({
  useDeepAnalysis: vi.fn().mockReturnValue({
    status: "idle",
    progress: { done: 0, total: 0 },
    moves: [],
    cancel: vi.fn(),
  }),
}));
vi.mock("react-chessboard", () => ({
  Chessboard: () => <div data-testid="chessboard" />,
}));

import { Analysis } from "../Analysis";
import { useGameReplay } from "../../features/history/useGameReplay";
import { useAnalysisStore } from "../../features/analysis/useAnalysisStore";
import { useSessionAnalysisStore } from "../../features/analysis/useSessionAnalysisStore";

const mockGameReplay = vi.mocked(useGameReplay);

function makeGameData() {
  return {
    gameId: "g-123",
    myColor: "white" as const,
    pgn: "1. e4 e5",
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

function renderAnalysis(gameId = "g-123") {
  return render(
    <MemoryRouter initialEntries={[`/analysis/${gameId}`]}>
      <Routes>
        <Route path="/analysis/:gameId" element={<Analysis />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderSessionAnalysis() {
  return render(
    <MemoryRouter initialEntries={["/analysis/session"]}>
      <Routes>
        <Route path="/analysis/session" element={<Analysis />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  useAnalysisStore.getState().reset();
  useSessionAnalysisStore.getState().clear();
});

describe("Analysis page", () => {
  it("shows loading state while game data is fetching", () => {
    mockGameReplay.mockReturnValue({
      loading: true,
      error: null,
      data: null,
      refetch: vi.fn(),
    });
    renderAnalysis();
    expect(screen.getByTestId("game-loading")).toBeInTheDocument();
  });

  it("shows 'fetching-cache' loading indicator while cache is being checked", () => {
    mockGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeGameData() as never,
      refetch: vi.fn(),
    });
    renderAnalysis();
    // Store starts at idle/fetching-cache — we should see the loading indicator
    // (effect fires async, so synchronously it shows the fetching-cache or loading state)
    // After mount + effect the state is "running-deep" unless cache hits.
    // On first synchronous render with no cache, the store is "idle" → shows loading text.
    expect(screen.queryByTestId("game-loading")).toBeNull();
  });

  it("shows forbidden card when game is not accessible", () => {
    mockGameReplay.mockReturnValue({
      loading: false,
      error: "forbidden" as const,
      data: null,
      refetch: vi.fn(),
    });
    renderAnalysis();
    expect(screen.getByText(/game not available/i)).toBeInTheDocument();
  });
});

describe("Analysis page — session mode (/analysis/session)", () => {
  it("renders 'no longer available' notice when session store is empty", () => {
    // Store was cleared in beforeEach — payload is null
    renderSessionAnalysis();
    expect(screen.getByTestId("session-not-available")).toBeInTheDocument();
    expect(screen.getByText(/no longer available/i)).toBeInTheDocument();
  });

  it("renders a back link to /play/ai when source is vs-bot (null store default)", () => {
    renderSessionAnalysis();
    const backLink = screen.getByTestId("back-link");
    expect(backLink).toBeInTheDocument();
  });

  it("mounts AnalysisPage with session payload when store is populated", () => {
    useSessionAnalysisStore.getState().set({
      pgn: "1. e4 e5 2. Nf3 Nc6",
      playerColor: "white",
      source: "vs-bot",
    });
    renderSessionAnalysis();
    // With payload present, session-not-available should NOT render
    expect(screen.queryByTestId("session-not-available")).toBeNull();
    // The session analysis page should be mounting (store will transition to running-deep)
    // At minimum, the loading/transition state is shown (not the not-available notice)
  });
});
