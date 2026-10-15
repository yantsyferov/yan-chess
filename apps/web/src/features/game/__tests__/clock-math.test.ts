// @layer: unit
// @spec: 003-game-board
// @regression

import { describe, it, expect } from "vitest";
import { Chess } from "chess.js";
import { formatClock, isLowOnTime, wouldOpponentHaveMatingMaterial } from "../clock-math";

describe("formatClock", () => {
  it("formats 3 minutes as 3:00", () => {
    // @regression
    expect(formatClock(180_000)).toBe("3:00");
  });

  it("formats 9500ms as 9.5 (tenths precision)", () => {
    // @regression
    expect(formatClock(9_500)).toBe("9.5");
  });

  it("formats 0ms as 0.0", () => {
    // @regression
    expect(formatClock(0)).toBe("0.0");
  });
});

describe("isLowOnTime", () => {
  it("returns true for 9999ms (below 10s)", () => {
    // @regression
    expect(isLowOnTime(9_999)).toBe(true);
  });

  it("returns false for exactly 10000ms", () => {
    // @regression
    expect(isLowOnTime(10_000)).toBe(false);
  });
});

describe("wouldOpponentHaveMatingMaterial", () => {
  // Use valid FENs (chess.js v1 requires both kings and a valid position)
  it("lone opponent king → false (insufficient material)", () => {
    // @regression
    const chess = new Chess("k7/8/8/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(false);
  });

  it("opponent has one knight → false", () => {
    // @regression
    const chess = new Chess("k7/8/3n4/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(false);
  });

  it("opponent has one bishop → false", () => {
    // @regression
    const chess = new Chess("k7/8/3b4/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(false);
  });

  it("opponent has two knights → true", () => {
    // @regression
    const chess = new Chess("k7/8/3nn3/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(true);
  });

  it("opponent has knight+bishop → true", () => {
    // @regression
    const chess = new Chess("k7/8/3nb3/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(true);
  });

  it("opponent has queen → true", () => {
    // @regression
    const chess = new Chess("k7/8/3q4/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(true);
  });

  it("opponent has pawn → true", () => {
    // @regression
    const chess = new Chess("k7/8/3p4/8/8/8/8/K7 w - - 0 1");
    expect(wouldOpponentHaveMatingMaterial(chess, "white")).toBe(true);
  });
});
