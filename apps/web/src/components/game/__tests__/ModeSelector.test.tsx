// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModeSelector } from "../ModeSelector";
import { useGameStore } from "../../../features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("ModeSelector", () => {
  it("renders 4 mode cards", () => {
    // @regression
    render(<ModeSelector />);
    expect(screen.getByText("Bullet")).toBeInTheDocument();
    expect(screen.getByText("Blitz")).toBeInTheDocument();
    expect(screen.getByText("Rapid")).toBeInTheDocument();
    expect(screen.getByText("Classical")).toBeInTheDocument();
  });

  it("clicking Blitz sets aria-pressed=true on Blitz and false on others", () => {
    // @regression
    render(<ModeSelector />);
    const blitzButton = screen.getByRole("button", { name: /blitz/i });
    fireEvent.click(blitzButton);
    expect(blitzButton).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /bullet/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /rapid/i })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /classical/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("clicking Start game transitions phase to playing", () => {
    // @regression
    render(<ModeSelector />);
    expect(useGameStore.getState().phase).toBe("idle");
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(useGameStore.getState().phase).toBe("playing");
  });
});
