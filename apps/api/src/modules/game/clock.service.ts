import { Injectable } from "@nestjs/common";
import { GameColor } from "./game.service";

@Injectable()
export class ClockService {
  /**
   * Decrement the active side's clock by the real time since last move.
   * Returns the new clocks and whether a flag just fell.
   */
  tickOnMove(input: {
    whiteClockMs: number;
    blackClockMs: number;
    lastMoveAt: number;
    sideToMove: GameColor;
    /** Injectable for tests; defaults to Date.now(). */
    now?: number;
  }): {
    whiteClockMs: number;
    blackClockMs: number;
    flagged: GameColor | null;
  } {
    const now = input.now ?? Date.now();
    const elapsed = Math.max(0, now - input.lastMoveAt);
    const w =
      input.sideToMove === "white"
        ? input.whiteClockMs - elapsed
        : input.whiteClockMs;
    const b =
      input.sideToMove === "black"
        ? input.blackClockMs - elapsed
        : input.blackClockMs;

    if (input.sideToMove === "white" && w <= 0) {
      return { whiteClockMs: 0, blackClockMs: b, flagged: "white" };
    }
    if (input.sideToMove === "black" && b <= 0) {
      return { whiteClockMs: w, blackClockMs: 0, flagged: "black" };
    }
    return { whiteClockMs: w, blackClockMs: b, flagged: null };
  }
}
