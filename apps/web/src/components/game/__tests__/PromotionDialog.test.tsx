// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PromotionDialog } from "../PromotionDialog";
import { useGameStore } from "../../../features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
  useGameStore.getState().setMode("Bullet");
  useGameStore.getState().startGame();
  // Load a position with white pawn ready to promote
  useGameStore.getState().chess.load("8/P7/8/8/8/8/8/k1K5 w - - 0 1");
});

describe("PromotionDialog", () => {
  it("when pendingPromotion is set, dialog shows 4 piece buttons", () => {
    // @regression
    render(
      <PromotionDialog
        pending={{ from: "a7", to: "a8" }}
        promotingColor="w"
        onPromote={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /queen/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rook/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bishop/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /knight/i })).toBeInTheDocument();
  });

  it("queen button is the first among piece buttons (autoFocus is applied to index=0)", () => {
    // @regression
    render(
      <PromotionDialog
        pending={{ from: "a7", to: "a8" }}
        promotingColor="w"
        onPromote={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const pieceLabels = ["Queen", "Rook", "Bishop", "Knight"];
    const buttons = pieceLabels.map((label) => screen.getByRole("button", { name: label }));
    const parent = buttons[0].parentElement!;
    const allChildren = Array.from(parent.children);
    expect(allChildren.indexOf(buttons[0])).toBe(0); // Queen is at index 0
    expect(allChildren.indexOf(buttons[1])).toBe(1); // Rook is at index 1
  });

  it("clicking Rook calls onPromote with 'r'", () => {
    // @regression
    const onPromote = vi.fn();
    render(
      <PromotionDialog
        pending={{ from: "a7", to: "a8" }}
        promotingColor="w"
        onPromote={onPromote}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /rook/i }));
    expect(onPromote).toHaveBeenCalledWith("r");
  });

  it("dialog is not visible when pending is null", () => {
    // @regression
    render(
      <PromotionDialog
        pending={null}
        promotingColor="w"
        onPromote={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /queen/i })).not.toBeInTheDocument();
  });
});
