// @layer: integration
// @spec: 006-game-history
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import React from "react";

// ── Mock useGameReplay ────────────────────────────────────────────────────────
const mockUseGameReplay = vi.fn();
vi.mock("../useGameReplay", () => ({
  useGameReplay: (...args: unknown[]) => mockUseGameReplay(...args),
}));

// ── Mock auth store ───────────────────────────────────────────────────────────
vi.mock("../../auth/useAuthStore", () => ({
  useAuthStore: (sel: (s: { user: { id: string } }) => unknown) =>
    sel({ user: { id: "user-alice" } }),
}));

// ── Mock ReplayBoard to avoid board-render complexity ─────────────────────────
vi.mock("../ReplayBoard", () => ({
  ReplayBoard: () => <div data-testid="replay-board">ReplayBoard</div>,
}));

import { HistoryReplay } from "../../../pages/HistoryReplay";
import type { ReplayData } from "../useGameReplay";

function makeReplayData(): ReplayData {
  return {
    gameId: "game-abc",
    mode: "Blitz",
    timeControlMs: 180_000,
    pgn: "[Event \"?\"]\n1. e4 e5 *",
    finalFen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
    white: { userId: "user-alice", nickname: "alice", ratingBefore: 1500, ratingAfter: 1516 },
    black: { userId: "user-bob", nickname: "bob", ratingBefore: 1500, ratingAfter: 1484 },
    result: "white_win",
    endReason: "resignation",
    startedAt: "2026-10-11T18:00:00Z",
    endedAt: "2026-10-11T18:05:00Z",
    verboseMoves: [
      { from: "e2", to: "e4", san: "e4" },
      { from: "e7", to: "e5", san: "e5" },
    ],
    movesSan: ["e4", "e5"],
    myColor: "white",
  };
}

function wrap(gameId = "game-abc") {
  return render(
    <MemoryRouter initialEntries={[`/history/${gameId}`]}>
      <Routes>
        <Route path="/history/:gameId" element={<HistoryReplay />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("HistoryReplay page", () => {
  it("@regression shows loading state while fetch in progress", () => {
    mockUseGameReplay.mockReturnValue({ loading: true, error: null, data: null, refetch: vi.fn() });
    wrap();
    expect(screen.getByText(/Loading game/i)).toBeInTheDocument();
  });

  it("@regression 403 error shows 'Game not available' with back link", () => {
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: "forbidden",
      data: null,
      refetch: vi.fn(),
    });
    wrap();
    expect(screen.getByText("Game not available")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to history/ })).toBeInTheDocument();
  });

  it("@regression network error shows 'Couldn't load game.' with Try again button", () => {
    const refetch = vi.fn();
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: "network",
      data: null,
      refetch,
    });
    wrap();
    expect(screen.getByText("Couldn't load game.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("@regression Try again button calls refetch", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: "network",
      data: null,
      refetch,
    });
    wrap();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("@regression happy path renders ReplayBoard and ReplayControls", () => {
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeReplayData(),
      refetch: vi.fn(),
    });
    wrap();
    expect(screen.getByTestId("replay-board")).toBeInTheDocument();
    // ReplayControls renders buttons with aria-labels
    expect(screen.getByRole("button", { name: "First move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Last move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous move" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next move" })).toBeInTheDocument();
  });

  it("@regression happy path shows 'Back to history' link", () => {
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: null,
      data: makeReplayData(),
      refetch: vi.fn(),
    });
    wrap();
    expect(screen.getByRole("link", { name: /Back to history/ })).toBeInTheDocument();
  });

  it("negative: loading state does not render ReplayBoard", () => {
    mockUseGameReplay.mockReturnValue({ loading: true, error: null, data: null, refetch: vi.fn() });
    wrap();
    expect(screen.queryByTestId("replay-board")).toBeNull();
  });

  it("negative: forbidden error does not render ReplayBoard", () => {
    mockUseGameReplay.mockReturnValue({
      loading: false,
      error: "forbidden",
      data: null,
      refetch: vi.fn(),
    });
    wrap();
    expect(screen.queryByTestId("replay-board")).toBeNull();
  });
});
