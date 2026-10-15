// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MoveHistory } from "../MoveHistory";
import { useGameStore } from "../../../features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("MoveHistory", () => {
  it("shows placeholder text when no moves have been made", () => {
    // @regression
    render(<MoveHistory movesSan={[]} />);
    expect(screen.getByText("No moves yet.")).toBeInTheDocument();
  });

  it("shows 2 rows with correct SAN after 4 moves (e4 e5 Nf3 Nc6)", () => {
    // @regression
    useGameStore.getState().setMode("Bullet");
    useGameStore.getState().startGame();
    useGameStore.getState().makeMove("e2", "e4");
    useGameStore.getState().makeMove("e7", "e5");
    useGameStore.getState().makeMove("g1", "f3");
    useGameStore.getState().makeMove("b8", "c6");
    const movesSan = useGameStore.getState().chess.history();
    render(<MoveHistory movesSan={movesSan} />);
    // Row 1: 1. e4 e5
    expect(screen.getByText("e4")).toBeInTheDocument();
    expect(screen.getByText("e5")).toBeInTheDocument();
    // Row 2: 2. Nf3 Nc6
    expect(screen.getByText("Nf3")).toBeInTheDocument();
    expect(screen.getByText("Nc6")).toBeInTheDocument();
    const rows = screen.getAllByRole("row");
    expect(rows.length).toBe(2);
  });

  it("last move cell has highlight class (bg-surface-overlay)", () => {
    // @regression
    useGameStore.getState().setMode("Bullet");
    useGameStore.getState().startGame();
    useGameStore.getState().makeMove("e2", "e4");
    useGameStore.getState().makeMove("e7", "e5");
    const movesSan = useGameStore.getState().chess.history();
    const { container } = render(<MoveHistory movesSan={movesSan} />);
    // The last move (e5, black move in last row) should have bg-surface-overlay
    const highlightedCells = container.querySelectorAll(".bg-surface-overlay");
    expect(highlightedCells.length).toBeGreaterThan(0);
  });
});
