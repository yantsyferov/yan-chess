// @layer: unit
// @spec: 017-home-games-list
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GameHistoryService } from "../../src/modules/game-history/game-history.service";
import { getGameHistoryQuerySchema } from "../../src/modules/game-history/dto/get-game-history-query.dto";

function makePrisma() {
  return {
    game: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

describe("GameHistoryService — limit param", () => {
  let prisma: ReturnType<typeof makePrisma>;
  let service: GameHistoryService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new GameHistoryService(prisma as never);
  });

  it("listGames with limit=10 calls findMany with take:10 skip:0 and returns pagination.perPage===10", async () => {
    prisma.game.count.mockResolvedValue(15);

    const result = await service.listGames("user-1", { page: 1, limit: 10 });

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 0 }),
    );
    expect(result.pagination.perPage).toBe(10);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it("listGames with page:2 and no limit uses PER_PAGE=20 unchanged (take:20 skip:20)", async () => {
    prisma.game.count.mockResolvedValue(50);

    await service.listGames("user-1", { page: 2 });

    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, skip: 20 }),
    );
  });

  it("Zod schema rejects limit:51 (over max)", () => {
    const parsed = getGameHistoryQuerySchema.safeParse({ limit: "51" });
    expect(parsed.success).toBe(false);
  });
});
