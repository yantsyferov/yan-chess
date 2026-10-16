// @layer: unit
// @spec: 007-friends
// @regression
//
// Extra unit tests covering gaps not addressed in friends-service.spec.ts:
//  - FriendsService.search relationship perspective mapping
//  - FriendsService.acceptRequest enforces non-initiator check
//  - FriendsService.unfriend self-targeting guard
//  - ChallengeService.resolveAccept color assignment (white / black / random)

import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { FriendsService } from "../../src/modules/friends/friends.service";
import { ChallengeService } from "../../src/modules/friends/challenge.service";

// ---------------------------------------------------------------------------
// Stub factories
// ---------------------------------------------------------------------------

function makePrismaStub() {
  return {
    friendship: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };
}

type PrismaStub = ReturnType<typeof makePrismaStub>;

function makeRealtimeStub() {
  const emitFn = vi.fn();
  const socketsJoin = vi.fn().mockResolvedValue(undefined);
  const toUserFn = vi.fn().mockReturnValue({ emit: emitFn, socketsJoin });
  const toRoomFn = vi.fn().mockReturnValue({ emit: emitFn, socketsJoin });
  return { toUser: toUserFn, toRoom: toRoomFn, emitFn };
}

function makePresenceStub() {
  return {
    getSocketCount: vi.fn().mockResolvedValue(1),
    broadcastPresence: vi.fn().mockResolvedValue(undefined),
  };
}

function makeGameServiceStub(gameId = "game-uuid-1") {
  return {
    createGame: vi.fn().mockResolvedValue({
      gameId,
      timeControlMs: 180_000,
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1",
      sideToMove: "white",
      serverNow: Date.now(),
      white: { nickname: "alice", rating: 1500 },
      black: { nickname: "bob", rating: 1500 },
    }),
  };
}

function makeRedisStub() {
  const store: Record<string, string> = {};
  const hstore: Record<string, Record<string, string>> = {};
  const sets: Record<string, Set<string>> = {};
  return {
    get: vi.fn(async (key: string) => store[key] ?? null),
    set: vi.fn(async (key: string, val: string) => { store[key] = val; }),
    del: vi.fn(async (...keys: string[]) => { for (const k of keys) delete store[k]; }),
    hset: vi.fn(async (key: string, fields: Record<string, unknown>) => {
      hstore[key] = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]));
    }),
    hgetall: vi.fn(async (key: string) => hstore[key] ?? null),
    expire: vi.fn().mockResolvedValue(1),
    sadd: vi.fn(async (key: string, ...members: string[]) => {
      if (!sets[key]) sets[key] = new Set();
      for (const m of members) sets[key]!.add(m);
    }),
    srem: vi.fn(async (key: string, member: string) => { sets[key]?.delete(member); }),
    smembers: vi.fn(async (key: string) => [...(sets[key] ?? [])]),
    _store: store,
    _hstore: hstore,
    _sets: sets,
    raw: { keys: vi.fn().mockResolvedValue([]) },
  };
}

// ---------------------------------------------------------------------------
// FriendsService.search — relationship perspective
// ---------------------------------------------------------------------------

describe("[@spec:007-friends][@regression] FriendsService.search relationship mapping", () => {
  let prisma: PrismaStub;
  let svc: FriendsService;

  beforeEach(() => {
    prisma = makePrismaStub();
    const realtime = makeRealtimeStub();
    const presence = makePresenceStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc = new FriendsService(prisma as any, realtime as any, presence as any);
  });

  it("@regression returns 'none' for a user with no friendship row", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "bbb", nickname: "bob", country: null, ratings: [{ rating: 1500 }] },
    ]);
    prisma.friendship.findMany.mockResolvedValue([]);

    const res = await svc.search("aaa", "bob");
    expect(res.results).toHaveLength(1);
    expect(res.results[0]!.relationship).toBe("none");
  });

  it("@regression returns 'pending_outbound' when I initiated the pending request", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "bbb", nickname: "bob", country: null, ratings: [] },
    ]);
    prisma.friendship.findMany.mockResolvedValue([
      {
        id: "f-1",
        userAId: "aaa",
        userBId: "bbb",
        status: FriendshipStatus.pending,
        initiatedBy: "aaa",
      },
    ]);

    const res = await svc.search("aaa", "bob");
    expect(res.results[0]!.relationship).toBe("pending_outbound");
  });

  it("@regression returns 'pending_inbound' when target initiated the pending request (not me)", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "bbb", nickname: "bob", country: null, ratings: [] },
    ]);
    prisma.friendship.findMany.mockResolvedValue([
      {
        id: "f-1",
        userAId: "aaa",
        userBId: "bbb",
        status: FriendshipStatus.pending,
        initiatedBy: "bbb", // bob initiated → I'm the recipient
      },
    ]);

    const res = await svc.search("aaa", "bob");
    expect(res.results[0]!.relationship).toBe("pending_inbound");
    // friendshipId must be surfaced so the UI can call accept inline
    expect(res.results[0]!.friendshipId).toBe("f-1");
  });

  it("@regression returns 'friend' for an accepted friendship", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "bbb", nickname: "bob", country: null, ratings: [] },
    ]);
    prisma.friendship.findMany.mockResolvedValue([
      {
        id: "f-1",
        userAId: "aaa",
        userBId: "bbb",
        status: FriendshipStatus.accepted,
        initiatedBy: "aaa",
      },
    ]);

    const res = await svc.search("aaa", "bob");
    expect(res.results[0]!.relationship).toBe("friend");
  });

  it("@regression returns empty results for empty query", async () => {
    const res = await svc.search("aaa", "");
    expect(res.results).toHaveLength(0);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("negative: self not present — user.findMany is called with id: { not: myUserId }", async () => {
    prisma.user.findMany.mockResolvedValue([]);
    await svc.search("aaa", "a");
    const whereArg = prisma.user.findMany.mock.calls[0]![0].where;
    expect(whereArg.id).toEqual({ not: "aaa" });
  });
});

