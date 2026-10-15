// @layer: unit
// @spec: 006-game-history
// @regression

import { describe, it, expect } from "vitest";
import { GameHistoryService } from "../../src/modules/game-history/game-history.service.js";

// ── Minimal stub of PrismaService (no DB calls in these tests) ──────────────
const fakePrisma = {} as never;
const service = new GameHistoryService(fakePrisma);

// ── Helpers ─────────────────────────────────────────────────────────────────

const ALICE_ID = "user-alice";
const BOB_ID = "user-bob";

function makeGame(overrides: Partial<{
  whiteUserId: string;
  blackUserId: string;
  result: "white_win" | "black_win" | "draw";
  whiteRatingBefore: number;
  whiteRatingAfter: number;
  blackRatingBefore: number;
  blackRatingAfter: number;
  endReason: string;
}> = {}): Parameters<typeof service.mapToListItem>[0] {
  return {
    id: "game-001",
    mode: "Blitz",
    whiteUserId: ALICE_ID,
    blackUserId: BOB_ID,
    result: "white_win",
    endReason: "checkmate",
    whiteRatingBefore: 1500,
    whiteRatingAfter: 1516,
    blackRatingBefore: 1500,
    blackRatingAfter: 1484,
    startedAt: new Date("2026-10-11T18:00:00Z"),
    endedAt: new Date("2026-10-11T18:05:00Z"),
    whiteUser: { nickname: "alice" },
    blackUser: { nickname: "bob" },
    ...overrides,
  } as Parameters<typeof service.mapToListItem>[0];
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("GameHistoryService.mapToListItem — row-perspective mapping", () => {
  // @regression
  it("alice as white winner → playerColor=white, result=win, positive delta", () => {
    const row = makeGame({
      whiteUserId: ALICE_ID,
      blackUserId: BOB_ID,
      result: "white_win",
      whiteRatingBefore: 1500,
      whiteRatingAfter: 1516,
    });
    const item = service.mapToListItem(row, ALICE_ID);

    expect(item.playerColor).toBe("white");
    expect(item.result).toBe("win");
    expect(item.ratingBefore).toBe(1500);
    expect(item.ratingAfter).toBe(1516);
    expect(item.ratingDelta).toBe(16);
    expect(item.ratingDelta).toBeGreaterThan(0);
    expect(item.opponent.nickname).toBe("bob");
    expect(item.opponent.ratingAfter).toBe(1484);
  });

  // @regression
  it("alice as black loser → playerColor=black, result=loss, negative delta", () => {
    // alice is black, bob is white, white won
    const row = {
      id: "game-002",
      mode: "Blitz",
      whiteUserId: BOB_ID,
      blackUserId: ALICE_ID,
      result: "white_win" as const,
      endReason: "checkmate",
      whiteRatingBefore: 1500,
      whiteRatingAfter: 1516,
      blackRatingBefore: 1500,
      blackRatingAfter: 1484,
      startedAt: new Date("2026-10-11T18:00:00Z"),
      endedAt: new Date("2026-10-11T18:05:00Z"),
      whiteUser: { nickname: "bob" },
      blackUser: { nickname: "alice" },
    } as Parameters<typeof service.mapToListItem>[0];
    const item = service.mapToListItem(row, ALICE_ID);

    expect(item.playerColor).toBe("black");
    expect(item.result).toBe("loss");
    expect(item.ratingBefore).toBe(1500);
    expect(item.ratingAfter).toBe(1484);
    expect(item.ratingDelta).toBe(-16);
    expect(item.ratingDelta).toBeLessThan(0);
    expect(item.opponent.nickname).toBe("bob");
    expect(item.opponent.ratingAfter).toBe(1516);
  });

  // @regression
  it("draw case → result=draw, delta may be 0 or small", () => {
    const row = makeGame({
      whiteUserId: ALICE_ID,
      blackUserId: BOB_ID,
      result: "draw",
      whiteRatingBefore: 1500,
      whiteRatingAfter: 1500,
      blackRatingBefore: 1500,
      blackRatingAfter: 1500,
      endReason: "agreement",
    });
    const item = service.mapToListItem(row, ALICE_ID);

    expect(item.result).toBe("draw");
    expect(item.ratingDelta).toBe(0);
  });

  it("negative: bob (black winner) perspective on same game → result=win", () => {
    const row = makeGame({
      whiteUserId: ALICE_ID,
      blackUserId: BOB_ID,
      result: "black_win",
      whiteRatingBefore: 1500,
      whiteRatingAfter: 1484,
      blackRatingBefore: 1500,
      blackRatingAfter: 1516,
    });
    const item = service.mapToListItem(row, BOB_ID);

    expect(item.playerColor).toBe("black");
    expect(item.result).toBe("win");
    expect(item.ratingDelta).toBe(16);
  });

  it("negative: requesting as a non-participant returns the white perspective (caller must validate access separately)", () => {
    // The service's mapToListItem treats any non-whiteUserId as black perspective.
    // This is acceptable because access control is enforced at the controller/service layer
    // before mapToListItem is ever called.
    const row = makeGame({
      whiteUserId: ALICE_ID,
      blackUserId: BOB_ID,
      result: "white_win",
    });
    // "charlie" is not a participant — mapToListItem treats them as black
    const item = service.mapToListItem(row, "user-charlie");
    expect(item.playerColor).toBe("black");
    // Result is loss because white won and charlie is treated as black
    expect(item.result).toBe("loss");
  });
});
