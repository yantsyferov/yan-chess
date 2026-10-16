// @layer: integration
// @spec: 006-game-history
// @regression

import { describe, it, expect, vi, afterAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import i18n from "../../../i18n";
import { MemoryRouter } from "react-router-dom";
import type { GameListItem } from "@yanchess/shared";

// Mock useNavigate — GameRow uses navigate() on row click
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { GameRow } from "../GameRow";

function makeItem(overrides: Partial<GameListItem> = {}): GameListItem {
  return {
    gameId: "game-abc",
    mode: "Blitz",
    playerColor: "white",
    opponent: { nickname: "bob", ratingAfter: 1484 },
    result: "win",
    endReason: "resignation",
    ratingBefore: 1500,
    ratingAfter: 1516,
    ratingDelta: 16,
    isRated: true,
    startedAt: "2026-10-11T18:00:00.000Z",
    endedAt: "2026-10-11T18:05:00.000Z",
    ...overrides,
  };
}

function wrap(item: GameListItem) {
  return render(
    <MemoryRouter>
      <GameRow item={item} />
    </MemoryRouter>,
  );
}

describe("GameRow", () => {
  it("@regression win row shows Win label, Resignation reason, positive delta", () => {
    wrap(makeItem({ result: "win", endReason: "resignation", ratingDelta: 16 }));
    expect(screen.getByText(/Win/)).toBeInTheDocument();
    expect(screen.getByText(/Resignation/)).toBeInTheDocument();
    expect(screen.getByText("+16")).toBeInTheDocument();
  });

  it("@regression win row has faint green background class", () => {
    wrap(makeItem({ result: "win" }));
    const row = screen.getByRole("row");
    expect(row.className).toContain("bg-green-900");
  });

  it("@regression loss row shows Loss label, negative delta with unicode minus", () => {
    wrap(makeItem({ result: "loss", endReason: "flag", ratingDelta: -16 }));
    expect(screen.getByText(/Loss/)).toBeInTheDocument();
    expect(screen.getByText(/Flag/)).toBeInTheDocument();
    // Unicode minus sign U+2212
    expect(screen.getByText(/−16/)).toBeInTheDocument();
  });

  it("@regression loss row has faint red background class", () => {
    wrap(makeItem({ result: "loss" }));
    const row = screen.getByRole("row");
    expect(row.className).toContain("bg-red-900");
  });

  it("@regression draw row shows Draw label, Agreement reason, zero delta", () => {
    wrap(makeItem({ result: "draw", endReason: "agreement", ratingDelta: 0 }));
    expect(screen.getByText(/Draw/)).toBeInTheDocument();
    expect(screen.getByText(/Agreement/)).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("@regression draw row has neutral (no color) background", () => {
    wrap(makeItem({ result: "draw" }));
    const row = screen.getByRole("row");
    expect(row.className).not.toContain("bg-green-900");
    expect(row.className).not.toContain("bg-red-900");
  });

  it("@regression shows opponent nickname and rating", () => {
    wrap(makeItem({ opponent: { nickname: "charlie", ratingAfter: 1600 } }));
    expect(screen.getByText(/charlie/)).toBeInTheDocument();
    expect(screen.getByText(/1600/)).toBeInTheDocument();
  });

  it("@regression shows Replay link pointing to /history/:gameId", () => {
    wrap(makeItem({ gameId: "abc-123" }));
    const link = screen.getByRole("link", { name: /Replay/ });
    expect(link).toBeInTheDocument();
    expect((link as HTMLAnchorElement).href).toContain("/history/abc-123");
  });

  it("@regression clicking the row navigates to replay", async () => {
    const user = userEvent.setup();
    wrap(makeItem({ gameId: "abc-123" }));
    await user.click(screen.getByRole("row"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "/history/abc-123",
      expect.objectContaining({ state: expect.anything() }),
    );
  });

  it("negative: Replay link click does not double-navigate (stopPropagation)", async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();
    wrap(makeItem({ gameId: "abc-123" }));
    const link = screen.getByRole("link", { name: /Replay/ });
    await user.click(link);
    // Link handles navigation via href; navigate() should NOT be called
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // @spec: 014-play-redesign
  describe("Rated/Casual badge", () => {
    afterAll(() => {
      void i18n.changeLanguage("en");
    });

    it("isRated=true shows Rated badge and not Casual badge", () => {
      wrap(makeItem({ isRated: true }));
      expect(screen.getByText("Rated")).toBeInTheDocument();
      expect(screen.queryByText("Casual")).not.toBeInTheDocument();
    });

    it("isRated=false shows Casual badge and not Rated badge", () => {
      wrap(makeItem({ isRated: false }));
      expect(screen.getByText("Casual")).toBeInTheDocument();
      expect(screen.queryByText("Rated")).not.toBeInTheDocument();
    });

    it("badge text matches Russian locale", () => {
      i18n.changeLanguage("ru");
      wrap(makeItem({ isRated: true }));
      expect(screen.getByText("Рейтинговая")).toBeInTheDocument();
      expect(screen.queryByText("Нерейтинговая")).not.toBeInTheDocument();
    });
  });
});
