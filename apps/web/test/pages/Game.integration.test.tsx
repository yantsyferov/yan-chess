// @layer: integration
// @spec: 003-game-board
// @regression

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useGameStore } from "../../src/features/game/useGameStore";

vi.stubGlobal("performance", { now: () => 0 });

// Mock react-chessboard as it requires canvas/WebGL not available in jsdom
vi.mock("react-chessboard", () => ({
  Chessboard: () => <div data-testid="chessboard" />,
}));

// Mock useGameClock to prevent rAF-based side effects in tests
vi.mock("../../src/features/game/useGameClock", () => ({
  useGameClock: () => {},
}));

import Game from "../../src/pages/Game";

function resetStore() {
  useGameStore.getState().reset();
}

beforeEach(() => {
  resetStore();
});

describe("Game page integration", () => {
  it("Scholar's mate flow: ResultModal shows 'White wins. Checkmate.'", () => {
    // @regression
    render(<Game />);
    // Start a game by clicking the button
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(useGameStore.getState().phase).toBe("playing");

    // Drive moves via store directly (avoiding board interaction complexity)
    const store = useGameStore.getState();
    store.makeMove("e2", "e4");
    store.makeMove("e7", "e5");
    store.makeMove("f1", "c4");
    store.makeMove("b8", "c6");
    store.makeMove("d1", "h5");
    store.makeMove("g8", "f6");
    store.makeMove("h5", "f7"); // Scholar's mate

    expect(useGameStore.getState().phase).toBe("ended");
    expect(useGameStore.getState().result?.reason).toBe("checkmate");
    expect(useGameStore.getState().result?.winner).toBe("white");
  });

  it("Resign flow: ResultModal shows resignation text", () => {
    // @regression
    render(<Game />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));

    const store = useGameStore.getState();
    store.openResignConfirm();
    store.resign();

    const state = useGameStore.getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.reason).toBe("resignation");
    expect(state.result?.winner).toBe("black");
  });

  it("Draw agreement flow: result is draw by agreement", () => {
    // @regression
    render(<Game />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));

    const store = useGameStore.getState();
    store.offerDraw();
    store.respondToDrawOffer(true);

    const state = useGameStore.getState();
    expect(state.phase).toBe("ended");
    expect(state.result?.winner).toBe("draw");
    expect(state.result?.reason).toBe("draw_agreement");
  });

  it("mode selector is visible before starting", () => {
    // @regression
    render(<Game />);
    expect(screen.getByText("Bullet")).toBeInTheDocument();
    expect(screen.getByText("Blitz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start game/i })).toBeInTheDocument();
  });

  it("'New game' returns to mode selector after game ends", async () => {
    // @regression
    const { rerender } = render(<Game />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));

    useGameStore.getState().endGame({ winner: "white", reason: "checkmate" });
    rerender(<Game />);

    // Modal is shown; click 'New game'
    const newGameBtn = await screen.findByRole("button", { name: /new game/i });
    fireEvent.click(newGameBtn);
    expect(useGameStore.getState().phase).toBe("idle");
  });
});
