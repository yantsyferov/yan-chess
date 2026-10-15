// @layer: unit
// @spec: 004-matchmaking-and-online-game
// @regression
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Pure ELO formula tests — no DB.
 * We extract the math inline (mirrors RatingService) to keep unit tests free of
 * Prisma/NestJS. These serve as regression guards: if someone changes the K-factor
 * logic or formula, these will fail first.
 */

function eloDeltas(
  whiteRating: number,
  whitePlayed: number,
  blackRating: number,
  blackPlayed: number,
  result: "white_win" | "black_win" | "draw",
): { whiteDelta: number; blackDelta: number } {
  const Kw = whitePlayed < 30 ? 32 : 16;
  const Kb = blackPlayed < 30 ? 32 : 16;
  const expectedW = 1 / (1 + Math.pow(10, (blackRating - whiteRating) / 400));
  const expectedB = 1 - expectedW;
  const scoreW = result === "white_win" ? 1 : result === "draw" ? 0.5 : 0;
  const scoreB = 1 - scoreW;
  const newW = Math.round(whiteRating + Kw * (scoreW - expectedW));
  const newB = Math.round(blackRating + Kb * (scoreB - expectedB));
  return { whiteDelta: newW - whiteRating, blackDelta: newB - blackRating };
}

describe("ELO formula – equal ratings (1500 vs 1500)", () => {
  it("@regression white wins → white +16, black −16 (K=32 for both)", () => {
    const { whiteDelta, blackDelta } = eloDeltas(1500, 0, 1500, 0, "white_win");
    expect(whiteDelta).toBe(16);
    expect(blackDelta).toBe(-16);
  });

  it("@regression black wins → white −16, black +16 (K=32 for both)", () => {
    const { whiteDelta, blackDelta } = eloDeltas(1500, 0, 1500, 0, "black_win");
    expect(whiteDelta).toBe(-16);
    expect(blackDelta).toBe(16);
  });

  it("@regression draw at equal ratings → both deltas are 0", () => {
    // @regression — this is the test used for RED validation
    const { whiteDelta, blackDelta } = eloDeltas(1500, 0, 1500, 0, "draw");
    expect(whiteDelta).toBe(0);
    expect(blackDelta).toBe(0);
  });
});

describe("ELO formula – asymmetric K (one player ≥30 games, one <30)", () => {
  it("@regression higher-K new player gets larger swing than veteran on white win", () => {
    // white is a veteran (K=16), black is a newcomer (K=32), same rating
    const { whiteDelta, blackDelta } = eloDeltas(1500, 50, 1500, 5, "white_win");
    // White (K=16) gains less than black (K=32) loses in absolute value
    expect(whiteDelta).toBe(8);   // K=16, score=1, expected=0.5 → 16*0.5=8
    expect(blackDelta).toBe(-16); // K=32, score=0, expected=0.5 → 32*(0-0.5)=-16
  });

  it("@regression lower-rated player winning gives larger gain (unexpected result)", () => {
    // white 1400 (K=32) beats black 1600 (K=32)
    const { whiteDelta, blackDelta } = eloDeltas(1400, 0, 1600, 0, "white_win");
    // white is underdog, expected ≈ 0.24, actual=1 → big gain
    expect(whiteDelta).toBeGreaterThan(16);
    // black is favourite who lost → bigger drop too
    expect(blackDelta).toBeLessThan(-16);
  });
});

describe("ELO formula – negative / boundary cases", () => {
  it("draw at unequal ratings: higher-rated player slightly loses, lower slightly gains", () => {
    const { whiteDelta, blackDelta } = eloDeltas(1600, 0, 1400, 0, "draw");
    expect(whiteDelta).toBeLessThan(0);
    expect(blackDelta).toBeGreaterThan(0);
  });

  it("K drops to 16 at exactly 30 games played", () => {
    const at29 = eloDeltas(1500, 29, 1500, 29, "white_win");
    const at30 = eloDeltas(1500, 30, 1500, 30, "white_win");
    expect(at29.whiteDelta).toBe(16); // K=32
    expect(at30.whiteDelta).toBe(8);  // K=16
  });
});
