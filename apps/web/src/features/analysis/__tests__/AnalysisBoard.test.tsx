// @layer: unit
// @spec: 018-post-game-analysis

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react-chessboard", () => ({
  Chessboard: ({
    customArrows,
  }: {
    customArrows?: [string, string, string][];
  }) => (
    <div
      data-testid="chessboard-mock"
      data-arrows={JSON.stringify(customArrows ?? [])}
    />
  ),
}));

// Import AFTER mock is set up
const { AnalysisBoard } = await import("../AnalysisBoard");

describe("AnalysisBoard", () => {
  it("renders without an arrow when bestMoveUci is null", () => {
    render(
      <AnalysisBoard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        bestMoveUci={null}
        boardOrientation="white"
      />,
    );
    const board = screen.getByTestId("chessboard-mock");
    const arrows = JSON.parse(board.getAttribute("data-arrows") ?? "[]");
    expect(arrows).toHaveLength(0);
  });

  it("renders a green arrow when bestMoveUci is provided", () => {
    render(
      <AnalysisBoard
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        bestMoveUci="e2e4"
        boardOrientation="white"
      />,
    );
    const board = screen.getByTestId("chessboard-mock");
    const arrows = JSON.parse(board.getAttribute("data-arrows") ?? "[]");
    expect(arrows).toHaveLength(1);
    expect(arrows[0][0]).toBe("e2");
    expect(arrows[0][1]).toBe("e4");
    expect(arrows[0][2]).toBe("rgba(0,180,0,0.75)");
  });
});
