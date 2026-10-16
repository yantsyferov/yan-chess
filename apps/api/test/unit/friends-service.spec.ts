// @layer: unit
// @spec: 007-friends
import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { FriendshipStatus } from "@prisma/client";
import { FriendsService } from "../../src/modules/friends/friends.service";

// ---------------------------------------------------------------------------
// Minimal hand-rolled Prisma stub — only the shapes that FriendsService calls
// ---------------------------------------------------------------------------

function makePrismaStub() {
  return {
    friendship: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
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
  const toUserFn = vi.fn().mockReturnValue({ emit: emitFn });
  const toRoomFn = vi.fn().mockReturnValue({ emit: emitFn });
  return { toUser: toUserFn, toRoom: toRoomFn, emitFn };
}

function makePresenceStub() {
  return {
    getSocketCount: vi.fn().mockResolvedValue(1),
    broadcastPresence: vi.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Helper: build a minimal Friendship row
// ---------------------------------------------------------------------------

function makeFriendship(overrides: Partial<{
  id: string;
  userAId: string;
  userBId: string;
  status: FriendshipStatus;
  initiatedBy: string;
  createdAt: Date;
  respondedAt: Date | null;
}>) {
  return {
    id: "f-1",
    userAId: "aaa",
    userBId: "bbb",
    status: FriendshipStatus.pending,
    initiatedBy: "aaa",
    createdAt: new Date(),
    respondedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FriendsService.canonicalPair", () => {
  // instantiate with null stubs — canonicalPair never calls them
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = new FriendsService(null as any, null as any, null as any);

  it("@regression returns smaller UUID first when a < b", () => {
    expect(svc.canonicalPair("aaa", "bbb")).toEqual(["aaa", "bbb"]);
  });

  it("@regression returns smaller UUID first when a > b (inputs swapped)", () => {
    expect(svc.canonicalPair("bbb", "aaa")).toEqual(["aaa", "bbb"]);
  });

  it("handles identical inputs (self-case) without error", () => {
    expect(svc.canonicalPair("aaa", "aaa")).toEqual(["aaa", "aaa"]);
  });
});

describe("FriendsService.sendRequest", () => {
  let prisma: PrismaStub;
  let svc: FriendsService;

  beforeEach(() => {
    prisma = makePrismaStub();
    const realtime = makeRealtimeStub();
    const presence = makePresenceStub();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    svc = new FriendsService(prisma as any, realtime as any, presence as any);
  });

  it("throws BadRequestException when myUserId === targetUserId", async () => {
    await expect(svc.sendRequest("aaa", "aaa")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("creates a pending row and returns { status: 'pending' } when no existing friendship", async () => {
    prisma.friendship.findUnique.mockResolvedValue(null);
    prisma.user.findUnique = vi.fn().mockResolvedValue({ nickname: "Alice", country: null });
    prisma.friendship.create.mockResolvedValue(makeFriendship({ initiatedBy: "aaa" }));

    const result = await svc.sendRequest("aaa", "bbb");

    expect(result).toEqual({ status: "pending", friendshipId: expect.any(String) });
    expect(prisma.friendship.create).toHaveBeenCalledOnce();
    // initiatedBy must be the caller's id
    const createData = prisma.friendship.create.mock.calls[0][0].data;
    expect(createData.initiatedBy).toBe("aaa");
    expect(createData.status).toBe(FriendshipStatus.pending);
  });

  it("auto-accepts and returns { status: 'accepted' } when reverse-pending exists (target initiated)", async () => {
    // target ("bbb") sent a request first — initiatedBy is "bbb"
    prisma.friendship.findUnique.mockResolvedValue({
      ...makeFriendship({ userAId: "aaa", userBId: "bbb", status: FriendshipStatus.pending, initiatedBy: "bbb" }),
      userA: { id: "aaa", nickname: "Alice", country: null },
      userB: { id: "bbb", nickname: "Bob", country: null },
    });
    prisma.friendship.update.mockResolvedValue(
      makeFriendship({ status: FriendshipStatus.accepted }),
    );

    const result = await svc.sendRequest("aaa", "bbb");

    expect(result).toEqual({ status: "accepted", friendshipId: expect.any(String) });
    expect(prisma.friendship.update).toHaveBeenCalledOnce();
  });

  it("throws ConflictException with code 'already_friends' when friendship is already accepted", async () => {
    prisma.friendship.findUnique.mockResolvedValue(
      makeFriendship({ status: FriendshipStatus.accepted }),
    );

    const error = await svc.sendRequest("aaa", "bbb").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    // NestJS ConflictException stores response in .getResponse()
    const response = (error as ConflictException).getResponse() as { code: string };
    expect(response.code).toBe("already_friends");
  });

  it("throws ConflictException with code 'already_pending' when I already sent a request", async () => {
    prisma.friendship.findUnique.mockResolvedValue(
      makeFriendship({ status: FriendshipStatus.pending, initiatedBy: "aaa" }),
    );

    const error = await svc.sendRequest("aaa", "bbb").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConflictException);
    const response = (error as ConflictException).getResponse() as { code: string };
    expect(response.code).toBe("already_pending");
  });
});