// ---------------------------------------------------------------------------
// FriendsService.acceptRequest — non-initiator enforcement
// ---------------------------------------------------------------------------

describe("[@spec:007-friends][@regression] FriendsService.acceptRequest access control", () => {
  let prisma: PrismaStub;
  let svc: FriendsService;

  beforeEach(() => {
    prisma = makePrismaStub();
    const realtime = makeRealtimeStub();
    const presence = makePresenceStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc = new FriendsService(prisma as any, realtime as any, presence as any);
  });

  it("@regression throws ForbiddenException when initiator tries to accept their own request", async () => {
    prisma.friendship.findUnique.mockResolvedValue({
      id: "f-1",
      userAId: "aaa",
      userBId: "bbb",
      status: FriendshipStatus.pending,
      initiatedBy: "aaa",
      userA: { id: "aaa", nickname: "alice", country: null },
      userB: { id: "bbb", nickname: "bob", country: null },
    });

    await expect(svc.acceptRequest("aaa", "f-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("@regression throws ForbiddenException when a third party tries to accept", async () => {
    prisma.friendship.findUnique.mockResolvedValue({
      id: "f-1",
      userAId: "aaa",
      userBId: "bbb",
      status: FriendshipStatus.pending,
      initiatedBy: "aaa",
      userA: { id: "aaa", nickname: "alice", country: null },
      userB: { id: "bbb", nickname: "bob", country: null },
    });

    await expect(svc.acceptRequest("ccc", "f-1")).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("@regression throws NotFoundException for unknown friendshipId", async () => {
    prisma.friendship.findUnique.mockResolvedValue(null);
    await expect(svc.acceptRequest("bbb", "nonexistent")).rejects.toBeInstanceOf(NotFoundException);
  });
});

// ---------------------------------------------------------------------------
// FriendsService.unfriend — self-guard
// ---------------------------------------------------------------------------

describe("[@spec:007-friends][@regression] FriendsService.unfriend self-guard", () => {
  it("@regression throws BadRequestException when myUserId === otherUserId", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const svc = new FriendsService(null as any, null as any, null as any);
    await expect(svc.unfriend("aaa", "aaa")).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// ChallengeService.resolveAccept — color assignment
// ---------------------------------------------------------------------------

describe("[@spec:007-friends][@regression] ChallengeService.resolveAccept color assignment", () => {
  let redis: ReturnType<typeof makeRedisStub>;
  let gameService: ReturnType<typeof makeGameServiceStub>;
  let svc: ChallengeService;

  beforeEach(() => {
    redis = makeRedisStub();
    gameService = makeGameServiceStub();
    const realtime = makeRealtimeStub();
    const friendsService = { canonicalPair: vi.fn() };
    const presenceService = makePresenceStub();
    svc = new ChallengeService(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      redis as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      {} as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      friendsService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      presenceService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      gameService as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      realtime as any,
    );
  });

  async function seedChallenge(color: "white" | "black" | "random") {
    const challengeId = "chal-001";
    redis._hstore[`challenge:${challengeId}`] = {
      challengerId: "aaa",
      targetId: "bbb",
      mode: "Blitz",
      color,
      createdAt: String(Date.now()),
      timeoutAt: String(Date.now() + 60_000),
    };
    return challengeId;
  }

  it("@regression challenger gets white when color='white'", async () => {
    const id = await seedChallenge("white");
    const result = await svc.resolveAccept(id);
    expect(result.ok).toBe(true);
    const call = gameService.createGame.mock.calls[0]!;
    expect(call[0]).toBe("aaa"); // whiteId = challenger
    expect(call[1]).toBe("bbb"); // blackId = target
  });

  it("@regression challenger gets black when color='black'", async () => {
    const id = await seedChallenge("black");
    const result = await svc.resolveAccept(id);
    expect(result.ok).toBe(true);
    const call = gameService.createGame.mock.calls[0]!;
    expect(call[0]).toBe("bbb"); // whiteId = target
    expect(call[1]).toBe("aaa"); // blackId = challenger
  });

  it("@regression random color assigns one player white and the other black", async () => {
    // Run 20 times — both orderings must eventually appear; each call still produces valid pair
    const whiteIds = new Set<string>();
    for (let i = 0; i < 20; i++) {
      redis._hstore["challenge:chal-001"] = {
        challengerId: "aaa",
        targetId: "bbb",
        mode: "Blitz",
        color: "random",
        createdAt: String(Date.now()),
        timeoutAt: String(Date.now() + 60_000),
      };
      gameService.createGame.mockClear();
      (gameService.createGame as ReturnType<typeof vi.fn>).mockResolvedValue({
        gameId: `game-${i}`,
        timeControlMs: 180_000,
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQ - 0 1",
        sideToMove: "white",
        serverNow: Date.now(),
        white: { nickname: "p1", rating: 1500 },
        black: { nickname: "p2", rating: 1500 },
      });
      await svc.resolveAccept("chal-001");
      whiteIds.add(gameService.createGame.mock.calls[0]![0] as string);
    }
    // Both players should have been assigned white at least once across 20 trials
    expect(whiteIds.has("aaa")).toBe(true);
    expect(whiteIds.has("bbb")).toBe(true);
  });

  it("@regression returns { ok: false, code: 'not_found' } for missing challenge", async () => {
    const result = await svc.resolveAccept("no-such-challenge");
    expect(result).toEqual({ ok: false, code: "not_found" });
  });
});
