// @layer: unit
// @spec: 014-play-redesign
// @regression
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MatchmakingService } from "../../src/modules/matchmaking/matchmaking.service";

// ─── Stubs ───────────────────────────────────────────────────────────────────

const zaddMock = vi.fn().mockResolvedValue(1);
const hsetMock = vi.fn().mockResolvedValue(1);
const hgetallMock = vi.fn().mockResolvedValue({});
const expireMock = vi.fn().mockResolvedValue(1);
const saddMock = vi.fn();

function makeService(): MatchmakingService {
  const prisma = {
    ratingByMode: {
      findUnique: vi.fn().mockResolvedValue({ rating: 1500 }),
    },
  } as unknown as ConstructorParameters<typeof MatchmakingService>[0];

  const redis = {
    sadd: saddMock,
    raw: {
      zadd: zaddMock,
    },
    hset: hsetMock,
    hgetall: hgetallMock,
    expire: expireMock,
  } as unknown as ConstructorParameters<typeof MatchmakingService>[1];

  const realtime = {} as ConstructorParameters<typeof MatchmakingService>[2];
  const gameService = {} as ConstructorParameters<typeof MatchmakingService>[3];

  return new MatchmakingService(prisma, redis, realtime, gameService);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("[@spec:014-play-redesign] MatchmakingService — rated segregation", () => {
  let service: MatchmakingService;

  beforeEach(() => {
    vi.clearAllMocks();
    // sadd returns 1 (new entry, not a duplicate)
    saddMock.mockResolvedValue(1);
    service = makeService();
  });

  it("userA joining rated Blitz is zadd'd to mm:queue:Blitz:rated", async () => {
    await service.joinQueue("userA", "Alice", "Blitz", true);

    expect(zaddMock).toHaveBeenCalledOnce();
    const [key] = zaddMock.mock.calls[0] as [string, ...unknown[]];
    expect(key).toBe("mm:queue:Blitz:rated");
  });

  it("userB joining unrated Blitz is zadd'd to mm:queue:Blitz:unrated", async () => {
    await service.joinQueue("userB", "Bob", "Blitz", false);

    expect(zaddMock).toHaveBeenCalledOnce();
    const [key] = zaddMock.mock.calls[0] as [string, ...unknown[]];
    expect(key).toBe("mm:queue:Blitz:unrated");
  });

  it("rated and unrated keys never cross — two consecutive joins hit distinct keys", async () => {
    await service.joinQueue("userA", "Alice", "Blitz", true);
    await service.joinQueue("userB", "Bob", "Blitz", false);

    expect(zaddMock).toHaveBeenCalledTimes(2);
    const keys = zaddMock.mock.calls.map((c) => (c as [string, ...unknown[]])[0]);
    expect(keys[0]).toBe("mm:queue:Blitz:rated");
    expect(keys[1]).toBe("mm:queue:Blitz:unrated");
    expect(keys[0]).not.toBe(keys[1]);
  });

  it("isRated field is written into mm:entry:{userId} hash", async () => {
    await service.joinQueue("userA", "Alice", "Blitz", true);

    expect(hsetMock).toHaveBeenCalledOnce();
    const [, fields] = hsetMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fields["isRated"]).toBe("true");
  });

  it("isRated=false is written as 'false' string into the entry hash", async () => {
    await service.joinQueue("userB", "Bob", "Rapid", false);

    expect(hsetMock).toHaveBeenCalledOnce();
    const [, fields] = hsetMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(fields["isRated"]).toBe("false");
  });
});
