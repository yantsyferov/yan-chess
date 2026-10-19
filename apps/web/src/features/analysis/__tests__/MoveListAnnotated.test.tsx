// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MoveListAnnotated } from "../MoveListAnnotated";
import type { AnalysisMove } from "@yanchess/shared";

interface AnalyzedMove extends AnalysisMove {
  san: string;
}

const MOVES: AnalyzedMove[] = [
  {
    moveIndex: 0,
    playerColor: "white",
    category: "Best",
    evaluationCp: 20,
    mateIn: null,
    bestMoveUci: "e2e4",
    san: "e4",
  },
  {
    moveIndex: 1,
    playerColor: "black",
    category: "Blunder",
    evaluationCp: -300,
    mateIn: null,
    bestMoveUci: "d7d5",
    san: "d5",
  },
  {
    moveIndex: 2,
    playerColor: "white",
    category: "Miss",
    evaluationCp: 50,
    mateIn: null,
    bestMoveUci: "d2d4",
    san: "d4",
  },
];

describe("MoveListAnnotated", () => {
  it("renders moves with correct glyphs per category", () => {
    render(
      <MoveListAnnotated
        moves={MOVES}
        currentIndex={0}
        onMoveClick={vi.fn()}
        engineSuggestedSan={null}
      />,
    );

    // Best → ★
    const bestBtn = screen.getByTestId("move-btn-0");
    expect(bestBtn.textContent).toContain("★");

    // Blunder → ??
    const blunderBtn = screen.getByTestId("move-btn-1");
    expect(blunderBtn.textContent).toContain("??");

    // Miss → ×
    const missBtn = screen.getByTestId("move-btn-2");
    expect(missBtn.textContent).toContain("×");
  });

  it("highlights only the button at currentIndex", () => {
    render(
      <MoveListAnnotated
        moves={MOVES}
        currentIndex={2}
        onMoveClick={vi.fn()}
        engineSuggestedSan={null}
      />,
    );

    // moveIndex=1 → currentIndex = 1+1 = 2 → active
    const activeBtn = screen.getByTestId("move-btn-1");
    expect(activeBtn.className).toContain("bg-accent");

    // Others not active
    const inactiveBtn = screen.getByTestId("move-btn-0");
    expect(inactiveBtn.className).not.toContain("bg-accent");
  });

  it("calls onMoveClick with correct index when a move button is clicked", () => {
    const onMoveClick = vi.fn();
    render(
      <MoveListAnnotated
        moves={MOVES}
        currentIndex={0}
        onMoveClick={onMoveClick}
        engineSuggestedSan={null}
      />,
    );

    // Click move at moveIndex=2 → should call with 3
    fireEvent.click(screen.getByTestId("move-btn-2"));
    expect(onMoveClick).toHaveBeenCalledWith(3);
  });
});
