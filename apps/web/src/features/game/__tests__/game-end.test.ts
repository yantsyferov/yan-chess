// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { detectGameEnd } from "../game-end";

describe("detectGameEnd", () => {
  it("returns null for an ongoing game", () => {
    // @regression
    const chess = new Chess();
    expect(detectGameEnd(chess)).toBeNull();
  });

  it("detects checkmate — fool's mate — and winner is side that just moved (white)", () => {
    // @regression
    // Fool's mate: black delivers mate
    const chess = new Chess();
    chess.move("f3");
    chess.move("e5");
    chess.move("g4");
    chess.move("Qh4"); // checkmate
    const result = detectGameEnd(chess);
    expect(result).not.toBeNull();
    expect(result?.reason).toBe("checkmate");
    // chess.turn() returns "w" (white to move, but white is mated) — winner is opposite
    expect(result?.winner).toBe("black");
  });

  it("detects stalemate", () => {
    // @regression
    // Classic stalemate FEN: black king stalemated
    const chess = new Chess("k7/8/1Q6/8/8/8/8/K7 b - - 0 1");
    // Verify it is stalemate
    expect(chess.isStalemate()).toBe(true);
    const result = detectGameEnd(chess);
    expect(result?.reason).toBe("stalemate");
    expect(result?.winner).toBe("draw");
  });

  it("detects insufficient material (K vs K)", () => {
    // @regression
    const chess = new Chess("k7/8/8/8/8/8/8/K7 w - - 0 1");
    const result = detectGameEnd(chess);
    expect(result?.reason).toBe("insufficient_material");
    expect(result?.winner).toBe("draw");
  });

  it("detects threefold repetition", () => {
    // @regression
    const chess = new Chess();
    // Move knights back and forth to repeat position
    for (let i = 0; i < 3; i++) {
      chess.move("Nf3");
      chess.move("Nf6");
      chess.move("Ng1");
      chess.move("Ng8");
    }
    const result = detectGameEnd(chess);
    expect(result?.reason).toBe("threefold_repetition");
    expect(result?.winner).toBe("draw");
  });

  it("detects fifty move rule via FEN with halfmove counter at 100", () => {
    // @regression
    // Need material sufficient to avoid insufficient_material short-circuit.
    // White rook + king vs black king, halfmove clock at 100 → fifty_move_rule
    const chess = new Chess("k7/8/1K6/8/8/8/8/R7 w - - 100 60");
    const result = detectGameEnd(chess);
    expect(result?.reason).toBe("fifty_move_rule");
    expect(result?.winner).toBe("draw");
  });

  it("checkmate winner is opposite of chess.turn()", () => {
    // @regression
    // Scholar's mate: white delivers mate, chess.turn() returns "b", winner should be "white"
    const chess = new Chess();
    chess.move("e4");
    chess.move("e5");
    chess.move("Bc4");
    chess.move("Nc6");
    chess.move("Qh5");
    chess.move("Nf6");
    chess.move("Qxf7"); // Scholar's mate
    const result = detectGameEnd(chess);
    expect(result?.reason).toBe("checkmate");
    expect(chess.turn()).toBe("b");
    expect(result?.winner).toBe("white");
  });
});
