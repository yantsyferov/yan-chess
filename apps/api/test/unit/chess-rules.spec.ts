// @layer: unit
// @spec: 004-matchmaking-and-online-game
// @regression
import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { ChessRulesService } from "../../src/modules/game/chess-rules.service";

const svc = new ChessRulesService();

// ---------- checkmate detection ----------

describe("ChessRulesService – checkmate", () => {
  // Fool's mate: fastest checkmate
  const FOOLS_MATE_FEN_BEFORE_LAST =
    "rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3";

  it("@regression isCheckmate returns true for Scholar's mate final position", () => {
    // Scholar's mate: white queen on f7 delivers checkmate
    const SCHOLARS_MATE_DONE = "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4";
    expect(svc.isCheckmate(SCHOLARS_MATE_DONE)).toBe(true);
    expect(svc.isStalemate(SCHOLARS_MATE_DONE)).toBe(false);
  });

  it("@regression validateAndApply returns winner=white on Qxf7# (Scholar's mate move)", () => {
    // Scholar's mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    // FEN before the Qxf7# move (queen on h5, ready to capture f7)
    const BEFORE = "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4";
    const result = svc.validateAndApply(BEFORE, { from: "h5", to: "f7" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.over).not.toBeNull();
      expect(result.over?.reason).toBe("checkmate");
      expect(result.over?.winner).toBe("white");
    }
  });

  it("negative: illegal move returns ok=false with rejection=illegal_move", () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    const result = svc.validateAndApply(START, { from: "e2", to: "e5" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.rejection).toBe("illegal_move");
    }
  });
});

// ---------- stalemate detection ----------

describe("ChessRulesService – stalemate", () => {
  it("@regression detects stalemate position", () => {
    // Classic stalemate: black king in corner, only legal move would be into check
    const STALEMATE_FEN = "k7/8/1Q6/8/8/8/8/K7 b - - 0 1";
    // Black king a8, white queen b6, white king a1 — black to move, no legal moves, no check
    expect(svc.isStalemate(STALEMATE_FEN)).toBe(true);
    expect(svc.isCheckmate(STALEMATE_FEN)).toBe(false);
  });

  it("@regression validateAndApply detects stalemate and returns winner=null", () => {
    // Position where the next move by white results in stalemate
    // White: Ka6, Qa1; Black: Ka8. After Qa7+ no — need Qb6 not check
    // Use a direct stalemate-via-move setup: white queen goes to b6 stalemating black
    // White: Kc6, Qa1; Black: Ka8; white plays Qa7? No that's check.
    // White: Kc6 Qb5; Black Ka8. Qb6 is stalemate.
    const BEFORE_STALEMATE = "k7/8/2K5/1Q6/8/8/8/8 w - - 0 1";
    const result = svc.validateAndApply(BEFORE_STALEMATE, { from: "b5", to: "b6" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.over?.reason).toBe("stalemate");
      expect(result.over?.winner).toBeNull();
    }
  });
});

// ---------- insufficient material detection ----------

describe("ChessRulesService – insufficient material", () => {
  it("@regression king vs king is insufficient material", () => {
    const KVK = "k7/8/8/8/8/8/8/K7 w - - 0 1";
    expect(svc.isInsufficientMaterial(KVK)).toBe(true);
  });

  it("@regression king+bishop vs king is insufficient material", () => {
    const KBK = "k7/8/8/8/8/8/8/KB6 w - - 0 1";
    expect(svc.isInsufficientMaterial(KBK)).toBe(true);
  });

  it("negative: king+queen vs king is sufficient material", () => {
    const KQK = "k7/8/8/8/8/8/8/KQ6 w - - 0 1";
    expect(svc.isInsufficientMaterial(KQK)).toBe(false);
  });
});

// ---------- threefold repetition detection ----------
// NOTE: chess.js tracks repetition within a single Chess instance's move history.
// The service's validateAndApply creates a fresh Chess(fen) per call, so it cannot
// detect threefold repetition from a bare FEN alone — the game gateway replays the
// full PGN/history before validating each move. These tests verify the underlying
// chess.js behavior that the service relies on.

describe("ChessRulesService – threefold repetition", () => {
  it("@regression chess.js detects threefold repetition after 5 knight moves", async () => {
    const { Chess } = await import("chess.js");
    const game = new Chess();
    game.move("Nf3"); game.move("Nf6");
    game.move("Ng1"); game.move("Ng8");
    game.move("Nf3"); game.move("Nf6");
    game.move("Ng1"); game.move("Ng8");
    game.move("Nf3"); game.move("Nf6");
    // Third time Nf3-Nf6 reached — threefold repetition should be flagged
    expect(game.isThreefoldRepetition()).toBe(true);
  });

  it("negative: fresh game is NOT threefold repetition", () => {
    const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
    expect(svc.isThreefoldRepetition(START)).toBe(false);
  });
});

// ---------- canOpponentMate ----------

describe("ChessRulesService – canOpponentMate", () => {
  it("@regression lone king opponent cannot mate", () => {
    const KVK = "k7/8/8/8/8/8/8/K7 w - - 0 1";
    expect(svc.canOpponentMate(KVK, "white")).toBe(false);
  });

  it("@regression opponent (black) with queen can mate white", () => {
    // flagSide=white means we check if black (opponentColor='b') can mate
    // so this FEN must have a black queen
    const FEN_BLACK_QUEEN = "kq6/8/8/8/8/8/8/K7 w - - 0 1";
    expect(svc.canOpponentMate(FEN_BLACK_QUEEN, "white")).toBe(true);
  });
});
