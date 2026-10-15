// @layer: unit
// @spec: 005-play-vs-bot
// @regression

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useVsBotStore } from "../useVsBotStore";

function getState() {
  return useVsBotStore.getState();
}

function resetStore() {
  // Force store back to defaults between tests
  const s = getState();
  s.newGame();
  // Also reset setup to defaults
  s.setLevel("clubPlayer");
  s.setColor("white");
  s.setMode("Blitz");
}

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// startGame - color: white
// ---------------------------------------------------------------------------

describe("startGame with color: white", () => {
  it("sets playerColor = white and botThinking = false immediately", () => {
    // @regression
    getState().startGame();
    const s = getState();
    expect(s.playerColor).toBe("white");
    expect(s.botThinking).toBe(false);
    expect(s.phase).toBe("playing");
  });

  it("clocks are initialized from Blitz (180000 ms) for both sides", () => {
    // @regression
    getState().startGame();
    const { clocks } = getState();
    expect(clocks.whiteMs).toBe(180_000);
    expect(clocks.blackMs).toBe(180_000);
  });

  it("sideToMove starts as white", () => {
    getState().startGame();
    expect(getState().sideToMove).toBe("white");
  });
});

// ---------------------------------------------------------------------------
// startGame - color: black
// ---------------------------------------------------------------------------

