// @layer: unit
// @spec: 004-matchmaking-and-online-game
// @regression
import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { ClockService } from "../../src/modules/game/clock.service";

const svc = new ClockService();

describe("ClockService.tickOnMove – normal subtraction", () => {
  it("@regression subtracts elapsed from white when sideToMove=white", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 180_000,
      blackClockMs: 180_000,
      lastMoveAt: 1_000,
      sideToMove: "white",
      now: 11_000, // 10 seconds elapsed
    });
    expect(result.whiteClockMs).toBe(170_000);
    expect(result.blackClockMs).toBe(180_000);
    expect(result.flagged).toBeNull();
  });

  it("@regression subtracts elapsed from black when sideToMove=black", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 180_000,
      blackClockMs: 60_000,
      lastMoveAt: 0,
      sideToMove: "black",
      now: 5_000,
    });
    expect(result.blackClockMs).toBe(55_000);
    expect(result.whiteClockMs).toBe(180_000);
    expect(result.flagged).toBeNull();
  });
});

describe("ClockService.tickOnMove – flag detection", () => {
  it("@regression flags white when white clock reaches zero", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 5_000,
      blackClockMs: 60_000,
      lastMoveAt: 0,
      sideToMove: "white",
      now: 6_000, // 6 s elapsed > 5 s remaining
    });
    expect(result.flagged).toBe("white");
    expect(result.whiteClockMs).toBe(0);
  });

  it("@regression flags black when black clock reaches zero", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 60_000,
      blackClockMs: 3_000,
      lastMoveAt: 0,
      sideToMove: "black",
      now: 4_000,
    });
    expect(result.flagged).toBe("black");
    expect(result.blackClockMs).toBe(0);
  });

  it("@regression exactly zero milliseconds remaining → flagged (not null)", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 5_000,
      blackClockMs: 60_000,
      lastMoveAt: 0,
      sideToMove: "white",
      now: 5_000, // exactly consumed
    });
    expect(result.flagged).toBe("white");
  });
});

describe("ClockService.tickOnMove – negative / boundary cases", () => {
  it("elapsed is clamped to 0 when now < lastMoveAt (clock skew)", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 30_000,
      blackClockMs: 30_000,
      lastMoveAt: 10_000,
      sideToMove: "white",
      now: 5_000, // earlier than lastMoveAt
    });
    // No elapsed → no subtraction
    expect(result.whiteClockMs).toBe(30_000);
    expect(result.flagged).toBeNull();
  });

  it("inactive side's clock is not modified", () => {
    const result = svc.tickOnMove({
      whiteClockMs: 180_000,
      blackClockMs: 180_000,
      lastMoveAt: 0,
      sideToMove: "white",
      now: 10_000,
    });
    expect(result.blackClockMs).toBe(180_000); // black did not tick
  });
});
