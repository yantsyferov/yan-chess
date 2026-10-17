// @layer: integration
// @spec: 017-home-games-list

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

// ── Mock useGamesList ────────────────────────────────────────────────────────
vi.mock("../useGamesList", () => ({
  useGamesList: vi.fn(),
}));

// ── Mock GameRow ─────────────────────────────────────────────────────────────
vi.mock("../GameRow", () => ({
  GameRow: ({ item }: { item: { gameId: string } }) => (
    <div data-testid={`game-row-${item.gameId}`}>{item.gameId}</div>
  ),
}));

import { useGamesList } from "../useGamesList";
import { RecentGamesSection } from "../RecentGamesSection";
import type { GameListItem } from "@yanchess/shared";

const mockUseGamesList = useGamesList as ReturnType<typeof vi.fn>;

function makeItem(id: string): GameListItem {
  return {
    gameId: id,
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", country: null, ratingAfter: 1484 },
    result: "win",
    endReason: "resignation",
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: 16,
    isRated: true,
    startedAt: "2026-10-11T18:00:00Z",
    endedAt: "2026-10-11T18:05:00Z",
  };
}

function makeDefaultReturn(overrides: Partial<ReturnType<typeof useGamesList>> = {}): ReturnType<typeof useGamesList> {
  return {
    games: [],
    pagination: null,
    loading: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

async function setupI18n(lang: string): Promise<void> {
  if (!i18next.isInitialized) {
    await i18next.use(initReactI18next).init({
      lng: lang,
      resources: {
        en: {
          history: {
            recentGames: "Recent games",
            viewAllGames: "View all games",
            emptyTitle: "No games yet",
            emptyBody: "Finish an online game — it will show up here.",
            emptyActions: { findGame: "Find game", playBot: "Play vs bot" },
          },
        },
        ru: {
          history: {
            recentGames: "Недавние партии",
            viewAllGames: "Все партии",
            emptyTitle: "Партий пока нет",
            emptyBody: "Завершите онлайн-партию — она появится здесь.",
            emptyActions: { findGame: "Найти партию", playBot: "Играть против бота" },
          },
        },
      },
      fallbackLng: "en",
      interpolation: { escapeValue: false },
    });
  } else {
    await i18next.changeLanguage(lang);
  }
}

function renderSection(): ReturnType<typeof render> {
  return render(
    <MemoryRouter>
      <RecentGamesSection />
    </MemoryRouter>,
  );
}

describe("RecentGamesSection", () => {
  beforeEach(async () => {
    await setupI18n("en");
    mockUseGamesList.mockReset();
  });

  it("renders N game rows for N games", () => {
    const games = [makeItem("g1"), makeItem("g2"), makeItem("g3")];
    mockUseGamesList.mockReturnValue(makeDefaultReturn({ games }));

    renderSection();

    expect(screen.getByTestId("game-row-g1")).toBeDefined();
    expect(screen.getByTestId("game-row-g2")).toBeDefined();
    expect(screen.getByTestId("game-row-g3")).toBeDefined();
  });

  it("shows 'View all games' link when games exist", () => {
    mockUseGamesList.mockReturnValue(makeDefaultReturn({ games: [makeItem("g1")] }));

    renderSection();

    const link = screen.getByRole("link", { name: /view all games/i });
    expect(link).toBeDefined();
    // Link should point to /history
    expect((link as HTMLAnchorElement).getAttribute("href")).toBe("/history");
  });

  it("does not show 'View all games' link when no games", () => {
    mockUseGamesList.mockReturnValue(makeDefaultReturn({ games: [] }));

    renderSection();

    expect(screen.queryByRole("link", { name: /view all games/i })).toBeNull();
  });

  it("renders empty state when games array is empty", () => {
    mockUseGamesList.mockReturnValue(makeDefaultReturn({ games: [] }));

    renderSection();

    expect(screen.getByText("No games yet")).toBeDefined();
  });

  it("renders heading in Russian when i18n language is ru", async () => {
    await setupI18n("ru");
    mockUseGamesList.mockReturnValue(makeDefaultReturn({ games: [makeItem("g1")] }));

    renderSection();

    expect(screen.getByText("Недавние партии")).toBeDefined();
  });
});
