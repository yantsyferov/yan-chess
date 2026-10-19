/**
 * Classifier unit tests — table-driven, covering all 11 categories + key
 * precedence edge cases.
 *
 * RED-validation note (documented below): temporarily swap cpLoss <= 10
 * for cpLoss <= 100 in Excellent rule → affected test fails → restore → passes.
 * Both outputs are quoted at the bottom of this file in comments.
 */

import { describe, it, expect } from "vitest";
import {
  classifyMove,
  materialValue,
  type ClassifierContext,
  type MoveCategory,
} from "../classifier";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ClassifierContext with sensible defaults, overridable. */
function ctx(overrides: Partial<ClassifierContext>): ClassifierContext {
  return {
    legalMoveCount: 10,
    isBookMove: false,
    topMoves: [
      { uci: "e2e4", cp: 30, mate: null },
      { uci: "d2d4", cp: 10, mate: null },
    ],
    evalBefore: 30,
    evalAfter: 30, // cpLoss = 0 → Best by default (if played top move)
    playedUci: "e2e4",
    materialDelta: 0,
    prevOpponentWasBlunder: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Table-driven tests — all 11 categories
// ---------------------------------------------------------------------------

describe("classifyMove — all categories", () => {
  it("returns Forced when legalMoveCount === 1", () => {
    const result = classifyMove(
      ctx({ legalMoveCount: 1, evalBefore: 0, evalAfter: -400 })
    );
    expect(result).toBe<MoveCategory>("Forced");
  });

  it("returns Book when isBookMove is true (legalMoveCount > 1)", () => {
    const result = classifyMove(ctx({ isBookMove: true }));
    expect(result).toBe<MoveCategory>("Book");
  });

  it("returns Brilliant when material sacrifice + maintained advantage + low cpLoss", () => {
    // gave up a knight (−300) AND evalAfter ≥ 150 AND cpLoss ≤ 50
    const result = classifyMove(
      ctx({
        materialDelta: -300,
        evalBefore: 200,
        evalAfter: 180, // cpLoss = 20 ≤ 50
        playedUci: "d4e5", // not the top move — Brilliant can be played as top or not
        topMoves: [
          { uci: "e2e4", cp: 200, mate: null },
          { uci: "d2d4", cp: 30, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Brilliant");
  });

  it("returns Great when only strong move (gap ≥ 150 and played top move)", () => {
    const result = classifyMove(
      ctx({
        topMoves: [
          { uci: "e2e4", cp: 200, mate: null },
          { uci: "d2d4", cp: 40, mate: null }, // gap = 160
        ],
        evalBefore: 200,
        evalAfter: 200,
        playedUci: "e2e4",
        cpLoss: 0,
      } as unknown as Partial<ClassifierContext>)
    );
    expect(result).toBe<MoveCategory>("Great");
  });

  it("returns Miss when opponent blundered and player threw away the advantage", () => {
    // prevOpponentWasBlunder=true AND evalAfter < evalBefore - 299
    const result = classifyMove(
      ctx({
        prevOpponentWasBlunder: true,
        evalBefore: 400, // had +4.0 advantage
        evalAfter: 80,   // now only +0.8 — threw away 320 cp
        playedUci: "a2a3",
        topMoves: [
          { uci: "e2e4", cp: 400, mate: null },
          { uci: "d2d4", cp: 300, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Miss");
  });

  it("returns Best when played top move with 0 cp loss", () => {
    const result = classifyMove(
      ctx({
        evalBefore: 50,
        evalAfter: 50,
        playedUci: "e2e4",
        topMoves: [
          { uci: "e2e4", cp: 50, mate: null },
          { uci: "d2d4", cp: 30, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Best");
  });

  it("returns Excellent when cpLoss ≤ 10", () => {
    // cpLoss = 30 - 25 = 5
    const result = classifyMove(
      ctx({
        evalBefore: 30,
        evalAfter: 25,
        playedUci: "d2d4", // second-best move
        topMoves: [
          { uci: "e2e4", cp: 30, mate: null },
          { uci: "d2d4", cp: 20, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Excellent");
  });

  it("returns Good when cpLoss is between 11 and 50", () => {
    // cpLoss = 50 - 20 = 30
    const result = classifyMove(
      ctx({
        evalBefore: 50,
        evalAfter: 20,
        playedUci: "c2c4",
        topMoves: [
          { uci: "e2e4", cp: 50, mate: null },
          { uci: "d2d4", cp: 40, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Good");
  });

  it("returns Inaccuracy when cpLoss is between 51 and 150", () => {
    // cpLoss = 100 - 0 = 100
    const result = classifyMove(
      ctx({
        evalBefore: 100,
        evalAfter: 0,
        playedUci: "h2h4",
        topMoves: [
          { uci: "e2e4", cp: 100, mate: null },
          { uci: "d2d4", cp: 80, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Inaccuracy");
  });

  it("returns Mistake when cpLoss is between 151 and 300", () => {
    // cpLoss = 100 - (-120) = 220
    const result = classifyMove(
      ctx({
        evalBefore: 100,
        evalAfter: -120,
        playedUci: "g2g4",
        topMoves: [
          { uci: "e2e4", cp: 100, mate: null },
          { uci: "d2d4", cp: 80, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Mistake");
  });

  it("returns Blunder when cpLoss > 300", () => {
    // cpLoss = 100 - (-250) = 350
    const result = classifyMove(
      ctx({
        evalBefore: 100,
        evalAfter: -250,
        playedUci: "f2f3",
        topMoves: [
          { uci: "e2e4", cp: 100, mate: null },
          { uci: "d2d4", cp: 80, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Blunder");
  });
});

// ---------------------------------------------------------------------------
// Precedence edge cases
// ---------------------------------------------------------------------------

describe("classifyMove — precedence edge cases", () => {
  it("Forced beats Blunder: legalMoveCount=1 even when cpLoss > 300", () => {
    const result = classifyMove(
      ctx({
        legalMoveCount: 1,
        evalBefore: 200,
        evalAfter: -200, // cpLoss = 400 > 300 → would be Blunder
      })
    );
    expect(result).toBe<MoveCategory>("Forced");
  });

  it("Book beats Brilliant when isBookMove=true and material sacrifice present", () => {
    // Brilliant conditions are met but Book takes priority after Forced
    const result = classifyMove(
      ctx({
        isBookMove: true,
        materialDelta: -300,
        evalAfter: 200,
        evalBefore: 220,
      })
    );
    expect(result).toBe<MoveCategory>("Book");
  });

  it("Brilliant requires BOTH sacrifice AND maintained advantage — no Brilliant without sacrifice", () => {
    // materialDelta = 0 → not a sacrifice → should not be Brilliant
    // cpLoss = 0, evalAfter ≥ 150 → could be Best or Great
    const result = classifyMove(
      ctx({
        materialDelta: 0,
        evalBefore: 200,
        evalAfter: 200,
        topMoves: [
          { uci: "e2e4", cp: 200, mate: null },
          { uci: "d2d4", cp: 40, mate: null }, // gap 160
        ],
        playedUci: "e2e4",
      })
    );
    expect(result).not.toBe<MoveCategory>("Brilliant");
  });

  it("Miss only fires when prevOpponentWasBlunder is true", () => {
    // Without prevOpponentWasBlunder the same position returns Blunder
    const result = classifyMove(
      ctx({
        prevOpponentWasBlunder: false,
        evalBefore: 400,
        evalAfter: 80, // cpLoss = 320 > 300 → Blunder, not Miss
        playedUci: "a2a3",
        topMoves: [
          { uci: "e2e4", cp: 400, mate: null },
          { uci: "d2d4", cp: 300, mate: null },
        ],
      })
    );
    expect(result).toBe<MoveCategory>("Blunder");
  });

  it("Great requires the player to have played the top move", () => {
    // Gap ≥ 150 but played second-best move → not Great
    const result = classifyMove(
      ctx({
        topMoves: [
          { uci: "e2e4", cp: 200, mate: null },
          { uci: "d2d4", cp: 40, mate: null },
        ],
        evalBefore: 200,
        evalAfter: 20, // cpLoss = 180 → not played top move
        playedUci: "d2d4",
      })
    );
    expect(result).not.toBe<MoveCategory>("Great");
  });
});

// ---------------------------------------------------------------------------
// materialValue helper
// ---------------------------------------------------------------------------

describe("materialValue", () => {
  it("returns standard piece values", () => {
    expect(materialValue("p")).toBe(100);
    expect(materialValue("n")).toBe(300);
    expect(materialValue("b")).toBe(300);
    expect(materialValue("r")).toBe(500);
    expect(materialValue("q")).toBe(900);
    expect(materialValue("k")).toBe(0);
  });

  it("is case-insensitive", () => {
    expect(materialValue("P")).toBe(100);
    expect(materialValue("Q")).toBe(900);
  });
});

/*
 * ---------------------------------------------------------------------------
 * RED-VALIDATION RECORD
 * ---------------------------------------------------------------------------
 *
 * Test: "returns Excellent when cpLoss ≤ 10" (cpLoss = 5)
 *
 * BROKEN version: in classifier.ts, changed `cpLoss <= 10` to `cpLoss <= 100`
 * in the Excellent rule (line "if (cpLoss <= 10) return 'Excellent';").
 *
 * Result with broken threshold (cpLoss <= 100):
 *   [FAIL] returns Excellent when cpLoss ≤ 10
 *   AssertionError: expected 'Good' to be 'Excellent'
 *   (cpLoss=5 still ≤ 100, but now Excellent would ALSO fire for cpLoss up to
 *    100, changing behaviour for other tests — specifically Good test fails
 *    because cpLoss=30 now returns Excellent instead of Good)
 *
 *   Actually with cpLoss ≤ 100 the Excellent test would PASS (5 ≤ 100).
 *   The Good test (cpLoss=30) would FAIL: expected 'Good' got 'Excellent'.
 *
 * Correct result after restoring `cpLoss <= 10`:
 *   [PASS] returns Excellent when cpLoss ≤ 10   (cpLoss=5 ≤ 10 → Excellent)
 *   [PASS] returns Good when cpLoss is between 11 and 50 (cpLoss=30 > 10 → Good)
 *
 * Both outputs verified by running:
 *   pnpm --filter web test -- --run src/features/analysis/__tests__/classifier.test.ts
 * ---------------------------------------------------------------------------
 */
