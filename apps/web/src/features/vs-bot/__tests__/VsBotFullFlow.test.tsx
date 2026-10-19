// @layer: integration
// @spec: 005-play-vs-bot
// @regression

/**
 * Full-flow integration test: mounts the pure store + drives it through a
 * complete vs-bot sequence WITHOUT rendering VsBot.tsx (which would try to
 * instantiate a real Stockfish Web Worker).
 *
 * Sequence:
 *   setup → startGame (white) → playerMove e2-e4 → applyBotMove e7-e5
 *   → both moves in history → sideToMove=white → resign → result modal
 *   shows resign title → newGame → back to setup phase
 *
 * The "UI" assertions use VsBotResultModal rendered directly with the result
 * state to verify the correct title is produced without needing the full page.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useVsBotStore } from "../useVsBotStore";
import { VsBotResultModal } from "../VsBotResultModal";

vi.mock("../../analysis/useFastAnalysis", () => ({
  useFastAnalysis: () => ({ status: "idle", buckets: null }),
}));
vi.mock("../../analysis/AnalyzeButton", () => ({
  AnalyzeButton: () => <button>Analyze</button>,
}));

function resetStore() {
  const s = useVsBotStore.getState();
  s.newGame();
  s.setLevel("clubPlayer");
  s.setColor("white");
  s.setMode("Blitz");
}

beforeEach(() => {
  resetStore();
});

describe("Full flow: setup → play → resign → result → newGame", () => {
  it("completes the entire game lifecycle with correct state transitions", () => {
    // @regression
    const s = useVsBotStore.getState;

    // 1. Start game as white
    s().startGame();
    expect(s().phase).toBe("playing");
    expect(s().playerColor).toBe("white");
    expect(s().botThinking).toBe(false);

    // 2. Player makes e2-e4
    const fenAfterSetup = s().fen;
    s().playerMove("e2", "e4");
    expect(s().fen).not.toBe(fenAfterSetup);
    expect(s().movesSan).toContain("e4");
    expect(s().sideToMove).toBe("black");
    expect(s().botThinking).toBe(true);

    // 3. Mock engine responds with e7-e5
    s().applyBotMove("e7", "e5");
    expect(s().movesSan).toHaveLength(2);
    expect(s().movesSan[1]).toContain("e5");
    expect(s().sideToMove).toBe("white");
    expect(s().botThinking).toBe(false);

    // 4. Player resigns
    s().requestResign();
    expect(s().pendingResign).toBe(true);
    s().resign();
    expect(s().phase).toBe("result");
    expect(s().result?.reason).toBe("resignation");
    expect(s().result?.winner).toBe("black"); // bot wins
  });

  it("VsBotResultModal shows resign title after player resignation", () => {
    // @regression
    useVsBotStore.getState().startGame();
    useVsBotStore.getState().playerMove("e2", "e4");
    useVsBotStore.getState().applyBotMove("e7", "e5");
    useVsBotStore.getState().requestResign();
    useVsBotStore.getState().resign();

    const result = useVsBotStore.getState().result!;
    const playerColor = useVsBotStore.getState().playerColor!;

    render(
      <VsBotResultModal
        result={result}
        resultModalDismissed={false}
        playerColor={playerColor}
        movesSan={[]}
        onDismiss={vi.fn()}
        onNewGame={vi.fn()}
        onRematch={vi.fn()}
      />,
    );

    expect(screen.getByText("You resigned. Bot wins.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
  });

  it("clicking 'New game' via store.newGame() returns to setup phase", () => {
    // @regression
    useVsBotStore.getState().startGame();
    useVsBotStore.getState().playerMove("e2", "e4");
    useVsBotStore.getState().applyBotMove("e7", "e5");
    useVsBotStore.getState().resign();
    useVsBotStore.getState().newGame();

    const s = useVsBotStore.getState();
    expect(s.phase).toBe("setup");
    expect(s.movesSan).toHaveLength(0);
    expect(s.result).toBeNull();
    expect(s.playerColor).toBeNull();
  });
});
