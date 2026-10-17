// @layer: unit
// @spec: 017-home-games-list

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import "../../i18n/index";

// Mock GameHistorySection — heavy component not under test
vi.mock("../../features/history/GameHistorySection", () => ({
  GameHistorySection: () => <div data-testid="game-history-section" />,
}));

import { History } from "../History";

function renderHistory() {
  return render(
    <MemoryRouter>
      <History />
    </MemoryRouter>,
  );
}

describe("History page", () => {
  it("renders the 'Game history' heading via t('history:title')", () => {
    renderHistory();
    expect(screen.getByRole("heading", { level: 1, name: /game history/i })).toBeInTheDocument();
  });

  it("mounts <GameHistorySection />", () => {
    renderHistory();
    expect(screen.getByTestId("game-history-section")).toBeInTheDocument();
  });

  it("heading is an h1 element (not h2 or other level)", () => {
    renderHistory();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toBeInTheDocument();
  });
});
