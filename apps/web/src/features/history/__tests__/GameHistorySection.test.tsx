// @layer: integration
// @spec: 006-game-history
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

// ── Mock useGamesList ────────────────────────────────────────────────────────
vi.mock("../useGamesList", () => ({
  useGamesList: vi.fn(),
}));

// ── Mock GameRow (avoid router dependencies in items) ────────────────────────
vi.mock("../GameRow", () => ({
  GameRow: ({ item }: { item: { gameId: string; result: string } }) => (
    <div data-testid={`game-row-${item.gameId}`} data-result={item.result}>
      {item.gameId}
    </div>
  ),
}));

// ── Mock HistoryFilters to avoid router useSearchParams ──────────────────────
vi.mock("../HistoryFilters", () => ({
  HistoryFilters: ({
    onChange,
  }: {
    mode: string | null;
    result: string | null;
    onChange: (v: { mode: string | null; result: string | null }) => void;
  }) => (
    <button data-testid="clear-filters-mock" onClick={() => onChange({ mode: null, result: null })}>
      Clear
    </button>
  ),
}));

import { useGamesList } from "../useGamesList";
import { GameHistorySection } from "../GameHistorySection";
import type { GameListItem, GameListPagination } from "@yanchess/shared";

const mockUseGamesList = useGamesList as ReturnType<typeof vi.fn>;

function makeItem(id: string, result: "win" | "loss" | "draw" = "win"): GameListItem {
  return {
    gameId: id,
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", ratingAfter: 1484 },
    result,
    endReason: "resignation",
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: result === "win" ? 16 : result === "loss" ? -16 : 0,
    isRated: true,
    startedAt: "2026-10-11T18:00:00Z",
    endedAt: "2026-10-11T18:05:00Z",
  };
}

function makePagination(page: number, totalPages: number, totalGames: number): GameListPagination {
  return { page, perPage: 20, totalPages, totalGames };
}

function wrap(ui: React.ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GameHistorySection", () => {
  it("@regression renders skeleton while loading", () => {
    mockUseGamesList.mockReturnValue({
      games: [],
      pagination: null,
      loading: true,
      error: null,
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    // Skeleton: animate-pulse divs are present (no game rows)
    expect(screen.queryByTestId(/game-row/)).toBeNull();
    // The section heading is visible even while loading
    expect(screen.getByText("Game history")).toBeInTheDocument();
    // Skeleton pulse elements are present
    const pulseEls = document.querySelectorAll(".animate-pulse");
    expect(pulseEls.length).toBeGreaterThan(0);
  });

  it("@regression renders game rows after load", () => {
    mockUseGamesList.mockReturnValue({
      games: [makeItem("g1"), makeItem("g2"), makeItem("g3")],
      pagination: makePagination(1, 1, 3),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    expect(screen.getByTestId("game-row-g1")).toBeInTheDocument();
    expect(screen.getByTestId("game-row-g2")).toBeInTheDocument();
    expect(screen.getByTestId("game-row-g3")).toBeInTheDocument();
  });

  it("@regression empty state (no games, no filters) shows 'No games yet'", () => {
    mockUseGamesList.mockReturnValue({
      games: [],
      pagination: makePagination(1, 1, 0),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    expect(screen.getByText("No games yet")).toBeInTheDocument();
    expect(screen.getByText(/Finish an online game/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find game" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play vs bot" })).toBeInTheDocument();
  });

  it("@regression no-match state (0 games with filters applied) shows inline message", async () => {
    // GameHistorySection reads mode/result from URL; with MemoryRouter and no params
    // it treats them as null. We need a URL with filter params to trigger the no-match state.
    mockUseGamesList.mockReturnValue({
      games: [],
      pagination: makePagination(1, 1, 0),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    render(
      <MemoryRouter initialEntries={["/?mode=Blitz"]}>
        <GameHistorySection />
      </MemoryRouter>,
    );
    expect(screen.getByText("No games match these filters.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeInTheDocument();
  });

  it("@regression pagination renders when totalPages > 1", () => {
    const games = Array.from({ length: 20 }, (_, i) => makeItem(`game-${i}`));
    mockUseGamesList.mockReturnValue({
      games,
      pagination: makePagination(1, 3, 55),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    // Pagination nav should be present
    expect(screen.getByRole("navigation", { name: "Game history pagination" })).toBeInTheDocument();
  });

  it("pagination is hidden when totalPages <= 1", () => {
    mockUseGamesList.mockReturnValue({
      games: [makeItem("g1")],
      pagination: makePagination(1, 1, 1),
      loading: false,
      error: null,
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    expect(screen.queryByRole("navigation", { name: "Game history pagination" })).toBeNull();
  });

  it("error state shows error message with Try again button", () => {
    const refetch = vi.fn();
    mockUseGamesList.mockReturnValue({
      games: [],
      pagination: null,
      loading: false,
      error: "Failed to load game history.",
      refetch,
    });
    wrap(<GameHistorySection />);
    expect(screen.getByText("Failed to load game history.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("negative: error state does not show game rows", () => {
    mockUseGamesList.mockReturnValue({
      games: [],
      pagination: null,
      loading: false,
      error: "Network error",
      refetch: vi.fn(),
    });
    wrap(<GameHistorySection />);
    expect(screen.queryByTestId(/game-row/)).toBeNull();
  });
});
