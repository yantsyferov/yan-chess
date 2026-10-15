// @layer: integration
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useVsBotStore } from "../useVsBotStore";

// ---------------------------------------------------------------------------
// Mock the clock hooks so rAF / setInterval don't bleed into tests
// ---------------------------------------------------------------------------
vi.mock("../useVsBotGameClock", () => ({
  useVsBotGameClock: () => ({ whiteMs: 180_000, blackMs: 180_000 }),
}));

vi.mock("../useVsBotClockTick", () => ({
  useVsBotClockTick: () => undefined,
}));

// ---------------------------------------------------------------------------
// Mock auth store — we're not testing auth
// ---------------------------------------------------------------------------
vi.mock("../../auth/useAuthStore", () => ({
  useAuthStore: (sel: (s: { user: null }) => unknown) => sel({ user: null }),
}));

// ---------------------------------------------------------------------------
// Import component AFTER mocking
// ---------------------------------------------------------------------------
import { VsBotBoard } from "../VsBotBoard";

function resetStore() {
  const s = useVsBotStore.getState();
  s.newGame();
  s.setLevel("clubPlayer");
  s.setColor("white");
  s.setMode("Blitz");
}

beforeEach(() => {
  resetStore();
  // Transition to playing phase so VsBotBoard renders properly
  useVsBotStore.getState().startGame();
});

describe("VsBotBoard rendering", () => {
  it("shows bot opponent card 'Bot Club Player' with ELO subtitle", () => {
    // @regression
    render(<VsBotBoard />);
    expect(screen.getByText("Bot Club Player")).toBeInTheDocument();
    expect(screen.getByText("1500 ELO")).toBeInTheDocument();
  });

  it("renders MoveHistory section", () => {
    // @regression
    render(<VsBotBoard />);
    // MoveHistory section is present (heading)
    expect(screen.getByText("Moves")).toBeInTheDocument();
  });

  it("shows 'Resign' button", () => {
    // @regression
    render(<VsBotBoard />);
    expect(screen.getByRole("button", { name: /resign/i })).toBeInTheDocument();
  });

  it("does NOT render 'Offer draw' button (spec §2.6)", () => {
    // @regression
    render(<VsBotBoard />);
    expect(screen.queryByRole("button", { name: /offer draw/i })).not.toBeInTheDocument();
  });

  it("shows guest nickname when no user logged in", () => {
    render(<VsBotBoard />);
    expect(screen.getByText("Guest")).toBeInTheDocument();
  });
});
