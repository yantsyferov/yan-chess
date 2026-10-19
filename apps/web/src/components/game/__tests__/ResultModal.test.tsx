// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ResultModal } from "../ResultModal";
import { useGameStore } from "../../../features/game/useGameStore";

vi.mock("../../../features/analysis/useFastAnalysis", () => ({
  useFastAnalysis: () => ({ status: "idle", buckets: null, perSideBuckets: null }),
}));
vi.mock("../../../features/analysis/AnalyzeButton", () => ({
  AnalyzeButton: () => <button>Analyze</button>,
}));

vi.stubGlobal("performance", { now: () => 0 });

beforeEach(() => {
  useGameStore.getState().reset();
});

describe("ResultModal", () => {
  it("shows 'White wins. Checkmate.' for white checkmate", () => {
    // @regression
    render(
      <ResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false} pgn=""
        onNewGame={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("White wins. Checkmate.")).toBeInTheDocument();
  });

  it("shows 'Draw. Stalemate.' for stalemate draw", () => {
    // @regression
    render(
      <ResultModal
        result={{ winner: "draw", reason: "stalemate" }}
        resultModalDismissed={false} pgn=""
        onNewGame={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Draw. Stalemate.")).toBeInTheDocument();
  });

  it("shows 'Black wins. Timeout.' for black winner via flag_fall", () => {
    // @regression
    render(
      <ResultModal
        result={{ winner: "black", reason: "flag_fall" }}
        resultModalDismissed={false} pgn=""
        onNewGame={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Black wins. Timeout.")).toBeInTheDocument();
  });

  it("'New game' button calls onNewGame (phase returns to idle)", () => {
    // @regression
    const store = useGameStore.getState();
    render(
      <ResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false} pgn=""
        onNewGame={store.reset}
        onDismiss={store.dismissResult}
      />,
    );
    // Seed ended state
    useGameStore.setState({ phase: "ended", result: { winner: "white", reason: "checkmate" } });
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(useGameStore.getState().phase).toBe("idle");
  });

  it("'Close' button calls onDismiss (modal hidden)", () => {
    // @regression
    const store = useGameStore.getState();
    render(
      <ResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={false} pgn=""
        onNewGame={store.reset}
        onDismiss={store.dismissResult}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(useGameStore.getState().resultModalDismissed).toBe(true);
  });

  it("modal is not rendered when resultModalDismissed=true", () => {
    // @regression
    render(
      <ResultModal
        result={{ winner: "white", reason: "checkmate" }}
        resultModalDismissed={true} pgn=""
        onNewGame={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByText("White wins. Checkmate.")).not.toBeInTheDocument();
  });
});
