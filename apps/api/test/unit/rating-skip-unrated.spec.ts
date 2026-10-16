// @layer: unit
// @spec: 014-play-redesign
// @regression
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RatingService } from "../../src/modules/rating/rating.service";

// ─── Stubs ───────────────────────────────────────────────────────────────────

function makeService(): {
  service: RatingService;
  updateMock: ReturnType<typeof vi.fn>;
  findManyMock: ReturnType<typeof vi.fn>;
} {
  const updateMock = vi.fn();
  const findManyMock = vi.fn().mockResolvedValue([
    { userId: "white", rating: 1500, gamesPlayed: 0 },
    { userId: "black", rating: 1500, gamesPlayed: 0 },
  ]);

  const prisma = {
    ratingByMode: {
      findMany: findManyMock,
      update: updateMock,
    },
  } as unknown as ConstructorParameters<typeof RatingService>[0];

  const service = new RatingService(prisma);
  return { service, updateMock, findManyMock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("[@spec:014-play-redesign] RatingService — skip unrated games", () => {
  let service: RatingService;
  let updateMock: ReturnType<typeof vi.fn>;
  let findManyMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    ({ service, updateMock, findManyMock } = makeService());
  });

  it("applyGameResult with isRated=false does NOT call prisma.ratingByMode.update", async () => {
    await service.applyGameResult({
      whiteUserId: "white",
      blackUserId: "black",
      mode: "Blitz",
      result: "white_win",
      isRated: false,
    });

    expect(updateMock).not.toHaveBeenCalled();
  });

  it("applyGameResult with isRated=false returns zero deltas", async () => {
    const result = await service.applyGameResult({
      whiteUserId: "white",
      blackUserId: "black",
      mode: "Blitz",
      result: "white_win",
      isRated: false,
    });

    expect(result.whiteDelta).toBe(0);
    expect(result.blackDelta).toBe(0);
  });

  it("applyGameResult with isRated=false returns before === after for white", async () => {
    const result = await service.applyGameResult({
      whiteUserId: "white",
      blackUserId: "black",
      mode: "Blitz",
      result: "white_win",
      isRated: false,
    });

    expect(result.whiteBefore).toBe(result.whiteAfter);
  });

  it("applyGameResult with isRated=false returns before === after for black", async () => {
    const result = await service.applyGameResult({
      whiteUserId: "white",
      blackUserId: "black",
      mode: "Blitz",
      result: "white_win",
      isRated: false,
    });

    expect(result.blackBefore).toBe(result.blackAfter);
  });

  it("applyGameResult with isRated=true DOES call prisma.ratingByMode.update (regression guard)", async () => {
    updateMock.mockResolvedValue({});

    await service.applyGameResult({
      whiteUserId: "white",
      blackUserId: "black",
      mode: "Blitz",
      result: "white_win",
      isRated: true,
    });

    expect(updateMock).toHaveBeenCalledTimes(2);
  });
});