describe("startGame with color: black", () => {
  it("sets botThinking = true immediately so engine effect fires", () => {
    // @regression
    getState().setColor("black");
    getState().startGame();
    const s = getState();
    expect(s.playerColor).toBe("black");
    expect(s.botThinking).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// startGame - color: random
// ---------------------------------------------------------------------------

describe("startGame with color: random", () => {
  it("resolves to white when Math.random returns < 0.5", () => {
    // @regression
    vi.spyOn(Math, "random").mockReturnValue(0.3);
    getState().setColor("random");
    getState().startGame();
    expect(getState().playerColor).toBe("white");
    expect(getState().botThinking).toBe(false);
  });

  it("resolves to black when Math.random returns >= 0.5", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.7);
    getState().setColor("random");
    getState().startGame();
    expect(getState().playerColor).toBe("black");
    expect(getState().botThinking).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// playerMove
// ---------------------------------------------------------------------------

describe("playerMove(e2, e4)", () => {
  beforeEach(() => {
    getState().startGame(); // white, Blitz
  });

  it("advances FEN, adds 'e4' to movesSan, sets sideToMove=black, botThinking=true", () => {
    // @regression
    const fenBefore = getState().fen;
    getState().playerMove("e2", "e4");
    const s = getState();
    expect(s.fen).not.toBe(fenBefore);
    expect(s.movesSan).toContain("e4");
    expect(s.sideToMove).toBe("black");
    expect(s.botThinking).toBe(true);
  });

  it("negative: playerMove is ignored if botThinking is true (not player's turn)", () => {
    getState().playerMove("e2", "e4"); // valid move, botThinking=true now
    const fenAfterFirstMove = getState().fen;
    // Attempt another move while bot is thinking — should be rejected
    getState().playerMove("d2", "d4");
    expect(getState().fen).toBe(fenAfterFirstMove);
  });

  it("negative: playerMove with illegal move leaves state unchanged", () => {
    const fenBefore = getState().fen;
    getState().playerMove("e2", "e5"); // illegal
    expect(getState().fen).toBe(fenBefore);
    expect(getState().movesSan).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// applyBotMove
// ---------------------------------------------------------------------------

describe("applyBotMove(e7, e5)", () => {
  beforeEach(() => {
    getState().startGame(); // white, Blitz
    getState().playerMove("e2", "e4"); // player moves
    // botThinking is true, manually call applyBotMove to simulate engine response
  });

  it("advances FEN, sets sideToMove=white, botThinking=false", () => {
    // @regression
    const fenBefore = getState().fen;
    getState().applyBotMove("e7", "e5");
    const s = getState();
    expect(s.fen).not.toBe(fenBefore);
    expect(s.sideToMove).toBe("white");
    expect(s.botThinking).toBe(false);
    expect(s.movesSan.length).toBe(2); // e4, e5
  });
});

// ---------------------------------------------------------------------------
// tickClock
// ---------------------------------------------------------------------------

describe("tickClock", () => {
  it("no-op when active side's clock has plenty of time remaining", () => {
    // @regression
    // Stub Date.now so elapsed is small
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    getState().startGame();
    // Set lastSyncClientMs to now (just started)
    // tickClock computes elapsed = Date.now() - lastSyncClientMs ≈ 0 → no flag
    getState().tickClock();
    expect(getState().phase).toBe("playing");
    expect(getState().result).toBeNull();
  });

  it("on flag: sets result with flag reason and phase=result", () => {
    // @regression
    const pastMs = Date.now() - 200_000; // 200 seconds ago → Blitz clock (180s) expired
    vi.spyOn(Date, "now").mockReturnValue(pastMs + 200_000);

    getState().startGame(); // sets lastSyncClientMs = Date.now() at that moment

    // Now manipulate to simulate flag: set lastSyncClientMs far in the past
    useVsBotStore.setState({ lastSyncClientMs: pastMs });

    getState().tickClock();
    const s = getState();
    expect(s.phase).toBe("result");
    expect(s.result).not.toBeNull();
    expect(["flag_fall", "flag_fall_insufficient_material"]).toContain(s.result?.reason);
  });
});

// ---------------------------------------------------------------------------
// resign
// ---------------------------------------------------------------------------

describe("resign()", () => {
  it("from playing state sets result.winner to opponent, reason=resignation, phase=result", () => {
    // @regression
    getState().startGame(); // playerColor = white
    getState().requestResign();
    getState().resign();
    const s = getState();
    expect(s.phase).toBe("result");
    expect(s.result?.winner).toBe("black"); // opponent wins
    expect(s.result?.reason).toBe("resignation");
    expect(s.botThinking).toBe(false);
  });

  it("negative: resign() is ignored in setup phase", () => {
    // phase is still "setup" since resetStore returns to setup
    getState().resign();
    expect(getState().phase).toBe("setup");
    expect(getState().result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// rematch
// ---------------------------------------------------------------------------

describe("rematch()", () => {
  it("when color was white, flips setup.color to black and restarts", () => {
    // @regression
    getState().startGame(); // white
    getState().requestResign();
    getState().resign();
    getState().rematch();
    const s = getState();
    // rematch swaps white -> black then starts game
    // playerColor after rematch should be "black"
    expect(s.playerColor).toBe("black");
    expect(s.phase).toBe("playing");
  });

  it("when setup.color is random, stays random (does not flip to non-random)", () => {
    // @regression
    vi.spyOn(Math, "random").mockReturnValue(0.3); // resolves to white
    getState().setColor("random");
    getState().startGame();
    getState().requestResign();
    getState().resign();
    // rematch with random: setup.color stays "random"
    getState().rematch();
    expect(getState().setup.color).toBe("random");
  });
});

// ---------------------------------------------------------------------------
// newGame
// ---------------------------------------------------------------------------

describe("newGame()", () => {
  it("resets phase to setup and clears runtime fields while preserving setup", () => {
    // @regression
    getState().setLevel("expert");
    getState().setMode("Rapid");
    getState().startGame();
    getState().playerMove("e2", "e4");

    getState().newGame();
    const s = getState();
    expect(s.phase).toBe("setup");
    expect(s.playerColor).toBeNull();
    expect(s.fen).toBe("");
    expect(s.movesSan).toHaveLength(0);
    expect(s.botThinking).toBe(false);
    expect(s.result).toBeNull();
    // Setup should be preserved
    expect(s.setup.level).toBe("expert");
    expect(s.setup.mode).toBe("Rapid");
  });
});
