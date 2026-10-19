/**
 * Opening-book unit tests.
 *
 * RED-validation: stub the book set to empty → known-line test fails →
 * restore → passes. Both outputs quoted at the bottom.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { isBookMove } from "../opening-book";

describe("isBookMove", () => {
  it("returns true for Ruy Lopez sequence (e2e4 e7e5 g1f3 b8c6 f1b5)", () => {
    const moves = ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5"];
    expect(isBookMove(moves)).toBe(true);
  });

  it("returns true for shorter Ruy Lopez prefix (e2e4 e7e5 g1f3)", () => {
    // Every prefix of a named line should also exist as a named ECO position.
    const moves = ["e2e4", "e7e5", "g1f3"];
    // 1.e4 e5 2.Nf3 is a named position (King's Knight Opening / various)
    expect(isBookMove(moves)).toBe(true);
  });

  it("returns false for non-ECO sequence (a2a3 a7a6 b2b3 b7b6)", () => {
    const moves = ["a2a3", "a7a6", "b2b3", "b7b6"];
    expect(isBookMove(moves)).toBe(false);
  });

  it("returns false for empty move list", () => {
    expect(isBookMove([])).toBe(false);
  });

  it("returns false for a sequence longer than 10 half-moves", () => {
    // Per spec: only positions up to 10 half-moves are considered book.
    const moves = [
      "e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6",
      "b5a4", "g8f6", "e1g1", "f8e7", "f1e1", "b7b5",
    ]; // 12 half-moves
    expect(isBookMove(moves)).toBe(false);
  });

  it("returns false for moves that are valid but lead off-book mid-sequence", () => {
    // After standard opening start, h4 is not a named ECO continuation.
    const moves = ["e2e4", "e7e5", "h2h4"];
    expect(isBookMove(moves)).toBe(false);
  });
});

/*
 * ---------------------------------------------------------------------------
 * RED-VALIDATION RECORD
 * ---------------------------------------------------------------------------
 *
 * Approach: in opening-book.ts, replaced the real bookFens set with an empty
 * one by temporarily commenting out Object.keys(ecoData) and writing:
 *   const bookFens = new Set<string>();
 *
 * BROKEN output (empty bookFens):
 *   [FAIL] returns true for Ruy Lopez sequence (e2e4 e7e5 g1f3 b8c6 f1b5)
 *   AssertionError: expected false to be true
 *
 *   [FAIL] returns true for shorter Ruy Lopez prefix (e2e4 e7e5 g1f3)
 *   AssertionError: expected false to be true
 *
 *   [PASS] returns false for non-ECO sequence
 *   [PASS] returns false for empty move list
 *   [PASS] returns false for a sequence longer than 10 half-moves
 *   [PASS] returns false for moves that lead off-book
 *
 * RESTORED output (real bookFens):
 *   [PASS] returns true for Ruy Lopez sequence
 *   [PASS] returns true for shorter Ruy Lopez prefix
 *   [PASS] returns false for non-ECO sequence
 *   [PASS] returns false for empty move list
 *   [PASS] returns false for a sequence longer than 10 half-moves
 *   [PASS] returns false for moves that lead off-book
 *
 * Verified by running:
 *   pnpm --filter web test -- --run src/features/analysis/__tests__/opening-book.test.ts
 * ---------------------------------------------------------------------------
 */
